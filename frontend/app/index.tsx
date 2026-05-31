import { Link } from "react-router-dom";
import { useProjectStore } from "@/stores/project.store";
import { useUserStore } from "@/stores/user.store";
import { HomePageTabs } from "@/components/core/tabs";
import { Synchronizer } from "@/components/history";
import { Button } from "@/components/ui/button";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "@/components/ui/empty";

export default function HomePage() {
    if (useProjectStore((s) => !s.activeId)) return <EmptyProject />;

    return (
        <>
            <Synchronizer />
            <HomePageTabs />
        </>
    );
}

const levelToEmpty = (level: number) => {
    switch (level) {
        case 3:
            return "Activate a project in the console page, so you and your team can start scanning, viewing history, or generating reports.";
        case 2:
            return "Please ask your admin to activate a project to start scanning, viewing history, or generating reports.";
        case 1:
            return "Please ask your admin to activate a project to start scanning or viewing history.";
        case 0:
        default:
            return "Please ask your admin to activate a project to view history.";
    }
};
function EmptyProject() {
    const level = useUserStore((s) => s.user?.authorizeLevel ?? 0);

    return (
        <div className="flex flex-col size-full overflow-hidden">
            <div className="flex flex-col overflow-hidden p-1 -m-1 pt-1.25 flex-1 gap-4">
                <Empty className="bg-card text-card-foreground rounded-2xl ring-1 ring-border">
                    <EmptyHeader>
                        <EmptyTitle>No Active Project</EmptyTitle>
                        <EmptyDescription>{levelToEmpty(level)}</EmptyDescription>
                    </EmptyHeader>
                    {level === 3 && (
                        <EmptyContent>
                            <Button asChild>
                                <Link to="/console">Activate a Project</Link>
                            </Button>
                        </EmptyContent>
                    )}
                </Empty>
            </div>
        </div>
    );
}
