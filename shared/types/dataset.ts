export type DatasetPayload = {
    /** The primary column name used as a unique identifier for input data matching. */
    key: string;
    /** The custom display text used to represent the {@link key} across the user interface. */
    keyLabel: string;
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
};
export type CachedDataset = DatasetPayload & {
    /**
     * The dataset column names.
     *
     * @remarks
     * This is dependent value derived from {@link columns}.
     * Do not update this directly without a corresponding change to {@link columns}.
     */
    columnKeys: DatasetRowKey[];
};
export type DatasetRow = Record<string, string>;
export type DatasetWithRows = DatasetPayload & { rows?: (DatasetRow | null)[] };

export type DatasetRowKey = keyof DatasetRow;
export type DatasetRowValue = DatasetRow[DatasetRowKey];
export type DataContentType<T = DatasetRow> = {
    [K in keyof T]: "text" | "image";
};
