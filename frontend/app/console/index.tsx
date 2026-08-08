import { useRef } from "react";
import { useProjectStore } from "@/stores/project.store";
import { useUserStore } from "@/stores/user.store";
import { ActiveProject, AllProjects } from "@/components/console";
import { NewProjectButton } from "@/components/dialogs/projects/add";
import { Button } from "@/components/ui/button";
import { EmptyProject } from "@/app/_components/empty";

export default function ConsolePage() {
    if (!useUserStore.getState().hasConsoleAccess()) {
        return null;
    }

    return <ConsolePageContent />;
}

const isEmptyRecord = <T,>(obj: Record<string, T>) => {
    for (const key in obj) {
        if (Object.hasOwn(obj, key)) {
            return false;
        }
    }

    return true;
};

function ConsolePageContent() {
    const startedFromEmpty = useRef(false);
    const isEmpty = useProjectStore((s) => {
        const noProjects = isEmptyRecord(s.projects);
        const isDialogOpen = s.newProject !== null;
        if (isDialogOpen && noProjects) startedFromEmpty.current = true;
        else if (!isDialogOpen) startedFromEmpty.current = false;
        return noProjects || startedFromEmpty.current;
    });

    if (isEmpty) {
        return (
            <EmptyProject
                title={"No Projects Available"}
                description={"Get started by creating a new project."}
            >
                <NewProjectButton>
                    <Button>Create Project</Button>
                </NewProjectButton>
            </EmptyProject>
        );
    }

    return (
        <div className="flex flex-col size-full overflow-hidden">
            <div className="flex flex-col overflow-hidden p-1 -m-1 pt-1.25 flex-1 gap-4">
                <ActiveProject />
                <AllProjects />
            </div>
        </div>
    );
}
