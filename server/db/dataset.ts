import type { DatasetPayload, DatasetRow, DatasetRowValue, DatasetWithRows } from "~/types/dataset";
import { createSearchHash, db, decryptData, encryptData } from "$/db";
import { toNonSharedBytes } from "$/lib/utils";

const DATASET_ENCRYPTION_KEY = toNonSharedBytes(process.env.DATASET_ENCRYPTION_KEY, 32, false);
const key = await crypto.subtle.importKey("raw", DATASET_ENCRYPTION_KEY, "AES-GCM", false, [
    "encrypt",
    "decrypt",
]);

// Setup Table
db.run(
    `
CREATE TABLE IF NOT EXISTS datasets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payload BLOB NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS dataset_rows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dataset_id INTEGER NOT NULL,
    key_hash BLOB NOT NULL,
    payload BLOB NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_dataset_rows_key_hash ON dataset_rows (dataset_id, key_hash);
`,
);

// PREDEFINED PREPARED STATEMENTS
const ADD_DATASET_QUERY = db.prepare("INSERT INTO datasets (payload) VALUES (?)");
const GET_ALL_DATASETS = db.query<{ id: number; payload: Uint8Array }, []>(
    "SELECT id, payload FROM datasets",
);
const FIND_DATASET_BY_ID_QUERY = db.query<{ payload: Uint8Array }, [number]>(
    "SELECT payload FROM datasets WHERE id = ?",
);
const UPDATE_DATASET_BY_ID_QUERY = db.prepare("UPDATE datasets SET payload = ? WHERE id = ?");
const REMOVE_DATASET_BY_ID_QUERY = db.prepare("DELETE FROM datasets WHERE id = ?");

const ADD_DATASET_ROW_QUERY = db.prepare(
    "INSERT INTO dataset_rows (dataset_id, key_hash, payload) VALUES ($dataset_id, $key_hash, $payload)",
);
const ADD_DATASET_ROWS_QUERY = db.transaction(
    (data: { $dataset_id: number; $key_hash: Uint8Array; $payload: Uint8Array }[]) => {
        for (const row of data) {
            ADD_DATASET_ROW_QUERY.run(row);
        }
        return data.length;
    },
);
const FIND_DATASET_ROWS_QUERY = db.query<{ payload: Uint8Array }, [number, Uint8Array]>(
    "SELECT payload FROM dataset_rows WHERE dataset_id = ? AND key_hash = ?",
);
const FIND_DATASET_ROWS_BY_DATASET_ID_QUERY = db.query<{ payload: Uint8Array }, [number]>(
    "SELECT payload FROM dataset_rows WHERE dataset_id = ?",
);
const REMOVE_DATASET_ROWS_QUERY = db.prepare(
    "DELETE FROM dataset_rows WHERE dataset_id = ? AND key_hash = ?",
);
const REMOVE_DATASET_ROWS_BY_DATASET_ID_QUERY = db.prepare(
    "DELETE FROM dataset_rows WHERE dataset_id = ?",
);

export async function addDataset(dataset: DatasetPayload, rows?: DatasetRow[]) {
    try {
        const payload = await encryptData(JSON.stringify(dataset), key);
        const { changes, lastInsertRowid } = ADD_DATASET_QUERY.run(payload);
        if (changes === 0) return -1;

        const rowId = lastInsertRowid as number;
        if (rows) await addDatasetRows(rowId, rows, dataset.key);

        return rowId;
    } catch {
        return -1;
    }
}

export async function addDatasetRows(
    datasetId: number,
    rows: DatasetRow[],
    datasetKey?: DatasetPayload["key"],
) {
    try {
        if (rows.length === 0) return 0;

        const _k = datasetKey || (await findDatasetById(datasetId))?.key;
        if (!_k) return 0;

        const data: Parameters<typeof ADD_DATASET_ROWS_QUERY>[0] = new Array(rows.length);
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            data[i] = {
                $dataset_id: datasetId,
                $key_hash: createSearchHash(row[_k]),
                $payload: await encryptData(JSON.stringify(row), key),
            };
        }

        return ADD_DATASET_ROWS_QUERY(data);
    } catch {
        return 0;
    }
}

export async function getAllDatasets() {
    try {
        const rows = GET_ALL_DATASETS.all();
        return await Promise.all(
            rows.map(async (row) => ({
                id: row.id,
                ...(await decryptData<DatasetPayload>(row.payload, key)),
            })),
        );
    } catch {
        return [];
    }
}

export async function findDatasetById(id: number, withRows = false) {
    try {
        const row = FIND_DATASET_BY_ID_QUERY.get(id);
        if (!row) return null;

        const res: DatasetWithRows | null = await decryptData<DatasetPayload>(row.payload, key);
        if (!res) return null;

        if (withRows) {
            const rows = await findDatasetRows(id);
            res.rows = rows;
        }

        return res;
    } catch {
        return null;
    }
}

export async function findDatasetRow(datasetId: number, keyHash?: Uint8Array | DatasetRowValue) {
    try {
        const kh = typeof keyHash === "string" ? createSearchHash(keyHash) : keyHash;
        const row = kh
            ? FIND_DATASET_ROWS_QUERY.get(datasetId, kh)
            : FIND_DATASET_ROWS_BY_DATASET_ID_QUERY.get(datasetId);
        if (!row) return null;
        return await decryptData<DatasetRow>(row.payload, key);
    } catch {
        return null;
    }
}
export async function findDatasetRows(datasetId: number, keyHash?: Uint8Array | DatasetRowValue) {
    try {
        const kh = typeof keyHash === "string" ? createSearchHash(keyHash) : keyHash;
        const rows = kh
            ? FIND_DATASET_ROWS_QUERY.all(datasetId, kh)
            : FIND_DATASET_ROWS_BY_DATASET_ID_QUERY.all(datasetId);
        return await Promise.all(rows.map((row) => decryptData<DatasetRow>(row.payload, key)));
    } catch {
        return [];
    }
}

export async function updateDataset(id: number, datasetsPayload: Record<string, unknown>) {
    const prev = await findDatasetById(id);
    if (!prev) return 0;
    for (const k in prev) {
        if (!Object.hasOwn(prev, k)) continue;
        if (!Object.hasOwn(datasetsPayload, k)) continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prev[k as keyof typeof prev] = datasetsPayload[k] as any;
    }
    const payload = await encryptData(JSON.stringify(prev), key);
    const { changes } = UPDATE_DATASET_BY_ID_QUERY.run(payload, id);
    return changes;
}

export function removeDatasetById(id: number) {
    return REMOVE_DATASET_BY_ID_QUERY.run(id).changes > 0;
}

export function removeDatasetRows(datasetId: number, keyHash?: Uint8Array) {
    if (keyHash) return REMOVE_DATASET_ROWS_QUERY.run(datasetId, keyHash).changes > 0;
    return REMOVE_DATASET_ROWS_BY_DATASET_ID_QUERY.run(datasetId).changes > 0;
}
