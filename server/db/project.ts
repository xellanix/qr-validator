import type { ConvertKeysToSnakeCase } from "~/types";
import type { Project, ProjectWithDataset, SchemaObject } from "~/types/project";
import type { User } from "~/types/user";
import { db, encryptData } from "$/db";
import { findDatasetById } from "$/db/dataset";
import { addUser, addUsers, createUserHash, getUser, writeTokenFile } from "$/db/user";

type ProjectRow = ConvertKeysToSnakeCase<Omit<Project, "schemaObjects">> & {
    schema_objects: string;
};

// PREDEFINED PREPARED STATEMENTS
const ADD_PROJECT_QUERY = db.prepare<{ id: string }, [string, Uint8Array, string, string]>(
    "INSERT INTO projects (dataset_id, creator_user_hash, name, schema_objects) VALUES (?, ?, ?, ?) RETURNING id",
);
const GET_ALL_PROJECTS = db.query<ProjectRow, [Uint8Array]>(
    "SELECT id, dataset_id, name, schema_objects FROM projects WHERE creator_user_hash = ?",
);
const FIND_PROJECT_BY_ID_QUERY = db.query<ProjectRow, [Uint8Array, string]>(
    "SELECT id, dataset_id, name, schema_objects FROM projects WHERE creator_user_hash = ? AND id = ?",
);
const REMOVE_PROJECT_BY_ID_QUERY = db.prepare(
    "DELETE FROM projects WHERE creator_user_hash = ? AND id = ?",
);

const GET_ASSIGNED_USERS_DATA_BY_PROJECT_ID_QUERY = db.query<{ payload: Uint8Array }, [string]>(
    "SELECT u.payload FROM project_users p JOIN users u ON p.user_hash = u.user_hash WHERE p.project_id = ?",
);
const ASSIGN_USER_TO_PROJECT_QUERY = db.prepare(
    "INSERT OR IGNORE INTO project_users (project_id, user_hash) VALUES ($project_id, $user_hash)",
);
const ASSIGN_USERS_TO_PROJECT_QUERY = db.transaction(
    (data: { $project_id: string; $user_hash: Uint8Array }[]) => {
        for (const row of data) {
            ASSIGN_USER_TO_PROJECT_QUERY.run(row);
        }
        return data.length;
    },
);
const DELETE_ASSIGNED_USERS_FROM_PROJECT_QUERY = db.prepare(
    "DELETE FROM project_users WHERE project_id = ?",
);

export async function addProject(
    userHash: Uint8Array,
    datasetId: string,
    name: string,
    schemaObjects: SchemaObject[],
    assignedUsers: User[],
) {
    const res = ADD_PROJECT_QUERY.get(datasetId, userHash, name, JSON.stringify(schemaObjects));
    const id = res?.id ?? null;
    if (!id) return null;

    const usersResult = await addUsers(assignedUsers);
    if (!usersResult) return null;

    const data = assignedUsers.map((u, i) => ({
        $project_id: id,
        $user_hash: usersResult.hashes[i],
    }));
    const _ = ASSIGN_USERS_TO_PROJECT_QUERY(data);
    if (_ === 0) return null;

    return id;
}

async function _getProject(
    userHash: Uint8Array,
    row: ProjectRow,
    withDataset: boolean,
    excludeUsers: boolean = false,
    excludeDatasetId: boolean = false,
) {
    const schemaObjects = JSON.parse(row.schema_objects) as SchemaObject;
    const p: Record<string, unknown> = {
        id: row.id,
        datasetId: excludeDatasetId ? undefined : row.dataset_id,
        name: row.name,
        schemaObjects,
    };
    if (withDataset) {
        const dataset = row.dataset_id && (await findDatasetById(userHash, row.dataset_id, false));
        if (!dataset) return null;

        for (const k in dataset) {
            if (!Object.hasOwn(dataset, k)) continue;
            p[k] = dataset[k as keyof typeof dataset];
        }
    }
    if (!excludeUsers) {
        const user_payloads = GET_ASSIGNED_USERS_DATA_BY_PROJECT_ID_QUERY.all(row.id);
        const users = (await Promise.all(user_payloads.map((u) => getUser(u.payload)))).filter(
            Boolean,
        ) as User[];
        p.users = users;
    }
    return p;
}

