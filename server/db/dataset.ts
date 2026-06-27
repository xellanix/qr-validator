import type { DatasetPayload, DatasetRow, DatasetRowValue, DatasetWithRows } from "~/types/dataset";
import { createSearchHash, db, decryptData, encryptData } from "$/db";
import { toNonSharedBytes } from "$/lib/utils";

const DATASET_ENCRYPTION_KEY = toNonSharedBytes(process.env.DATASET_ENCRYPTION_KEY, 32, false);
const key = await crypto.subtle.importKey("raw", DATASET_ENCRYPTION_KEY, "AES-GCM", false, [
    "encrypt",
    "decrypt",
]);

// PREDEFINED PREPARED STATEMENTS
const ADD_DATASET_QUERY = db.prepare<{ id: string }, [Uint8Array, Uint8Array]>(
    "INSERT INTO datasets (creator_user_hash, payload) VALUES (?, ?) RETURNING id",
);
const GET_ALL_DATASETS = db.query<{ id: string; payload: Uint8Array }, [Uint8Array]>(
    "SELECT id, payload FROM datasets WHERE creator_user_hash = ?",
);
const FIND_DATASET_BY_ID_QUERY = db.query<{ payload: Uint8Array }, [Uint8Array, string]>(
    "SELECT payload FROM datasets WHERE creator_user_hash = ? AND id = ?",
);
const UPDATE_DATASET_BY_ID_QUERY = db.prepare(
    "UPDATE datasets SET payload = ? WHERE creator_user_hash = ? AND id = ?",
);
const REMOVE_DATASET_BY_ID_QUERY = db.prepare(
    "DELETE FROM datasets WHERE creator_user_hash = ? AND id = ?",
);

const ADD_DATASET_ROW_QUERY = db.prepare(
    "INSERT INTO dataset_rows (dataset_id, key_hash, payload) VALUES ($dataset_id, $key_hash, $payload)",
);
const ADD_DATASET_ROWS_QUERY = db.transaction(
    (data: { $dataset_id: string; $key_hash: Uint8Array; $payload: Uint8Array }[]) => {
        for (const row of data) {
            ADD_DATASET_ROW_QUERY.run(row);
        }
        return data.length;
    },
);
const FIND_DATASET_ROWS_QUERY = db.query<{ payload: Uint8Array }, [string, Uint8Array]>(
    "SELECT payload FROM dataset_rows WHERE dataset_id = ? AND key_hash = ?",
);
const FIND_DATASET_ROWS_BY_DATASET_ID_QUERY = db.query<{ payload: Uint8Array }, [string]>(
    "SELECT payload FROM dataset_rows WHERE dataset_id = ?",
);
const FIND_DATASET_ROWS_BY_PROJECT_ID_QUERY_AND_KEY_HASH = db.query<
    { payload: Uint8Array },
    [string, Uint8Array]
>(
    "SELECT r.payload from dataset_rows r JOIN projects p ON r.dataset_id = p.dataset_id WHERE p.id = ? AND r.key_hash = ?",
);
const FIND_DATASET_ROWS_BY_PROJECT_ID_QUERY = db.query<{ payload: Uint8Array }, [string]>(
    "SELECT r.payload from dataset_rows r JOIN projects p ON r.dataset_id = p.dataset_id WHERE p.id = ?",
);
const REMOVE_DATASET_ROWS_QUERY = db.prepare(
    "DELETE FROM dataset_rows WHERE dataset_id = ? AND key_hash = ?",
);
const REMOVE_DATASET_ROWS_BY_DATASET_ID_QUERY = db.prepare(
    "DELETE FROM dataset_rows WHERE dataset_id = ?",
);

export async function addDataset(
    userHash: Uint8Array,
    dataset: DatasetPayload,
    rows?: DatasetRow[],
) {
    try {
        const payload = await encryptData(JSON.stringify(dataset), key);
        const row = ADD_DATASET_QUERY.get(userHash, payload);
        if (!row) return null;

        if (rows) await addDatasetRows(userHash, row.id, rows, dataset.key);

        return row.id;
    } catch {
        return null;
    }
}

