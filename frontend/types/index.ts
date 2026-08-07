export type ScanStatus = "Valid" | "Not Valid";
export interface ScanEntry {
    id: string;
    datasetRow: string;
    presenceBy: string;
    createdAt: string;
    status: ScanStatus;
}

type SuccessResult<T> = { status: "success"; data: T };
type ErrorResult = { status: "error"; error: string };
type InfoResult = { status: "info"; message: string };
export type Result<T> = ErrorResult | InfoResult | SuccessResult<T>;
