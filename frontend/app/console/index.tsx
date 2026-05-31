import { useUserStore } from "@/stores/user.store";
import { ActiveProject, AllProjects } from "@/components/console";

export default function ConsolePage() {
    if (!useUserStore.getState().hasConsoleAccess()) {
        return null;
    }

    return (
        <div className="flex flex-col size-full overflow-hidden">
            <div className="flex flex-col overflow-hidden p-1 -m-1 flex-1 gap-4">
                <ActiveProject />
                <AllProjects />
            </div>
        </div>
    );
}
