import { useCallback, useRef, useState } from "react";

export type LockStatus = "idle" | "running" | "error";

export interface UseCallbackLockOptions {
    /**
     * Called when the lock is already held and a concurrent invocation is
     * attempted. Useful for showing toasts or logging.
     */
    onConflict?: () => void;
    /**
     * Called when the async callback throws. Receives the error.
     * If omitted the error is silently swallowed (the lock is still released).
     */
    onError?: (error: unknown) => void;
    /**
     * If true, resets `status` back to "idle" after `onError` has been called.
     * Defaults to false so callers can inspect the error state.
     */
    resetOnError?: boolean;
}

export interface UseCallbackLockReturn<TArgs extends unknown[], TReturn> {
    /** Wrapped version of your callback – safe to call concurrently. */
    invoke: (...args: TArgs) => Promise<TReturn | undefined>;
    /** Whether the lock is currently held. */
    isLocked: boolean;
    /** Current lifecycle status of the lock. */
    status: LockStatus;
    /** Manually release the lock (e.g. after a fatal error you want to recover from). */
    release: () => void;
    /** Reset status to "idle" without releasing the lock (rarely needed). */
    resetStatus: () => void;
}

/**
 * useCallbackLock
 *
 * Wraps an async callback so that only one invocation can run at a time.
 * Additional calls made while the lock is held are dropped (not queued).
 *
 * @example
 * const { invoke, isLocked } = useCallbackLock(async (id: string) => {
 *   const data = await fetchUser(id);
 *   setUser(data);
 * });
 *
 * <button onClick={() => invoke(userId)} disabled={isLocked}>
 *   Load User
 * </button>
 */
export function useCallbackLock<TArgs extends unknown[], TReturn>(
    callback: (...args: TArgs) => Promise<TReturn>,
    options: UseCallbackLockOptions = {},
): UseCallbackLockReturn<TArgs, TReturn> {
    const { onConflict, onError, resetOnError = false } = options;

    // Use a ref for the "locked" boolean so reads inside `invoke` are always
    // up-to-date without causing unnecessary re-renders.
    const lockedRef = useRef(false);

    // Expose lock state as React state so consumers can re-render on changes.
    const [isLocked, setIsLocked] = useState(false);
    const [status, setStatus] = useState<LockStatus>("idle");

    const acquire = useCallback(() => {
        lockedRef.current = true;
        setIsLocked(true);
        setStatus("running");
    }, []);

    const release = useCallback(() => {
        lockedRef.current = false;
        setIsLocked(false);
        setStatus("idle");
    }, []);

    const resetStatus = useCallback(() => {
        setStatus("idle");
    }, []);

    const invoke = useCallback(
        async (...args: TArgs): Promise<TReturn | undefined> => {
            // Lock already held – bail out immediately.
            if (lockedRef.current) {
                onConflict?.();
                return undefined;
            }

            acquire();

            try {
                const result = await callback(...args);
                return result;
            } catch (error: unknown) {
                setStatus("error");
                onError?.(error);
                if (resetOnError) {
                    setStatus("idle");
                }
                return undefined;
            } finally {
                // Always release the lock, even when `onError` throws.
                // We only skip resetting `status` here so the "error" state is visible.
                lockedRef.current = false;
                setIsLocked(false);
                // Only reset to idle if we didn't just set it to "error".
                setStatus((prev) => (prev === "error" ? prev : "idle"));
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [callback, onConflict, onError, resetOnError],
    );

    return { invoke, isLocked, status, release, resetStatus };
}
