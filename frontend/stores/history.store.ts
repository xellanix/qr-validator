import type { ScanEntry } from "@/types";
import { create } from "zustand";

interface HistoryState {
    entries: ScanEntry[];
}

interface HistoryActions {
    setEntries: (entries: ScanEntry[]) => void;
}

type HistoryStore = HistoryState & HistoryActions;

export const useHistoryStore = create<HistoryStore>((set) => ({
    entries: [],

    setEntries: (entries) => set({ entries }),
}));
