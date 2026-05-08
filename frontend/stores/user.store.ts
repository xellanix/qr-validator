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
}

type UserStore = UserState & UserActions;

export const useUserStore = create<UserStore>((set) => ({
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
}));
