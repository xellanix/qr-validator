import type { NavigationItem } from "@/components/dialogs/projects/shared";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/stores/project.store";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";

export function DialogSidebar({ navs }: { navs: NavigationItem[] }) {
    return (
        <Sidebar className="h-full">
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {navs.map((nav) => (
                                <SidebarButton key={nav.id} nav={nav} />
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    );
}

function SidebarButton({ nav }: { nav: Omit<NavigationItem, "content" | "children"> }) {
    const isActive = useProjectStore((s) => s.edit.activePage.split(".")[0] === nav.id);
    const setActivePage = useProjectStore((s) => s.setActivePage);

    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                isActive={isActive}
                onClick={() => setActivePage(nav.id)}
                className={cn(
                    "before:bg-brand relative before:absolute before:top-full before:bottom-full before:left-0 before:z-10 before:w-0.75 before:rounded-full before:transition-all before:duration-133 before:ease-out",
                    { "before:top-2.5 before:bottom-2.5": isActive },
                )}
            >
                <HugeiconsIcon icon={nav.icon!} strokeWidth={1.75} />
                {nav.title}
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
}
