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
    /** Whether the project allows duplicate valid */
    allowDuplicateValid: boolean;
    /** The maximum number of valid duplicates allowed */
    maxValidDuplicate: number;
    /** Whether the project is in continuous scanning mode */
    isContinuousScanning: boolean;
};

export type ProjectWithDataset = Project & CachedDataset;
