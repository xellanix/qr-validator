import type { ConvertKeysToSnakeCase } from "~/types";
import type { Project, ProjectWithDataset, SchemaObject } from "~/types/project";
import { db } from "$/db";
import { findDatasetById } from "$/db/dataset";

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

export function addProject(
    userHash: Uint8Array,
    datasetId: string,
    name: string,
    schemaObjects: SchemaObject[],
) {
    const res = ADD_PROJECT_QUERY.get(datasetId, userHash, name, JSON.stringify(schemaObjects));
    return res?.id ?? null;
}

async function _getProject(
    userHash: Uint8Array,
    row: ProjectRow,
    withDataset: boolean,
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
        return (await _getProject(userHash, row, withDataset, excludeDatasetId)) as never;
    } catch {
        return null;
    }
}

export function updateProject(
    userHash: Uint8Array,
    id: string,
    projectsPayload: Record<string, unknown>,
) {
    const keys = Object.keys(projectsPayload);

    if (keys.length === 0) return 0;

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

export function removeProjectById(userHash: Uint8Array, id: string) {
    return REMOVE_PROJECT_BY_ID_QUERY.run(userHash, id).changes > 0;
}
