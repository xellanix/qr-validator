import type { Result } from "@/types";
import { type Socket } from "socket.io-client";
import { toast } from "sonner";
import { create } from "zustand";

interface SocketState {
    socket: Socket | null;
    socketId: string | null;
    isLocal: boolean;
    deviceName: string | null;
}

interface SocketActions {
    setSocket: (socket: Socket | null) => void;
    setSocketId: (socketId: string | null) => void;
    setLocal: (isLocal: boolean) => void;
    setDeviceName: (deviceName: string | null) => void;

    emit: (event: string, ...args: unknown[]) => void;
    emitAck: <T>(event: string, ...args: unknown[]) => Promise<T | undefined>;
}

type SocketStore = SocketState & SocketActions;

export const useSocketStore = create<SocketStore>((set, get) => ({
    socket: null,
    socketId: null,
    isLocal: false,
    deviceName: null,

    setSocket: (socket) => set({ socket }),
    setSocketId: (socketId) => set({ socketId }),
    setLocal: (isLocal) => set({ isLocal }),
    setDeviceName: (deviceName) => set({ deviceName }),

    emit: (event, ...args) => get().socket?.emit(event, ...args),
    emitAck: async <T>(event: string, ...args: unknown[]) => {
        try {
            const socket = get().socket;
            if (!socket) throw new Error("No socket available.");
            const res = (await socket.timeout(5000).emitWithAck(event, ...args)) as Result<T>;
            if (res.status === "error") {
                throw new Error(res.error, { cause: "500" });
            } else if (res.status === "info") {
                toast.info(res.message);
                return;
            }

            return res.data;
        } catch (err) {
            // Timeout, disconnection, or server-side error
            if (get().socketId === null) {
                toast.error("Connection lost. Try reconnecting.");
            } else if (err instanceof Error && err.cause === "500") {
                toast.error(err.message);
            }

            console.error(err);
        }
    },
}));
