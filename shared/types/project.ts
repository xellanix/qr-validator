import type { CachedDataset } from "~/types/dataset";

export type SchemaObject = {
    type: string;
    value?: string;
};

export type Project = {
    /** The project id (uuid) */
    id: string;
    /** The project name */
    name: string;
    /** The dataset id. Only undefined in non-console mode */
    datasetId: string | null | undefined;
    /** The schema objects used for editing the {@link schema}. */
    schemaObjects: SchemaObject[];
};

export type ProjectWithDataset = Project & CachedDataset;
