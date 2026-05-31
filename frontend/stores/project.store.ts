import type { ZodType } from "zod";
import type { Dataset, DatasetKey } from "@/types";
import type { EditedProject, Project, SchemaObjectSortable } from "@/types/project";
import { toast } from "sonner";
import { string } from "zod";
import { create } from "zustand";
import { createSingletonAsyncLoader, getBackendUrl } from "@/lib/utils";
import { UniqueIdGenerator } from "@/generators/uid";
import { INPUT_SCHEMAS } from "@/registry/input-schema";

interface EditMetadata {
    activePage: string;
    projectId: string | null;
    data: EditedProject | null;
}

interface ProjectState {
    projects: Record<string, Project>;
    activeId: string | null;

    edit: EditMetadata;
}

interface ProjectActions {
    getProject: (id?: string | null) => Project | null;

    initDataset: (id?: string | null) => Promise<void>;

    activeProject: () => Project | null;
    activeColumnKeys: () => DatasetKey[];
    activeSchema: () => ZodType<string>;

    setActivePage: (page: string) => void;
    startEdit: (id: string) => void;
    applyEdit: () => void;
    resetEdit: () => void;

    updateEditSchema: (
        schemas?:
            | SchemaObjectSortable[]
            | ((prev: SchemaObjectSortable[]) => SchemaObjectSortable[]),
    ) => void;
}

type ProjectStore = ProjectState & ProjectActions;

// Singleton
// Ensures that an expensive async function is only ever executed once
export const getDataset = createSingletonAsyncLoader(async (path: string, key: string) => {
    const url = new URL(`/api/assets/${encodeURIComponent(path)}?to-json`, getBackendUrl()).href;
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) toast.error("Failed to fetch dataset.");

    const json = await res.json();
    const map = new Map<string, Dataset>();
    for (const row of json) {
        map.set(row[key], row);
    }

    return map;
});

const schemaObjectsToZod = (schemas: SchemaObjectSortable[]): ZodType<string> => {
    let zodString: ZodType<string> = string();
    for (const schema of schemas) {
        if (!(schema.type in INPUT_SCHEMAS)) continue;

        zodString = INPUT_SCHEMAS[schema.type as keyof typeof INPUT_SCHEMAS].builder(
            zodString,
            schema.value,
        );
    }
    return zodString;
};

export const useProjectStore = create<ProjectStore>((set, get) => ({
    projects: {
        "fa56a6eb-b343-41d7-8535-769c88fdafb0": {
            id: "fa56a6eb-b343-41d7-8535-769c88fdafb0",
            name: "ORKESS 4.0",

            datasetKey: "NIM",
            datasetKeyLabel: "NIM",
            datasetPath: "input/orkess4/db.csv",
            dataset: null,
            columns: {
                NIM: "text",
                Nama: "text",
                Prodi: "text",
                Email: "text",
            },
            columnKeys: ["NIM", "Nama", "Prodi", "Email"],
            schema: string().length(8),
            schemaObjects: [
                {
                    sortId: UniqueIdGenerator.nextNumeric(),
                    type: "length",
                    value: "8",
                },
            ],
        },
    },
    activeId: null,
    edit: {
        activePage: "1",
        projectId: null,
        data: null,
    },

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
            activeId: _id,
            projects: {
                ...s.projects,
                [_id!]: { ..._project, dataset },
            },
        }));
    },

    activeProject: () => get().getProject(),
    activeColumnKeys: () => get().activeProject()?.columnKeys ?? [],
    activeSchema: () => get().activeProject()?.schema ?? string(),

    setActivePage: (page) => set((s) => ({ edit: { ...s.edit, activePage: page } })),
    startEdit: (id) => {
        set((s) => {
            const data = s.projects[id];
            if (!data) return s;
            const { dataset, ...rest } = data;
            return {
                edit: { ...s.edit, activePage: "1", projectId: id, data: { ...rest } },
            };
        });
    },
    applyEdit: () => {
        set((s) => {
            const { projectId, data } = s.edit;
            if (!projectId || !data) return s;

            return {
                projects: {
                    ...s.projects,
                    [projectId]: { ...s.projects[projectId], ...data },
                },
                edit: { ...s.edit, activePage: "1", projectId: null, data: null },
            };
        });
    },
    resetEdit: () => {
        set((s) => ({ edit: { ...s.edit, activePage: "1", projectId: null, data: null } }));
    },

    updateEditSchema: (schemas) => {
        set((s) => {
            const { data } = s.edit;
            if (!data) return s;

            const schemaObjects =
                (schemas &&
                    (typeof schemas === "function" ? schemas(data.schemaObjects) : schemas)) ??
                data.schemaObjects;

            return {
                edit: {
                    ...s.edit,
                    data: { ...data, schema: schemaObjectsToZod(schemaObjects), schemaObjects },
                },
            };
        });
    },
}));
