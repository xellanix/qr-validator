import { useProjectStore } from "@/stores/project.store";
import { OnlyBackFooter, OnlyCloseFooter } from "@/components/dialogs/projects/shared/footer";

export function Footer() {
    const activePage = useProjectStore((s) => s.generatedContents?.activePage);

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
        <OnlyCloseFooter onCancel={() => useProjectStore.setState({ generatedContents: null })} />
    );
}
