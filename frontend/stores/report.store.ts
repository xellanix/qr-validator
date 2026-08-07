import { create } from "zustand";

interface ReportState {
    batch: number | string;
    defaultBatch: number;
    ext: string;
    grouped: boolean;
}

interface ReportActions {
    setBatch: (batch: number | string) => void;
    setDefaultBatch: (batch: number) => void;
    resetBatch: () => void;
    setExt: (ext: string) => void;
    setGrouped: (grouped: boolean) => void;
}

type ReportStore = ReportState & ReportActions;

export const useReportStore = create<ReportStore>()((set) => ({
    batch: 1,
    defaultBatch: 1,
    ext: "csv",
    grouped: true,

    setBatch: (batch) => set({ batch }),
    setDefaultBatch: (batch) => set({ defaultBatch: batch }),
    resetBatch: () => set((s) => ({ batch: s.defaultBatch })),
    setExt: (ext) => set({ ext }),
    setGrouped: (grouped) => set({ grouped }),
}));
