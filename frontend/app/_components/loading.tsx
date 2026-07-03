import { Suspense } from "react";
import { useAppStore } from "@/stores/app.store";
import { Spinner } from "@/components/ui/spinner";

function Loading() {
    return (
        <div className="flex min-h-screen items-center justify-center">
            <Spinner className="size-12" />
        </div>
    );
}

export function LoadingGuard({ children }: { children: React.ReactNode }) {
    const isLoading = useAppStore((s) => s.isLoading);

    if (isLoading) {
        return <Loading />;
    }

    return children;
}

export function SuspenseGuard({ children }: { children: React.ReactNode }) {
    return <Suspense fallback={<Loading />}>{children}</Suspense>;
}
