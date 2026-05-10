import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Creates a singleton async loader that respects parameters.
 * Ensures that an expensive async function is only ever executed once per unique set of arguments.
 * Subsequent calls with the same arguments while the first is in-flight will wait for the original
 * to complete and receive its result. After completion, the result is cached per argument combination.
 *
 * @param loader - The expensive async function to execute.
 * @returns A new function that acts as a singleton gateway to your loader, keyed by arguments.
 *
 * @example
 * const getDataset = createSingletonAsyncLoader(async (userId: string, page: number) => {
 *     const res = await fetch(`./api/data?user=${userId}&page=${page}`);
 *     return res.json();
 * });
 *
 * await getDataset("alice", 1); // fetches
 * await getDataset("alice", 1); // cached
 * await getDataset("bob", 1);   // fetches separately
 */
export function createSingletonAsyncLoader<TArgs extends unknown[], T>(
    loader: (...args: TArgs) => Promise<T>,
): (...args: TArgs) => Promise<T> {
    const cache = new Map<
        string,
        { pending: Promise<T> | null; result: T | undefined; hasResult: boolean }
    >();

    return async (...args: TArgs): Promise<T> => {
        const key = JSON.stringify(args);

        if (!cache.has(key)) {
            cache.set(key, { pending: null, result: undefined, hasResult: false });
        }

        const entry = cache.get(key)!;

        // 1. If we have a cached result, return it immediately.
        if (entry.hasResult) {
            console.log("Returning cached result.");
            return entry.result as T;
        }

        // 2. If a request is already in flight, wait for it to finish.
        if (entry.pending) {
            console.log("Another request is in flight. Waiting...");
            return entry.pending;
        }

        // 3. This is the first request. Execute the loader.
        console.log("First request. Starting the expensive loader...");
        entry.pending = loader(...args);

        try {
            const result = await entry.pending;
            // Cache the result for future calls
            entry.result = result;
            entry.hasResult = true;
            console.log("Loader finished. Caching result.");
            return result;
        } catch (error) {
            // If it fails, don't cache. Let the next call try again.
            console.error("Loader failed:", error);
            throw error; // Re-throw the error so the caller can handle it
        } finally {
            // 4. Clear the pending promise so the next call (if there was an error)
            // or subsequent calls (after a cache reset, if implemented) can proceed.
            entry.pending = null;
        }
    };
}

/**
 * Compares two nullable strings with configurable null positioning.
 */
export function compareNullableStrings(
    a: string | null | undefined,
    b: string | null | undefined,
    nullPosition: "first" | "last" = "first",
    order: "asc" | "desc" = "asc",
): number {
    // 1. Handle cases where both are null/undefined
    if (a == null && b == null) return 0;

    // 2. Handle null/undefined positioning
    if (a == null) return nullPosition === "first" ? -1 : 1;
    if (b == null) return nullPosition === "first" ? 1 : -1;

    // 3. Both values exist, perform standard string comparison
    const result = a.localeCompare(b);

    return order === "asc" ? result : -result;
}

/**
 * Determines the URL of the backend server based on environment.
 * @returns The URL of the backend server
 */
export function getBackendUrl() {
    // If we are accessing the Vite dev server, point to the Bun backend port
    if (import.meta.env.DEV) {
        return "http://localhost:26051";
    }

    return window.location.origin;
}
