import type { ZodType } from "zod";
import type { DatasetRow, DatasetRowKey } from "~/types/dataset";
import type { ProjectWithDataset } from "~/types/project";
import type { ProjectItem, SchemaObjectSortable } from "@/types/project";
import { string } from "zod";
import { create } from "zustand";
import { createSingletonAsyncLoader } from "@/lib/utils";
import { useSocketStore } from "@/stores/socket.store";
import { UniqueIdGenerator } from "@/generators/uid";
import { INPUT_SCHEMAS } from "@/registry/input-schema";

interface EditMetadata {
    activePage: string;
    projectId: string | null;
    data: ProjectItem | null;
}

interface ProjectState {
    projects: Record<string, ProjectItem>;
    /**
     * The dataset loaded from the datasetPath.
     * @remarks Never set this value directly, use the `initDataset` action instead.
     * @see {@link DatasetRow}
     */
    dataset: Map<string, DatasetRow> | null;
    activeId: string | null;

    edit: EditMetadata;
    deleteId: string | null;
}

interface ProjectActions {
    init: (projects: Record<string, ProjectWithDataset>, id?: string | null) => void;
    update: (id: string, project: Partial<ProjectItem>) => void;
    toggleActivation: (id: string | null, newProjects?: Record<string, ProjectWithDataset>) => void;

    getProject: (id?: string | null) => ProjectItem | null;

    initDataset: (id?: string | null) => Promise<void>;

    activeProject: () => ProjectItem | null;
    activeColumnKeys: () => DatasetRowKey[];
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

    deleteProject: () => void;
}

type ProjectStore = ProjectState & ProjectActions;

// Singleton
// Ensures that an expensive async function is only ever executed once
export const getDataset = createSingletonAsyncLoader(
    async (projectId: ProjectItem["id"], key: string) => {
        if (projectId.trim().length === 0) return null;

        const emitAck = useSocketStore.getState().emitAck<(DatasetRow | null)[]>;
        const rows = await emitAck("client:dataset:row:all", projectId);

        if (!rows) return null;

        const map = new Map<string, DatasetRow>();
        for (const row of rows) {
            if (!row) continue;
            map.set(row[key], row);
        }

        return map;
    },
);

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

const serverToFrontend = (projects: Record<string, ProjectWithDataset>) => {
    const _ps: Record<string, Record<string, unknown>> = {};
    for (const k in projects) {
        if (!Object.hasOwn(projects, k)) continue;
        _ps[k] = projects[k];
        const schemas: SchemaObjectSortable[] = [];
        for (const s of projects[k].schemaObjects) {
            const _s: Record<string, unknown> = s;
            _s.sortId = UniqueIdGenerator.nextNumeric();
            schemas.push(_s as SchemaObjectSortable);
        }
        _ps[k].columnKeys = Object.keys(projects[k].columns);
        _ps[k].schemaObjects = schemas;
        _ps[k].schema = schemaObjectsToZod(schemas);
    }
    console.log(_ps);
    return _ps as Record<string, ProjectItem>;
};

const updateServerProject = (project: ProjectItem, prev: ProjectItem) => {
    const projectsKeys: (keyof ProjectItem)[] = ["name", "datasetId", "schemaObjects"];
    const datasetsKeys: (keyof ProjectItem)[] = ["key", "keyLabel", "columns"];

    const projectsPayload: Record<string, unknown> = {};
    const datasetsPayload: Record<string, unknown> = {};
    for (const k of projectsKeys) {
        if (project[k] !== prev[k]) {
            projectsPayload[k] = project[k];
        }
    }

    for (const k of datasetsKeys) {
        if (project[k] !== prev[k]) {
            datasetsPayload[k] = project[k];
        }
    }

    useSocketStore
        .getState()
        .emit(
            "client:project:update",
            project.id,
            project.datasetId,
            projectsPayload,
            datasetsPayload,
        );
};

export const useProjectStore = create<ProjectStore>((set, get) => ({
    projects: {},
    dataset: null,
    activeId: null,
    edit: {
        activePage: "1",
        projectId: null,
        data: null,
    },
    deleteId: null,

    init: (_projects, id = get().activeId) => {
        const projects = serverToFrontend(_projects);
        set({ projects, activeId: id });
    },
    update: (id, project) => {
        set((s) => {
            if (project.columns) project.columnKeys = Object.keys(project.columns);
            if (project.schemaObjects) project.schema = schemaObjectsToZod(project.schemaObjects);

            return {
                projects: {
                    ...s.projects,
                    [id]: { ...s.projects[id], ...project },
                },
            };
        });
    },
    toggleActivation: (id, newProjects) => {
        if (!newProjects) return set({ activeId: id });

        const projects = serverToFrontend(newProjects);
        set({ projects, activeId: id });
    },

    getProject: (id = get().activeId) => (id && get().projects[id]) || null,

    initDataset: async (id = get().activeId) => {
        const project = get().getProject(id);
        if (!project) return;

        const dataset = await getDataset(project.id, project.key);
        set({ dataset });
    },

    activeProject: () => get().getProject(),
    activeColumnKeys: () => get().activeProject()?.columnKeys ?? [],
    activeSchema: () => get().activeProject()?.schema ?? string(),

    setActivePage: (page) => set((s) => ({ edit: { ...s.edit, activePage: page } })),
    startEdit: (id) => {
        set((s) => {
            const data = s.projects[id];
            if (!data) return s;
            return {
                edit: { ...s.edit, activePage: "1", projectId: id, data: { ...data } },
            };
        });
    },
    applyEdit: () => {
        set((s) => {
            const { projectId, data } = s.edit;
            if (!projectId || !data) return s;

            const prev = s.projects[projectId];
            updateServerProject(data, prev);

            return {
                projects: {
                    ...s.projects,
                    [projectId]: { ...prev, ...data },
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

    deleteProject: () => {
        set((s) => {
            if (!s.deleteId) return s;

            const { [s.deleteId]: _, ...projects } = s.projects;
            return {
                deleteId: null,
                projects,
            };
        });
    },
}));
