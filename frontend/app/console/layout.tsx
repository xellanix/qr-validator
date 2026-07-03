import { Navigate, Outlet } from "react-router-dom";
import { useUserStore } from "@/stores/user.store";
import { LoadingGuard } from "@/app/_components/loading";

function ConsoleGuardImpl() {
    if (!useUserStore.getState().hasConsoleAccess()) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
}

export default function ConsoleGuard() {
    return (
        <LoadingGuard>
            <ConsoleGuardImpl />
        </LoadingGuard>
    );
}
