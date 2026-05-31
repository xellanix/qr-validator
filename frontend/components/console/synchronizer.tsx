import { useEffect } from "react";
import { useProjectStore } from "@/stores/project.store";
import { useSocketStore } from "@/stores/socket.store";

export function Synchronizer() {
    const socket = useSocketStore((s) => s.socket);
    useEffect(() => {
        if (!socket) return;

        useSocketStore.getState().emit("client:project:activation:init");
        const [toggleOff] = useSocketStore
            .getState()
            .on("server:project:activation:toggle", (activeId: string | null) => {
                void useProjectStore.getState().initDataset(activeId);
            });

        return () => {
            toggleOff();
        };
    }, [socket]);

    return null;
}
