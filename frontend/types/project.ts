import type { ZodString } from "zod";
import type { DataContentType, Dataset, DatasetKey } from "@/types";

/**
 * Represents a project entity
 */
export interface Project {
    /** The project id (uuid) */
    id: string;
    /** The project name */
    name: string;

    /** The primary column name used as a unique identifier for input data matching. */
    datasetKey: DatasetKey;
    /** The custom display text used to represent the {@link datasetKey} across the user interface. */
    datasetKeyLabel: string;
    /** The file system or storage directory path where the source CSV dataset is located. */
    datasetPath: string;

    /**
     * The dataset loaded from the datasetPath.
     * @remarks Never set this value directly, use the `initDataset` action instead.
     * @see {@link Dataset}
     */
    dataset: Map<string, Dataset> | null;
    /**
     * The map of dataset column names and their data types.
     * Used for content validation.
     * If the type is "text" then it will be shown as a regular text.
     * If the type is "image" then it will be shown as an image.
     *
     * @remarks
     * Updating or adding keys in this property *requires* you to
     * manually update {@link columnKeys} immediately after to prevent stale data.
     */
    columns: DataContentType;
    /**
     * The dataset column names.
     *
     * @remarks
     * This is dependent value derived from {@link columns}.
     * Do not update this directly without a corresponding change to {@link columns}.
     */
    columnKeys: DatasetKey[];

    /** The schema used for the initial layer of data validation before {@link dataset}-level checks are applied. */
    schema: ZodString;
}

export type EditedProject = Omit<Project, "dataset">;
