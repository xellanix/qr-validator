import { Navigate, Outlet } from "react-router-dom";
import { useAppStore } from "@/stores/app.store";
import { useUserStore } from "@/stores/user.store";
import { AuthView } from "@/components/auth";
import { AppHeader } from "@/components/core/header";
import { Toaster } from "@/components/ui/sonner";
import { Spinner } from "@/components/ui/spinner";

export default function Layout() {
    return (
        <main className="bg-secondary flex h-dvh w-dvw flex-col overflow-hidden">
            <section className="flex size-full flex-1 flex-col">
                <div className="flex h-full flex-col items-center justify-center">
                    <div className="flex size-full flex-col overflow-hidden *:px-4 *:first:pt-4 *:last:pb-4 sm:px-8 sm:*:first:pt-8 sm:*:last:pb-8">
                        <AppHeader />

                        <LoadingGuard>
                            <AuthGuard />
                        </LoadingGuard>
                    </div>
                </div>
            </section>
            <Toaster richColors={true} />
        </main>
    );
}

function LoadingGuard({ children }: { children: React.ReactNode }) {
    const isLoading = useAppStore((s) => s.isLoading);

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Spinner className="size-12" />
            </div>
        );
    }

    return children;
}

function AuthGuard() {
    // If not authenticated after loading, show the login screen
    if (useUserStore((s) => !s.isAuthenticated)) {
        return (
            <div className="flex flex-col size-full overflow-hidden">
                <AuthView />
            </div>
        );
    }

    return <Outlet />;
}

export function ConsoleGuard() {
    if (!useUserStore.getState().hasConsoleAccess()) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
}
