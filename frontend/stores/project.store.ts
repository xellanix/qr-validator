import type { ZodString } from "zod";
import type { DataContentType, Dataset, DatasetKey } from "@/types";
import { toast } from "sonner";
import { string } from "zod";
import { create } from "zustand";
import { createSingletonAsyncLoader, getBackendUrl } from "@/lib/utils";

interface Project {
    id: string;
    name: string;

    inputKey: DatasetKey;
    datasetKey: DatasetKey;
    datasetPath: string;

    dataset: Map<string, Dataset> | null;
    contentType: DataContentType;
    typeKeys: DatasetKey[];
    schema: ZodString;
}

interface ProjectState {
    projects: Record<string, Project>;
    activeId: string | null;
}

interface ProjectActions {
    getProject: (id?: string | null) => Project | null;

    initDataset: (id?: string | null) => Promise<void>;

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
    projects: {
        "fa56a6eb-b343-41d7-8535-769c88fdafb0": {
            id: "fa56a6eb-b343-41d7-8535-769c88fdafb0",
            name: "ORKESS 4.0",

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
    },
    activeId: "fa56a6eb-b343-41d7-8535-769c88fdafb0",

    getProject: (id) => {
        const { projects, activeId } = get();
        const _id = id ?? activeId;
        return (_id && projects[_id]) || null;
    },

    initDataset: async (id) => {
        const { activeId, getProject } = get();
        const _id = id ?? activeId;
        const _project = getProject(_id);
        if (!_project) {
            set({ activeId: null });
            return;
        }
        const { datasetPath, datasetKey } = _project;

        const dataset = await getDataset(datasetPath, datasetKey);

        set((s) => ({
            activeId: id,
            projects: {
                ...s.projects,
                [_id!]: { ..._project, dataset },
            },
        }));
    },

    activeProject: () => get().getProject(),
    activeTypeKeys: () => get().activeProject()?.typeKeys ?? [],
    activeSchema: () => get().activeProject()?.schema ?? string(),
}));
