import { UserIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { getUserRole } from "@/lib/user";
import { useProjectStore } from "@/stores/project.store";
import { useUserStore } from "@/stores/user.store";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { version } from "@/data/version.json";
import { LogoutButton, LogoutMenuButton } from "@/components/auth";
import { SocketStatus } from "@/components/socket-status";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppHeader() {
    const activeProject = useProjectStore(
        (s) => ((s.activeId && s.projects[s.activeId]) || null)?.name,
    );

    return (
        <div className="mb-8 flex items-center justify-between min-h-21 gap-4">
            <div className="flex flex-col">
                <div className="flex w-full gap-2 items-center">
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">PreMark</h1>
                    <code className="bg-background text-muted-foreground border border-border shadow-[0px_3px_0px_0px_var(--border)] inline-flex h-6 items-center justify-center rounded-md px-1.5 font-mono text-sm font-medium">
                        v{version}
                    </code>
                    <SocketStatus />
                </div>
                <p className="text-sm text-gray-500 line-clamp-1 break-all">{activeProject}</p>
            </div>
            <UserSection />
        </div>
    );
}

function UserSection() {
    const user = useUserStore((s) => s.user);
    const isMobile = useBreakpoint(540);

    if (!user) return null;

    if (isMobile) {
        return (
            <div className="flex items-center gap-4">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="tertiary" size="icon" aria-label="Sign out">
                            <HugeiconsIcon icon={UserIcon} className="size-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="bottom" align="end">
                        <DropdownMenuGroup>
                            <div className="flex flex-col px-3 py-2">
                                <p className="font-semibold line-clamp-2 break-all">{user.name}</p>
                                <p className="text-sm text-gray-500">
                                    {getUserRole(user.authorizeLevel)}
                                </p>
                            </div>
                            <DropdownMenuSeparator />
                            <LogoutMenuButton />
                        </DropdownMenuGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-4">
            <div className="text-right">
                <p className="font-semibold line-clamp-1 break-all">{user.name}</p>
                <p className="text-sm text-gray-500">{getUserRole(user.authorizeLevel)}</p>
            </div>
            <LogoutButton />
        </div>
    );
}
