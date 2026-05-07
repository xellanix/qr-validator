import type { DatasetValue } from "@/types";
import { create } from "zustand";

interface ValidateState {
    candidate: DatasetValue | null;
}

interface ValidateActions {
    setCandidate: (candidate: DatasetValue | null) => void;
}

type ValidateStore = ValidateState & ValidateActions;

export const useValidateStore = create<ValidateStore>()((set) => ({
    candidate: "",

    setCandidate: (candidate) => set({ candidate: candidate }),
}));
