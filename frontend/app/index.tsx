import { Link } from "react-router-dom";
import { useProjectStore } from "@/stores/project.store";
import { useUserStore } from "@/stores/user.store";
import { HomePageTabs } from "@/components/core/tabs";
import { Synchronizer } from "@/components/history";
import { Button } from "@/components/ui/button";
import { EmptyProject } from "@/app/_components/empty";

export default function HomePage() {
    if (useProjectStore((s) => !s.activeId)) return <EmptyProject2 />;

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
function EmptyProject2() {
    const level = useUserStore((s) => s.user?.authorizeLevel ?? 0);

    return (
        <EmptyProject title={"No Active Project"} description={levelToEmpty(level)}>
            {level === 3 && (
                <Button asChild>
                    <Link to="/console">Activate a Project</Link>
                </Button>
            )}
        </EmptyProject>
    );
}
