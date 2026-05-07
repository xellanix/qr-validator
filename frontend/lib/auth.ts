import type { User } from "@/types";
import { useAppStore } from "@/stores/app.store";
import { useSocketStore } from "@/stores/socket.store";
import { useUserStore } from "@/stores/user.store";

const AUTH_TOKEN_KEY = "qr-validator-auth-token";

export const tryAuthenticate = async () => {
    const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
    if (storedToken) {
        console.log("Found stored token. Attempting to authenticate...");
        const res = await useSocketStore
            .getState()
            .emitAck<User>("client:auth:authenticate", storedToken);

        if (res) {
            console.log("Auto-authentication successful.");
            useUserStore.getState().setUser(res);
        } else {
            console.log("Stored token is invalid. Clearing...");
            localStorage.removeItem(AUTH_TOKEN_KEY);
        }

        useAppStore.getState().setIsLoading(false);
    } else {
        useAppStore.getState().setIsLoading(false);
    }
};

export const signIn = (authedUser: User, token: string) => {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    useUserStore.getState().setUser(authedUser);
};

export const signOut = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    window.location.reload();
};
