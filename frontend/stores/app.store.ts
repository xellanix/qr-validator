import { create } from "zustand";

interface AppState {
    isLoading: boolean;
}

interface AppActions {
    setIsLoading: (isLoading: boolean) => void;
}

type AppStore = AppState & AppActions;

export const useAppStore = create<AppStore>((set) => ({
    isLoading: true,

    setIsLoading: (isLoading) => set({ isLoading }),
}));
