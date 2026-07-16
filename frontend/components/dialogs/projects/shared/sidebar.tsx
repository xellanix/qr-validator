import type { NavigationItem, SidebarButtonProps } from "@/components/dialogs/projects/shared";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";

interface DialogSidebarProps {
    navs: NavigationItem[];
    ItemComponent: React.ComponentType<SidebarButtonProps>;
}
export function DialogSidebar({ navs, ItemComponent }: DialogSidebarProps) {
    return (
        <Sidebar className="h-full">
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {navs.map((nav) => (
                                <ItemComponent key={nav.id} nav={nav} />
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    );
}

interface DefaultSidebarButtonProps extends SidebarButtonProps {
    isActive: boolean;
    setActivePage: () => void;
}
export function DefaultSidebarButton({ nav, isActive, setActivePage }: DefaultSidebarButtonProps) {
    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                isActive={isActive}
                onClick={setActivePage}
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
