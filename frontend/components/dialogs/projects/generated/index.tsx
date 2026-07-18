import type { SidebarButtonProps } from "@/components/dialogs/projects/shared";
import { useProjectStore } from "@/stores/project.store";
import { Footer } from "@/components/dialogs/projects/generated/footer";
import { SidebarFrame } from "@/components/dialogs/projects/generated/frame";
import { NAVIGATION_LIST } from "@/components/dialogs/projects/generated/registry";
import { DialogContent } from "@/components/dialogs/projects/shared/root";
import { DefaultSidebarButton, DialogSidebar } from "@/components/dialogs/projects/shared/sidebar";
import { disableCloseExceptButton } from "@/components/dialogs/shared";
import { DialogTitle } from "@/components/ui/dialog";
import { SidebarProvider } from "@/components/ui/sidebar";

export function ProjectGeneratedContentsDialog() {
    return (
        <DialogContent
            showCloseButton={false}
            className="overflow-hidden p-0 max-md:size-full max-md:max-w-full! md:h-[80dvh] md:max-h-[80dvh] md:max-w-[80dvw] lg:max-w-[90dvw]"
            onEscapeKeyDown={disableCloseExceptButton}
            onPointerDownOutside={disableCloseExceptButton}
            onInteractOutside={disableCloseExceptButton}
        >
            <div className="flex flex-col overflow-hidden">
                <DialogTitle className="absolute opacity-0 select-none">
                    Generated Contents
                </DialogTitle>
                <SidebarProvider className="size-full min-h-0">
                    <DialogSidebar navs={NAVIGATION_LIST} ItemComponent={SidebarButton} />

                    <SidebarFrame />
                </SidebarProvider>
                <Footer />
            </div>
        </DialogContent>
    );
}

function SidebarButton({ nav }: SidebarButtonProps) {
    const isActive = useProjectStore(
        (s) => s.generatedContents?.activePage.split(".")[0] === nav.id,
    );
    const setActivePage = () => {
        useProjectStore.setState((s) => {
            const prev = s.generatedContents;
            if (!prev) return s;

            return { generatedContents: { ...prev, activePage: nav.id } };
        });
    };

    return <DefaultSidebarButton nav={nav} isActive={isActive} setActivePage={setActivePage} />;
}
