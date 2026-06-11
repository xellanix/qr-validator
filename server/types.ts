import type { Result } from "@/types";

export type SocketCallback<T> = (result: Result<T>) => void;
