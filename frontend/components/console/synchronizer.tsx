import { useEffect } from "react";
import { toast } from "sonner";
import { useProjectStore } from "@/stores/project.store";
import { useSocketStore } from "@/stores/socket.store";
import { useUserStore } from "@/stores/user.store";
import { MAX_STEP_INDEX } from "@/components/dialogs/projects/add/registry";
import { UniqueIdGenerator } from "@/generators/uid";

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
        const [addOff] = on("server:project:add", (project, success: boolean) => {
            if (!fetchAll) return;

            if (success) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                project.schemaObjects = project.schemaObjects.map((o: any) => ({
                    ...o,
                    sortId: UniqueIdGenerator.nextNumeric(),
                }));
                void useProjectStore.getState().add(project);
            }

            useProjectStore.setState((prev) => {
                const p = prev.newProject;
                if (!p) return prev;

                const activePageIndex = Math.min(
                    Math.max(0, p.activePageIndex + 1),
                    MAX_STEP_INDEX,
                );

                let isSuccess = p.isSuccess;
                if (!success) {
                    const msg = "Unknown error occurred while creating project.";
                    if (typeof isSuccess === "string") {
                        isSuccess += "\n\n" + msg;
                    } else {
                        isSuccess = msg;
                    }
                }

                return { newProject: { ...p, activePageIndex, isSuccess } };
            });
        });
        const [updateOff] = on("server:project:update", (id, project, changes) => {
            if (changes !== undefined) {
                if (changes === 0) {
                    toast.error("Failed to update project.");
                } else {
                    toast.success("Project updated.");
                }
            }
            if (id !== useProjectStore.getState().activeId) return;
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
            addOff();
            updateOff();
            toggleOff();
        };
    }, [socket]);

    return null;
}
