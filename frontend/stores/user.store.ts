import type { User } from "@/types";
import type { Permissions } from "@/types/permission";
import { create } from "zustand";
import { getPermissions, readOnlyPermission } from "@/lib/permission";

interface UserState extends Permissions {
    user: User | null;
    isAuthenticated: boolean;
}

interface UserActions {
    setUser: (user: User | null) => void;
    setIsAuthenticated: (isAuthenticated: boolean) => void;

    hasConsoleAccess: () => boolean;
}

type UserStore = UserState & UserActions;

export const useUserStore = create<UserStore>((set, get) => ({
    user: null,
    isAuthenticated: false,
    ...readOnlyPermission,

    setUser: (user) => {
        const level = user?.authorizeLevel ?? 0;
        set({
            user,
            ...getPermissions(level),
        });
    },
    setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),

    hasConsoleAccess: () => {
        if (typeof window === "undefined") return false;
        if (!window.location.pathname.startsWith("/console")) return false;

        const host = window.location.host;
        const port = import.meta.env.DEV ? "26052" : "26051";
        if (!(host === `localhost:${port}` || host === `127.0.0.1:${port}`)) {
            return false;
        }

        return get().canAccessConsole;
    },
}));
