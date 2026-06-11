import { useEffect } from "react";
import { toast } from "sonner";
import { useProjectStore } from "@/stores/project.store";
import { useSocketStore } from "@/stores/socket.store";
import { useUserStore } from "@/stores/user.store";

export function Synchronizer() {
    const socket = useSocketStore((s) => s.socket);

    useEffect(() => {
        if (!socket) return;

        const { emit, on } = useSocketStore.getState();

        const fetchAll = useUserStore.getState().hasConsoleAccess();
        emit("client:project:init", { activation: true, projects: true, all: fetchAll });

        const [initOff] = on("server:project:init", ({ status, error, activeId, projects }) => {
            if (status === "error") return toast.error(error);
            void useProjectStore.getState().init(projects, activeId);
        });
        const [updateOff] = on("server:project:update", (id, project, changes) => {
            if (changes !== undefined) {
                if (changes === 0) {
                    toast.error("Failed to update project.");
                } else {
                    toast.success("Project updated.");
                }
            }
            void useProjectStore.getState().update(id, project);
        });
        const [toggleOff] = on("server:project:activation:toggle", (activeId) => {
            if (!fetchAll) {
                return emit("client:project:init", {
                    activation: true,
                    projects: true,
                    all: fetchAll,
                });
            }

            void useProjectStore.getState().toggleActivation(activeId);
        });

        return () => {
            initOff();
            updateOff();
            toggleOff();
        };
    }, [socket]);

    return null;
}
