export interface User {
    name: string;
    authorizeLevel: 0 | 1 | 2 | 3;
}

export type ScanStatus = "Valid" | "Not Valid";
export interface ScanEntry {
    id: string;
    data: string;
    validatorName: string;
    validatedAt: string;
    status: ScanStatus;
}

type SuccessResult<T> = { status: "success"; data: T };
type ErrorResult = { status: "error"; error: string };
type InfoResult = { status: "info"; message: string };
export type Result<T> = ErrorResult | InfoResult | SuccessResult<T>;

export type BlobBuffer = {
    buffer: Buffer<ArrayBuffer>;
    type: string;
};

export type Dataset = Record<string, string>;
export type DatasetKey = keyof Dataset;
export type DatasetValue = Dataset[DatasetKey];

export type DataContentType<T = Dataset> = {
    [K in keyof T]: "text" | "image";
};
