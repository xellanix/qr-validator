import type { ZodType } from "zod";
import type { ProjectWithDataset } from "~/types/project";

export type ProjectItem = Omit<ProjectWithDataset, "schemaObjects"> & {
    /** The schema used for the initial layer of data validation before dataset-level checks are applied. */
    schema: ZodType<string>;
    /** The schema objects used for editing the {@link schema}. */
    schemaObjects: SchemaObjectSortable[];
};

export type SchemaObject = {
    type: string;
    value?: string;
};

export type SchemaObjectSortable = SchemaObject & {
    sortId: number;
};
