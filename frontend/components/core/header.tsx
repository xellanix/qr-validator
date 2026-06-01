import { useProjectStore } from "@/stores/project.store";
import { useUserStore } from "@/stores/user.store";
import { LogoutButton } from "@/components/auth";
import { SocketStatus } from "@/components/socket-status";

export function AppHeader() {
    const activeProject = useProjectStore(
        (s) => ((s.activeId && s.projects[s.activeId]) || null)?.name,
    );

    return (
        <div className="mb-8 flex items-center justify-between *:-mx-4 *:px-4 min-h-21">
            <div className="flex flex-col">
                <div className="flex w-full gap-2">
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">PreMark</h1>
                    <SocketStatus />
                </div>
                <p className="text-sm text-gray-500">{activeProject}</p>
            </div>
            <UserSection />
        </div>
    );
}

function UserSection() {
    const user = useUserStore((s) => s.user);
    if (!user) return null;

    return (
        <div className="flex items-center gap-4">
            <div className="text-right">
                <p className="font-semibold">{user.name}</p>
                <p className="text-sm text-gray-500">Level {user.authorizeLevel}</p>
            </div>
            <LogoutButton />
        </div>
    );
}
