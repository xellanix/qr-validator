import { useEffect } from "react";
import { io } from "socket.io-client";
import { tryAuthenticate } from "@/lib/auth";
import { useAppStore } from "@/stores/app.store";
import { useSocketStore } from "@/stores/socket.store";

export function SocketInitiator() {
    useEffect(() => {
        if (typeof window === "undefined") return;

        useAppStore.getState().setIsLoading(true);

        const { setSocket, setSocketId } = useSocketStore.getState();

        const origin = window.location.origin;
        let socketUrl = origin;

        // If we are accessing the Vite dev server locally or it's running in DEV mode,
        // point to the Bun backend port
        if (
            origin.includes("localhost:26052") ||
            origin.includes("127.0.0.1:26052") ||
            import.meta.env.DEV
        ) {
            socketUrl = "http://localhost:26051";
        }
        const newSocket = io(socketUrl, {
            path: "/api/socket_io",
            transports: ["websocket"],
        });
        setSocket(newSocket);

        newSocket.on("connect", async () => {
            setSocketId(newSocket.id!);
            console.log("✅ Connected to server");

            await tryAuthenticate();
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
    }, []);

    return null;
}
