import type { IconSvgElement } from "@hugeicons/react";

export type NavigationLookup = Record<string, NavigationItem>;
export type NavigationItem = {
    id: string;
    title: string;
    icon?: IconSvgElement;
    content: React.ReactNode;
    children?: NavigationLookup;
};

export interface SidebarButtonProps {
    nav: Omit<NavigationItem, "content" | "children">;
}
