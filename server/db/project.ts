import type { ConvertKeysToSnakeCase } from "~/types";
import type { Project, ProjectWithDataset, SchemaObject } from "~/types/project";
import { db } from "$/db";
import { findDatasetById } from "$/db/dataset";

// Setup Table
db.run(
    `
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY DEFAULT (
      lower(
        hex(randomblob(4)) || '-' || 
        hex(randomblob(2)) || '-4' || 
        substr(hex(randomblob(2)), 2) || '-' || 
        substr('89ab', abs(randomblob(1) % 4) + 1, 1) || 
        substr(hex(randomblob(2)), 2) || '-' || 
        hex(randomblob(6))
      )
    ),
    dataset_id INTEGER,
    name TEXT,
    schema_objects TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dataset_id) REFERENCES datasets (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_project_dataset_id ON projects (dataset_id);`,
);

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
const FIND_DATASET_BY_PROJECT_ID_QUERY = db.query<{ dataset_id: string }, [string]>(
    "SELECT dataset_id FROM projects WHERE id = ?",
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

export function findDatasetByProjectId(projectId: string) {
    const row = FIND_DATASET_BY_PROJECT_ID_QUERY.get(projectId);
    return row?.dataset_id ?? null;
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
