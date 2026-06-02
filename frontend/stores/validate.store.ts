import type { DatasetRowValue } from "~/types/dataset";
import { create } from "zustand";

interface ValidateState {
    candidate: DatasetRowValue | null;
}

interface ValidateActions {
    setCandidate: (candidate: DatasetRowValue | null) => void;
}

type ValidateStore = ValidateState & ValidateActions;

export const useValidateStore = create<ValidateStore>()((set) => ({
    candidate: "",

    setCandidate: (candidate) => set({ candidate: candidate }),
}));