export async function addDatasetRows(
    userHash: Uint8Array,
    datasetId: string,
    rows: DatasetRow[],
    datasetKey?: DatasetPayload["key"],
) {
    try {
        if (rows.length === 0) return 0;

        const _k = datasetKey || (await findDatasetById(userHash, datasetId))?.key;
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

export async function getAllDatasets(userHash: Uint8Array) {
    try {
        const rows = GET_ALL_DATASETS.all(userHash);
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

export async function findDatasetById(userHash: Uint8Array, id: string, withRows = false) {
    try {
        const row = FIND_DATASET_BY_ID_QUERY.get(userHash, id);
        if (!row) return null;

        const res: DatasetWithRows | null = await decryptData<DatasetPayload>(row.payload, key);
        if (!res) return null;

        if (withRows) {
            const rows = await findDatasetRows(id, false);
            res.rows = rows;
        }

        return res;
    } catch {
        return null;
    }
}

export async function findDatasetRow(
    id: string, // If isProject is true, id is project id, else id is dataset id
    isProject: boolean,
    keyHash?: Uint8Array | DatasetRowValue,
) {
    try {
        const kh = typeof keyHash === "string" ? createSearchHash(keyHash) : keyHash;
        let payload: Uint8Array | null = null;
        if (kh) {
            if (isProject)
                payload =
                    FIND_DATASET_ROWS_BY_PROJECT_ID_QUERY_AND_KEY_HASH.get(id, kh)?.payload ?? null;
            else payload = FIND_DATASET_ROWS_QUERY.get(id, kh)?.payload ?? null;
        } else {
            if (isProject) payload = FIND_DATASET_ROWS_BY_PROJECT_ID_QUERY.get(id)?.payload ?? null;
            else payload = FIND_DATASET_ROWS_BY_DATASET_ID_QUERY.get(id)?.payload ?? null;
        }
        if (!payload) return null;
        return await decryptData<DatasetRow>(payload, key);
    } catch {
        return null;
    }
}
export async function findDatasetRows(
    id: string, // If isProject is true, id is project id, else id is dataset id
    isProject: boolean,
    keyHash?: Uint8Array | DatasetRowValue,
) {
    try {
        const kh = typeof keyHash === "string" ? createSearchHash(keyHash) : keyHash;
        let rows: { payload: Uint8Array }[] = [];
        if (kh) {
            if (isProject) rows = FIND_DATASET_ROWS_BY_PROJECT_ID_QUERY_AND_KEY_HASH.all(id, kh);
            else rows = FIND_DATASET_ROWS_QUERY.all(id, kh);
        } else {
            if (isProject) rows = FIND_DATASET_ROWS_BY_PROJECT_ID_QUERY.all(id);
            else rows = FIND_DATASET_ROWS_BY_DATASET_ID_QUERY.all(id);
        }
        return await Promise.all(rows.map((row) => decryptData<DatasetRow>(row.payload, key)));
    } catch {
        return [];
    }
}

export async function updateDataset(
    userHash: Uint8Array,
    id: string,
    datasetsPayload: Record<string, unknown>,
) {
    const prev = await findDatasetById(userHash, id);
    if (!prev) return 0;
    for (const k in prev) {
        if (!Object.hasOwn(prev, k)) continue;
        if (!Object.hasOwn(datasetsPayload, k)) continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prev[k as keyof typeof prev] = datasetsPayload[k] as any;
    }
    const payload = await encryptData(JSON.stringify(prev), key);
    const { changes } = UPDATE_DATASET_BY_ID_QUERY.run(payload, userHash, id);
    return changes;
}

export function removeDatasetById(userHash: Uint8Array, id: string) {
    return REMOVE_DATASET_BY_ID_QUERY.run(userHash, id).changes > 0;
}

export function removeDatasetRows(datasetId: string, keyHash?: Uint8Array) {
    if (keyHash) return REMOVE_DATASET_ROWS_QUERY.run(datasetId, keyHash).changes > 0;
    return REMOVE_DATASET_ROWS_BY_DATASET_ID_QUERY.run(datasetId).changes > 0;
}
