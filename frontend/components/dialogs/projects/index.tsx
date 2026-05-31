import { ArrowDown01Icon, Delete03Icon, Edit03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMemo, useState } from "react";
import { useProjectStore } from "@/stores/project.store";
import { Footer } from "@/components/dialogs/projects/edit/footer";
import { SidebarFrame } from "@/components/dialogs/projects/edit/frame";
import { DialogSidebar } from "@/components/dialogs/projects/edit/sidebar";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarProvider } from "@/components/ui/sidebar";

export function ProjectMoreButton({ id }: { id: string }) {
    const [openDialog, setOpenDialog] = useState(false);
    const [dialogType, setDialogType] = useState<"edit" | "delete">("edit");

    const dialogContent = useMemo(() => {
        return dialogType === "edit" ? (
            <ProjectEditDialog setOpenDialog={setOpenDialog} />
        ) : (
            <ProjectDeleteDialog />
        );
    }, [dialogType]);

    const editProject = () => {
        useProjectStore.getState().startEdit(id);
        setDialogType("edit");
    };

    return (
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon-xs">
                        <HugeiconsIcon icon={ArrowDown01Icon} />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="min-w-36" side="bottom" align="end">
                    <DialogTrigger asChild>
                        <DropdownMenuItem className="gap-2" onSelect={editProject}>
                            <HugeiconsIcon icon={Edit03Icon} />
                            Edit
                        </DropdownMenuItem>
                    </DialogTrigger>
                    <DropdownMenuSeparator />
                    <DialogTrigger asChild>
                        <DropdownMenuItem
                            variant={"destructive"}
                            className="gap-2"
                            onSelect={() => setDialogType("delete")}
                        >
                            <HugeiconsIcon icon={Delete03Icon} />
                            Delete
                        </DropdownMenuItem>
                    </DialogTrigger>
                </DropdownMenuContent>
            </DropdownMenu>
            {dialogContent}
        </Dialog>
    );
}

const disableCloseExceptButton = (event: Event) => {
    event.preventDefault();
};

function ProjectEditDialog({ setOpenDialog }: { setOpenDialog: (v: boolean) => void }) {
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
                    Project Configurations
                </DialogTitle>
                <SidebarProvider className="size-full min-h-0">
                    <DialogSidebar />

                    <SidebarFrame />
                </SidebarProvider>
                <Footer setOpenDialog={setOpenDialog} />
            </div>
        </DialogContent>
    );
}

function ProjectDeleteDialog() {
    return (
        <DialogContent
            showCloseButton={false}
            onEscapeKeyDown={disableCloseExceptButton}
            onPointerDownOutside={disableCloseExceptButton}
            onInteractOutside={disableCloseExceptButton}
        >
            <DialogHeader>
                <DialogTitle>Delete</DialogTitle>
                <DialogDescription>
                    Set up your admin account to launch projects, record presence, and manage the
                    team permissions.
                </DialogDescription>
            </DialogHeader>

            <DialogFooter className="flex-row justify-end">
                <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit">Create Admin Account</Button>
            </DialogFooter>
        </DialogContent>
    );
}
