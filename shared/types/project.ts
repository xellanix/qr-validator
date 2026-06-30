import type { CachedDataset } from "~/types/dataset";
import type { User } from "~/types/user";

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
    /** The users that have access to this project */
    users: User[];
};

export type ProjectWithDataset = Project & CachedDataset;
