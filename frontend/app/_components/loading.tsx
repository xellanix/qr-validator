import { Suspense } from "react";
import { useAppStore } from "@/stores/app.store";
import { useSocketStore } from "@/stores/socket.store";
import { useUserStore } from "@/stores/user.store";
import { Spinner } from "@/components/ui/spinner";

function Loading({ message }: { message?: string }) {
    return (
        <div className="flex size-full items-center justify-center flex-col gap-2">
            <Spinner className="size-12" />
            {message && <p>{message}</p>}
        </div>
    );
}

export function LoadingGuard({ children }: { children: React.ReactNode }) {
    const isLoading = useAppStore((s) => s.isLoading);
    const isConnected = useSocketStore((s) => s.socketId !== null);

    if (useUserStore((s) => s.isAuthenticated) && !isConnected) {
        return <Loading message="Please wait while we reconnect you to the server." />;
    }

    if (isLoading) {
        return <Loading />;
    }

    return children;
}

export function SuspenseGuard({ children }: { children: React.ReactNode }) {
    return <Suspense fallback={<Loading />}>{children}</Suspense>;
}
