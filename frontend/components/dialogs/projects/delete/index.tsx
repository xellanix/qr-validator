import { toast } from "sonner";
import { useProjectStore } from "@/stores/project.store";
import { useSocketStore } from "@/stores/socket.store";
import { useCallbackLock } from "@/hooks/use-callback-lock";
import { Button } from "@/components/ui/button";
import {
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export function ProjectDeleteDialog({ setOpenDialog }: { setOpenDialog: (v: boolean) => void }) {
    const projectName = useProjectStore((s) => s.deleteId && s.projects[s.deleteId]?.name);

    const { invoke, isLocked } = useCallbackLock(async () => {
        const emitAck = useSocketStore.getState().emitAck<boolean>;
        const res = await emitAck("client:project:delete", useProjectStore.getState().deleteId);
        if (res === undefined) return;

        setOpenDialog(false);

        if (res) toast.success("Project deleted.");
        else toast.error("Failed to delete project.");
    });

    return (
        <DialogContent showCloseButton={false}>
            <DialogHeader>
                <DialogTitle>Delete Project</DialogTitle>
                <DialogDescription>
                    Are you sure you want to delete this project (
                    <b className="font-semibold">{projectName}</b>)? This action cannot be undone.
                </DialogDescription>
            </DialogHeader>

            <DialogFooter className="flex-row justify-end">
                <DialogClose asChild>
                    <Button variant="outline" disabled={isLocked}>
                        Cancel
                    </Button>
                </DialogClose>
                <Button type="submit" variant={"destructive"} onClick={invoke} disabled={isLocked}>
                    Delete
                </Button>
            </DialogFooter>
        </DialogContent>
    );
}
