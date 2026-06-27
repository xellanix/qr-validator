import type { ZodType } from "zod";
import type { DatasetPayload, DatasetRow, DatasetRowKey } from "~/types/dataset";
import type { ProjectWithDataset } from "~/types/project";
import type { ProjectItem, SchemaObjectSortable } from "@/types/project";
import { string } from "zod";
import { create } from "zustand";
import { createSingletonAsyncLoader } from "@/lib/utils";
import { useSocketStore } from "@/stores/socket.store";
import { UniqueIdGenerator } from "@/generators/uid";
import { INPUT_SCHEMAS } from "@/registry/input-schema";

type PartialKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

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

    newProject: {
        activePageIndex: number;
        isSuccess: true | string;
        data: ProjectItem | null;
        nextHandler: ((prev: ProjectItem | null) => string)[];
        uploadedDataset:
            | (DatasetPayload & { datasetId: NonNullable<ProjectItem["datasetId"]> })
            | null;
        uploadedDatasetBuffer: File | null;
    } | null;
    edit: EditMetadata;
    deleteId: string | null;
}

interface ProjectActions {
    init: (projects: Record<string, ProjectWithDataset>, id?: string | null) => void;
    add: (project: PartialKeys<ProjectItem, "schema" | "columnKeys">) => void;
    update: (id: string, project: Partial<ProjectItem>) => void;
    delete: (id?: string) => void;
    toggleActivation: (id: string | null, newProjects?: Record<string, ProjectWithDataset>) => void;

    getProject: (id?: string | null) => ProjectItem | null;

    initDataset: (id?: string | null) => Promise<void>;

    activeProject: () => ProjectItem | null;
    activeColumnKeys: () => DatasetRowKey[];
    activeSchema: () => ZodType<string>;

    setActivePage: (page: string) => void;

    addNewProject: () => void;
    registerNextHandler: (
        handler: (prev: ProjectItem | null) => string,
    ) => (prev: ProjectItem | null) => string;
    removeNextHandler: (handler: (prev: ProjectItem | null) => string) => void;

    startEdit: (id: string) => void;
    applyEdit: () => void;
    resetEdit: () => void;

    updateNewProjectSchema: (
        schemas: (prev: SchemaObjectSortable[]) => SchemaObjectSortable[],
    ) => void;
    updateEditSchema: (
        schemas?:
            | SchemaObjectSortable[]
            | ((prev: SchemaObjectSortable[]) => SchemaObjectSortable[]),
    ) => void;
}

type ProjectStore = ProjectState & ProjectActions;

// Singleton
// Ensures that an expensive async function is only ever executed once
export const getDataset = createSingletonAsyncLoader(
    async (projectId: ProjectItem["id"], key: string) => {
        const trimmed = projectId.trim();
        if (!trimmed) return null;

        const emitAck = useSocketStore.getState().emitAck<(DatasetRow | null)[]>;
        const rows = await emitAck("client:dataset:row:all", trimmed, true);

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
    newProject: null,
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
    add: (project) => {
        project.columnKeys = project.columns ? Object.keys(project.columns) : [];
        project.schema = schemaObjectsToZod(project.schemaObjects || []);

        set((s) => ({ projects: { ...s.projects, [project.id]: project as ProjectItem } }));
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
    delete: (id) => {
        set((s) => {
            const deleteId = id || s.deleteId;
            if (!deleteId) return s;

            const activeId = s.activeId === deleteId ? null : s.activeId;
            const { [deleteId]: _, ...projects } = s.projects;
            return { activeId, deleteId: null, projects };
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

    addNewProject: () => {
        set((s) => {
            const np = s.newProject;
            if (!np?.data) return s;

            return {
                projects: { ...s.projects, [np.data.id]: np.data },
                newProject: null,
            };
        });
    },
    registerNextHandler: (handler) => {
        set((s) => {
            const prev = s.newProject ?? {
                activePageIndex: 0,
                isSuccess: true,
                nextHandler: [],
                data: null,
                uploadedDataset: null,
                uploadedDatasetBuffer: null,
            };
            return { newProject: { ...prev, nextHandler: [...prev.nextHandler, handler] } };
        });
        return handler;
    },
    removeNextHandler: (handler) => {
        set((s) => {
            const prev = s.newProject ?? {
                activePageIndex: 0,
                isSuccess: true,
                nextHandler: [],
                data: null,
                uploadedDataset: null,
                uploadedDatasetBuffer: null,
            };
            return {
                newProject: {
                    ...prev,
                    nextHandler: prev.nextHandler?.filter((h) => h !== handler),
                },
            };
        });
    },

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

    updateNewProjectSchema: (schemas) => {
        set((s) => {
            const newProject = s.newProject;
            const data = newProject?.data;
            if (!newProject || !data) return s;

            const schemaObjects = schemas(data.schemaObjects);

            return {
                newProject: {
                    ...newProject,
                    data: { ...data, schema: schemaObjectsToZod(schemaObjects), schemaObjects },
                },
            };
        });
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
