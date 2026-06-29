import { useCallback } from "react";
import { useProjectStore } from "@/stores/project.store";
import { DefaultFooter, OnlyBackFooter } from "@/components/dialogs/projects/shared/footer";

export function Footer({ setOpenDialog }: { setOpenDialog: (v: boolean) => void }) {
    const activePage = useProjectStore((s) => s.edit.activePage);

    const save = useCallback(() => {
        useProjectStore.getState().applyEdit();
        setOpenDialog(false);
    }, [setOpenDialog]);

    const insideAnotherPages = activePage.split(".");
    if (insideAnotherPages.length > 1) {
        return (
            <OnlyBackFooter
                onBack={() => {
                    insideAnotherPages.pop();
                    useProjectStore.getState().setActivePage(insideAnotherPages.join("."));
                }}
            />
        );
    }

    return <DefaultFooter onCancel={useProjectStore.getState().resetEdit} onSave={save} />;
}