export async function getAllProjects<D extends boolean = false>(
    userHash: Uint8Array,
    withDataset: D = false as D,
): Promise<Record<string, D extends true ? ProjectWithDataset : Project>> {
    const rows = GET_ALL_PROJECTS.all(userHash);
    const projects: Record<string, unknown> = {};

    for (const row of rows) {
        try {
            const p = await _getProject(userHash, row, withDataset);
            if (!p) continue;
            projects[row.id] = p;
        } catch {
            continue;
        }
    }

    return projects as never;
}

export async function findProjectById<D extends boolean = false>(
    userHash: Uint8Array,
    id: string,
    withDataset: D = false as D,
    excludeDatasetId: boolean = false,
): Promise<(D extends true ? ProjectWithDataset : Project) | null> {
    const row = FIND_PROJECT_BY_ID_QUERY.get(userHash, id);
    if (!row) return null;

    try {
        return (await _getProject(userHash, row, withDataset, true, excludeDatasetId)) as never;
    } catch {
        return null;
    }
}

export async function updateProject(
    userHash: Uint8Array,
    id: string,
    projectsPayload: Record<string, unknown>,
    newAssignedUsers?: User[],
) {
    let changes = 0;
    if (newAssignedUsers) {
        const filePayloads: { name: string; tokenBytes: Uint8Array }[] = [];
        const payloads: Uint8Array[] = [];
        const tokensBytes: Uint8Array[] = [];
        const hashes = await Promise.all(
            newAssignedUsers.map(async (u) => {
                const { hash, tokenBytes, token } = await createUserHash(u);
                const payload = await encryptData(JSON.stringify({ token }));
                payloads.push(payload);
                tokensBytes.push(tokenBytes);
                filePayloads.push({ name: u.name, tokenBytes });
                return hash;
            }),
        );
        changes = syncProjectUsers(id, hashes, payloads);
        if (changes === 0) return 0;

        const results: Uint8Array[] = [];
        await Promise.all(
            filePayloads.map(async (f) => {
                await writeTokenFile(f.name, f.tokenBytes);
                results.push(f.tokenBytes);
            }),
        );
    }

    const keys = Object.keys(projectsPayload);
    if (keys.length === 0) return changes;

    const setClause = keys.map((key) => `${key} = $${key}`).join(", ");
    const sql = `UPDATE projects SET ${setClause} WHERE creator_user_hash = $creator_user_hash AND id = $id`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const queryParams: Record<string, any> = { $creator_user_hash: userHash, $id: id };
    for (const key of keys) {
        queryParams[`$${key}`] = projectsPayload[key];
    }

    const stmt = db.prepare(sql);
    const info = stmt.run(queryParams);

    return info.changes;
}

function syncProjectUsers(projectId: string, newUsers: Uint8Array[], newPayloads: Uint8Array[]) {
    return db.transaction(() => {
        if (newUsers.length === 0) {
            const info = DELETE_ASSIGNED_USERS_FROM_PROJECT_QUERY.run(projectId);
            return info.changes;
        }

        const placeholders = newUsers.map(() => "?").join(",");
        const deleteStmt = db.prepare(
            `DELETE FROM project_users WHERE project_id = ? AND user_hash NOT IN (${placeholders})`,
        );
        deleteStmt.run(projectId, ...newUsers);
        for (let i = 0; i < newUsers.length; i++) {
            const user_hash = newUsers[i];
            const payload = newPayloads[i];
            void addUser(user_hash, payload);
            ASSIGN_USER_TO_PROJECT_QUERY.run(projectId, user_hash);
        }

        return newUsers.length;
    })();
}

export function removeProjectById(userHash: Uint8Array, id: string) {
    return REMOVE_PROJECT_BY_ID_QUERY.run(userHash, id).changes > 0;
}
