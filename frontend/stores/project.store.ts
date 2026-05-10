import type { ZodString } from "zod";
import type { DataContentType, Dataset, DatasetKey } from "@/types";
import { toast } from "sonner";
import { string } from "zod";
import { create } from "zustand";
import { createSingletonAsyncLoader, getBackendUrl } from "@/lib/utils";

interface Project {
    inputKey: DatasetKey;
    datasetKey: DatasetKey;
    datasetPath: string;

    dataset: Map<string, Dataset> | null;
    contentType: DataContentType;
    typeKeys: DatasetKey[];
    schema: ZodString;
}

interface ProjectState {
    projects: Project[];
    activeIndex: number;
}

interface ProjectActions {
    getProject: (index?: number) => Project | null;

    initDataset: (index?: number) => Promise<void>;

    activeProject: () => Project | null;
    activeTypeKeys: () => DatasetKey[];
    activeSchema: () => ZodString;
}

type ProjectStore = ProjectState & ProjectActions;

// Singleton
// Ensures that an expensive async function is only ever executed once
export const getDataset = createSingletonAsyncLoader(async (path: string, key: string) => {
    const url = new URL(`/api/assets/${encodeURIComponent(path)}?to-json`, getBackendUrl()).href;
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) toast.error("Failed to fetch dataset.");

    const json = await res.json();
    const map = new Map<string, Record<string, string>>();
    for (const row of json) {
        map.set(row[key], row);
    }

    return map;
});

export const useProjectStore = create<ProjectStore>((set, get) => ({
    projects: [
        {
            inputKey: "NIM",
            datasetKey: "NIM",
            datasetPath: "input/orkess4/db.csv",
            dataset: null,
            typeKeys: ["NIM", "Nama", "Prodi", "Email"],
            contentType: {
                NIM: "text",
                Nama: "text",
                Prodi: "text",
                Email: "text",
            },
            schema: string().min(8).max(8),
        },
    ],
    activeIndex: 0,

    getProject: (index) => {
        const { projects, activeIndex } = get();
        const _index = index ?? activeIndex;

        if (_index < 0 || _index >= projects.length) return null;
        return projects[_index];
    },

    initDataset: async (index) => {
        const { activeIndex, getProject } = get();
        const _index = index ?? activeIndex;
        const project = getProject(_index);
        if (!project) return;
        const { datasetPath, datasetKey } = project;

        const dataset = await getDataset(datasetPath, datasetKey);

        set((s) => ({
            activeIndex: _index,
            projects: s.projects.map((p, i) => (i === _index ? { ...p, dataset } : p)),
        }));
    },

    activeProject: () => get().getProject(),
    activeTypeKeys: () => get().activeProject()?.typeKeys ?? [],
    activeSchema: () => get().activeProject()?.schema ?? string(),
}));
