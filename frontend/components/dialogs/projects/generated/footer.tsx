import { useCallback } from "react";
import { useProjectStore } from "@/stores/project.store";
import { DefaultFooter, OnlyBackFooter } from "@/components/dialogs/projects/shared/footer";

export function Footer({ setOpenDialog }: { setOpenDialog: (v: boolean) => void }) {
    const activePage = useProjectStore((s) => s.generatedContents?.activePage);

    const save = useCallback(() => {
        // useProjectStore.getState().applyEdit();
        setOpenDialog(false);
    }, [setOpenDialog]);

    if (!activePage) return null;

    const insideAnotherPages = activePage.split(".");
    if (insideAnotherPages.length > 1) {
        return (
            <OnlyBackFooter
                onBack={() => {
                    insideAnotherPages.pop();
                    useProjectStore.setState((s) => {
                        const prev = s.generatedContents;
                        if (!prev) return {};

                        return {
                            generatedContents: {
                                ...prev,
                                activePage: insideAnotherPages.join("."),
                            },
                        };
                    });
                }}
            />
        );
    }

    return (
        <DefaultFooter
            onCancel={() => useProjectStore.setState({ generatedContents: null })}
            onSave={save}
        />
    );
}
