import {
    Archive02Icon,
    ArrowDown01Icon,
    Delete03Icon,
    Edit03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMemo, useState } from "react";
import { useProjectStore } from "@/stores/project.store";
import { ProjectDeleteDialog } from "@/components/dialogs/projects/delete";
import { ProjectEditDialog } from "@/components/dialogs/projects/edit";
import { ProjectGeneratedContentsDialog } from "@/components/dialogs/projects/generated";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ProjectMoreButton({ id }: { id: string }) {
    const [openDialog, setOpenDialog] = useState(false);
    const [dialogType, setDialogType] = useState<"generated" | "edit" | "delete">("edit");

    const dialogContent = useMemo(() => {
        switch (dialogType) {
            case "delete":
                return <ProjectDeleteDialog setOpenDialog={setOpenDialog} />;
            case "edit":
                return <ProjectEditDialog setOpenDialog={setOpenDialog} />;
            case "generated":
            default:
                return <ProjectGeneratedContentsDialog setOpenDialog={setOpenDialog} />;
        }
    }, [dialogType]);

    const generatedContents = () => {
        useProjectStore.setState((s) => ({
            generatedContents: {
                activePage: "1",
                projectId: id,
                datasetKey: s.projects[id].key,
                presences: [],
            },
        }));
        setDialogType("generated");
    };

    const editProject = () => {
        useProjectStore.getState().startEdit(id);
        setDialogType("edit");
    };

    const deleteProject = () => {
        useProjectStore.setState({ deleteId: id });
        setDialogType("delete");
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
                        <DropdownMenuItem className="gap-2" onSelect={generatedContents}>
                            <HugeiconsIcon icon={Archive02Icon} />
                            Generated Contents
                        </DropdownMenuItem>
                    </DialogTrigger>
                    <DropdownMenuSeparator />
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
                            onSelect={deleteProject}
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
