import { useMemo } from "react";
import { useProjectStore } from "@/stores/project.store";
import { NAVIGATION_LOOKUP } from "@/components/dialogs/projects/edit/registry";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function SidebarFrame() {
    return (
        <main className="flex size-full flex-col">
            <header className="bg-background flex shrink-0 items-center border-b">
                <SidebarTrigger className="m-2" />
                <Separator
                    orientation="vertical"
                    className="mr-2 data-[orientation=vertical]:h-4 my-auto"
                />
                <SidebarFrameBreadcrumb />
            </header>
            <section className="flex size-full flex-col overflow-y-auto px-4">
                <SidebarFrameContent />
            </section>
        </main>
    );
}

function SidebarFrameBreadcrumb() {
    const activePage = useProjectStore((s) => s.edit.activePage);

    const breadcrumbs = useMemo(() => {
        const levels = activePage.split(".");
        let item = NAVIGATION_LOOKUP[levels[0]];

        const res = ["Project"];

        if (!item) return res;

        res.push(item.title || "Undefined");
        for (let i = 1; i < levels.length; i++) {
            if (!item?.children) break;
            const levelItem = item.children[levels[i]];
            if (levelItem) item = levelItem;
            res.push(item.title || "Undefined");
        }

        return res;
    }, [activePage]);

    return (
        <Breadcrumb>
            <BreadcrumbList className="sm:gap-1.5 md:gap-2.5">
                {breadcrumbs.map((breadcrumb, index) => (
                    <BreadcrumbPair
                        key={index}
                        index={index}
                        breadcrumb={breadcrumb}
                        length={breadcrumbs.length}
                    />
                ))}
            </BreadcrumbList>
        </Breadcrumb>
    );
}

interface BreadcrumbPairProps {
    index: number;
    breadcrumb: React.ReactNode;
    length: number;
}
function BreadcrumbPair({ index, breadcrumb, length }: BreadcrumbPairProps) {
    const isLast = index === length - 1;

    if (isLast) {
        return (
            <BreadcrumbItem>
                <BreadcrumbPage>{breadcrumb}</BreadcrumbPage>
            </BreadcrumbItem>
        );
    }

    return (
        <>
            <BreadcrumbItem>{breadcrumb}</BreadcrumbItem>
            <BreadcrumbSeparator />
        </>
    );
}

function SidebarFrameContent() {
    const content = useProjectStore((s) => {
        const levels = s.edit.activePage.split(".");
        let item = NAVIGATION_LOOKUP[levels[0]];
        for (let i = 1; i < levels.length; i++) {
            if (!item?.children) break;
            const levelItem = item.children[levels[i]];
            if (levelItem) item = levelItem;
        }
        return item?.content;
    });
    return content;
}

interface FrameProps {
    children: React.ReactNode;
}

export function FrameContainer({ children }: FrameProps) {
    return <div className="flex flex-col gap-4 py-4">{children}</div>;
}

export function FrameHeader({ children }: FrameProps) {
    return <div className="flex flex-col gap-2">{children}</div>;
}

export function FrameDescription({ children }: FrameProps) {
    return <p className="text-muted-foreground text-sm">{children}</p>;
}
