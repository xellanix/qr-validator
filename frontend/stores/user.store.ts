import type { User } from "@/types";
import { create } from "zustand";

interface UserState {
    user: User | null;
    canScan: boolean;
    canReport: boolean;
    canDelete: boolean;
    isAuthenticated: boolean;
}

interface UserActions {
    setUser: (user: User | null) => void;

    hasConsoleAccess: () => boolean;
}

type UserStore = UserState & UserActions;

export const useUserStore = create<UserStore>((set, get) => ({
    user: null,
    canScan: false,
    canReport: false,
    canDelete: false,
    isAuthenticated: false,

    setUser: (user) => {
        const level = user?.authorizeLevel ?? 0;
        set({
            user,
            canScan: level >= 1,
            canReport: level >= 2,
            canDelete: level >= 2,
            isAuthenticated: !!user,
        });
    },

    hasConsoleAccess: () => {
        if (typeof window === "undefined") return false;

        const href = window.location.href;
        const port = import.meta.env.DEV ? "26052" : "26051";
        if (
            !(
                href.endsWith(`localhost:${port}/console`) ||
                href.endsWith(`127.0.0.1:${port}/console`)
            )
        ) {
            return false;
        }

        const level = get().user?.authorizeLevel ?? 0;
        if (level < 2) return false;

        return true;
    },
}));
