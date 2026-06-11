import { useCallback } from "react";
import { useProjectStore } from "@/stores/project.store";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";

export function Footer({ setOpenDialog }: { setOpenDialog: (v: boolean) => void }) {
    const activePage = useProjectStore((s) => s.edit.activePage);

    const save = useCallback(() => {
        useProjectStore.getState().applyEdit();
        setOpenDialog(false);
    }, [setOpenDialog]);

    const insideAnotherPages = activePage.split(".");
    if (insideAnotherPages.length > 1) {
        return (
            <DialogFooter className="flex-row justify-end p-6">
                <Button
                    onClick={() => {
                        insideAnotherPages.pop();
                        useProjectStore.getState().setActivePage(insideAnotherPages.join("."));
                    }}
                >
                    Back
                </Button>
            </DialogFooter>
        );
    }

    return (
        <DialogFooter className="flex-row justify-end p-6">
            <DialogClose asChild>
                <Button variant={"outline"} onClick={useProjectStore.getState().resetEdit}>
                    Cancel
                </Button>
            </DialogClose>
            <Button onClick={save}>Save</Button>
        </DialogFooter>
    );
}
