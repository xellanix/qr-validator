import { useMemo } from "react";
import { useProjectStore } from "@/stores/project.store";
import { NAVIGATION_LOOKUP } from "@/components/dialogs/projects/generated/registry";
import { BreadcrumbPair } from "@/components/dialogs/projects/shared/frame";
import { Breadcrumb, BreadcrumbList } from "@/components/ui/breadcrumb";
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
            <section className="flex size-full flex-col overflow-y-auto px-4 has-data-[slot=tabs]:overflow-hidden has-data-[slot=tabs]:*:size-full">
                <SidebarFrameContent />
            </section>
        </main>
    );
}

function SidebarFrameBreadcrumb() {
    const activePage = useProjectStore((s) => s.generatedContents?.activePage);

    const breadcrumbs = useMemo(() => {
        const res = ["Generated Contents"];
        if (!activePage) return res;

        const levels = activePage.split(".");
        let item = NAVIGATION_LOOKUP[levels[0]];
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

function SidebarFrameContent() {
    const content = useProjectStore((s) => {
        const levels = s.generatedContents?.activePage.split(".");
        if (!levels) return null;
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
