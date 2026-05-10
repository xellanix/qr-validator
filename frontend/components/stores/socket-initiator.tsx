import { useEffect } from "react";
import { io } from "socket.io-client";
import { tryAuthenticate, tryInitUserData } from "@/lib/auth";
import { getBackendUrl } from "@/lib/utils";
import { useAppStore } from "@/stores/app.store";
import { useSocketStore } from "@/stores/socket.store";
import { useUserStore } from "@/stores/user.store";

export function SocketInitiator() {
    const isAuthenticated = useUserStore((s) => s.isAuthenticated);

    useEffect(() => {
        if (typeof window === "undefined") return;

        useAppStore.getState().setIsLoading(true);

        if (!isAuthenticated) {
            tryAuthenticate()
                .catch(console.error)
                .finally(() => useAppStore.getState().setIsLoading(false));
            return;
        }

        const { setSocket, setSocketId } = useSocketStore.getState();

        const newSocket = io(getBackendUrl(), {
            path: "/api/socket_io",
            transports: ["websocket"],
            withCredentials: true,
            autoConnect: true,
        });
        setSocket(newSocket);

        newSocket.on("connect", async () => {
            setSocketId(newSocket.id!);
            console.log("✅ Connected to server");

            await tryInitUserData();
            useAppStore.getState().setIsLoading(false);
        });

        newSocket.on("server:socket:device:info", (data) => {
            useSocketStore.setState({
                deviceName: data.name,
                isLocal: data.isTrulyLocal,
            });
        });

        newSocket.on("connect_error", (err) => {
            console.error("Socket connection error:", err);
            useAppStore.getState().setIsLoading(false);
        });

        newSocket.on("disconnect", () => {
            setSocketId(null);
            console.log("❌ Disconnected from server");
        });

        return () => {
            newSocket.disconnect();
        };
    }, [isAuthenticated]);

    return null;
}
