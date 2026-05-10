import type { User } from "@/types";
import { toast } from "sonner";
import { getBackendUrl } from "@/lib/utils";
import { useSocketStore } from "@/stores/socket.store";
import { useUserStore } from "@/stores/user.store";

export const tryAuthenticate = async () => {
    try {
        const url = new URL("/auth/signin", getBackendUrl()).href;
        const res = await fetch(url, {
            method: "GET",
            credentials: "include",
        });

        useUserStore.getState().setIsAuthenticated(res.ok);
    } catch {
        useUserStore.getState().setIsAuthenticated(false);
    }
};

export const tryInitUserData = async () => {
    const res = await useSocketStore.getState().emitAck<User>("client:auth:sync");
    if (!res) return signOut();

    useUserStore.getState().setUser(res);
};

export const signIn = async (userId: string) => {
    if (!userId.trim()) {
        toast.error("Please enter a valid access token.");
        return;
    }

    const url = new URL("/auth/signin", getBackendUrl()).href;
    const res = await fetch(url, {
        method: "POST",
        body: JSON.stringify({ userId }),
        headers: { "Content-Type": "application/json" },
        // This allows the browser to receive and store the HttpOnly cookie
        credentials: "include",
    });

    if (!res.ok) {
        // User not found
        toast.error("User not found.");
    }
    useUserStore.getState().setIsAuthenticated(res.ok);
};

export const signOut = async () => {
    const url = new URL("/auth/signout", getBackendUrl()).href;
    await fetch(url, { credentials: "include" });
    window.location.reload();
};
