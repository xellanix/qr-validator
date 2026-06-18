import type { ConvertKeysToSnakeCase } from "~/types";
import type { Project, ProjectWithDataset, SchemaObject } from "~/types/project";
import { db } from "$/db";
import { findDatasetById } from "$/db/dataset";

type ProjectRow = ConvertKeysToSnakeCase<Omit<Project, "schemaObjects">> & {
    schema_objects: string;
};

// PREDEFINED PREPARED STATEMENTS
const ADD_PROJECT_QUERY = db.prepare<{ id: string }, [number, string, string]>(
    "INSERT INTO projects (dataset_id, name, schema_objects) VALUES (?, ?, ?) RETURNING id",
);
const GET_ALL_PROJECTS = db.query<ProjectRow, []>(
    "SELECT id, dataset_id, name, schema_objects FROM projects",
);
const FIND_PROJECT_BY_ID_QUERY = db.query<ProjectRow, [string]>(
    "SELECT id, dataset_id, name, schema_objects FROM projects WHERE id = ?",
);
const REMOVE_PROJECT_BY_ID_QUERY = db.prepare("DELETE FROM projects WHERE id = ?");

export function addProject(datasetId: number, name: string, schemaObjects: SchemaObject[]) {
    const res = ADD_PROJECT_QUERY.get(datasetId, name, JSON.stringify(schemaObjects));
    return res?.id ?? null;
}

async function _getProject(
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
        const dataset = row.dataset_id && (await findDatasetById(row.dataset_id, false));
        if (!dataset) return null;

        for (const k in dataset) {
            if (!Object.hasOwn(dataset, k)) continue;
            p[k] = dataset[k as keyof typeof dataset];
        }
    }
    return p;
}

export async function getAllProjects<D extends boolean = false>(
    withDataset: D = false as D,
): Promise<Record<string, D extends true ? ProjectWithDataset : Project>> {
    const rows = GET_ALL_PROJECTS.all();
    const projects: Record<string, unknown> = {};

    for (const row of rows) {
        try {
            const p = await _getProject(row, withDataset);
            if (!p) continue;
            projects[row.id] = p;
        } catch {
            continue;
        }
    }

    return projects as never;
}

export async function findProjectById<D extends boolean = false>(
    id: string,
    withDataset: D = false as D,
    excludeDatasetId: boolean = false,
): Promise<(D extends true ? ProjectWithDataset : Project) | null> {
    const row = FIND_PROJECT_BY_ID_QUERY.get(id);
    if (!row) return null;

    try {
        return (await _getProject(row, withDataset, excludeDatasetId)) as never;
    } catch {
        return null;
    }
}

export function updateProject(id: string, projectsPayload: Record<string, unknown>) {
    const keys = Object.keys(projectsPayload);

    if (keys.length === 0) return 0;

    const setClause = keys.map((key) => `${key} = $${key}`).join(", ");
    const sql = `UPDATE projects SET ${setClause} WHERE id = $id`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const queryParams: Record<string, any> = { $id: id };
    for (const key of keys) {
        queryParams[`$${key}`] = projectsPayload[key];
    }

    const stmt = db.prepare(sql);
    const info = stmt.run(queryParams);

    return info.changes;
}

export function removeProjectById(id: string) {
    return REMOVE_PROJECT_BY_ID_QUERY.run(id).changes > 0;
}
