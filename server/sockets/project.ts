/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Server, Socket } from "socket.io";
import type { SnakeCaseKeys } from "~/types";
import type { Project, ProjectWithDataset } from "~/types/project";
import type { User } from "@/types";
import { updateDataset } from "$/db/dataset";
import { addProject, findProjectById, getAllProjects, updateProject } from "$/db/project";
import { getPermissions } from "@/lib/permission";

type InitOptions = {
    activation?: boolean;
    projects?: boolean;
    all?: boolean;
};

type SubmitProject = Omit<Project, "id" | "datasetId"> & { datasetId: number };

let activeId: string | null = "78bbc488-ee32-49ae-86d4-759989f56a57";

async function fetchProjects(id: string | null, all?: boolean) {
    if (all) return getAllProjects(true);

    if (!id) return {};
    const project = await findProjectById(id, true, true);
    if (!project) return {};

    return { [project.id]: project };
}

export function camelToSnakeCase<T>(obj: T): SnakeCaseKeys<T> {
    if (Array.isArray(obj)) {
        return obj.map((v) => camelToSnakeCase(v)) as never;
    } else if (obj?.constructor === Object) {
        return Object.keys(obj).reduce((result, key) => {
            const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
            result[snakeKey] = camelToSnakeCase((obj as never)[key]);
            return result;
        }, {} as any);
    }
    return obj as never;
}

const isEmptyRecord = <T>(obj: Record<string, T>) => {
    for (const key in obj) {
        if (Object.hasOwn(obj, key)) {
            return false;
        }
    }

    return true;
};

export function project(io: Server, socket: Socket) {
    socket.on("client:project:init", async (opt: InitOptions) => {
        const user: User | undefined = socket.data.user;
        if (opt.all && (!user || !getPermissions(user.authorizeLevel).canAccessConsole)) {
            return socket.emit("server:project:init", {
                status: "error",
                error: `Unauthorized fetch all attempt by user: ${user?.name}`,
            });
        }

        const res: Record<string, unknown> = {};
        if (opt.activation) res.activeId = activeId;
        if (opt.projects) res.projects = await fetchProjects(activeId, opt.all);

        socket.emit("server:project:init", res);
    });

    socket.on(
        "client:project:add",
        async (
            project: SubmitProject,
            forward: Pick<ProjectWithDataset, "columns" | "key" | "keyLabel">,
        ) => {
            const projectId = addProject(project.datasetId, project.name, project.schemaObjects);
            const success = !!projectId;
            const res = success
                ? ({
                      id: projectId,
                      name: project.name,
                      datasetId: project.datasetId,
                      columns: forward.columns,
                      key: forward.key,
                      keyLabel: forward.keyLabel,
                      schemaObjects: project.schemaObjects,
                  } as Omit<ProjectWithDataset, "columnKeys">)
                : null;
            socket.emit("server:project:add", res, success);
            socket.broadcast.emit("server:project:add", res, success);
        },
    );

    socket.on(
        "client:project:update",
        async (id: string, datasetId: number | null, projectsPayload, datasetsPayload) => {
            let changes: number = 0;

            if (!isEmptyRecord(datasetsPayload) && datasetId !== null) {
                changes = await updateDataset(datasetId, datasetsPayload);
            }

            if (!isEmptyRecord(projectsPayload)) {
                const copied = { ...projectsPayload } as Record<string, any>;
                if ("schemaObjects" in copied) {
                    // @ts-expect-error - Suppressing implicit any until refactoring
                    copied.schemaObjects = copied.schemaObjects.map(({ sortId, ...rest }) => rest);
                }
                changes = updateProject(id, camelToSnakeCase(copied));
            }

            const project = { ...projectsPayload, ...datasetsPayload };

            socket.emit("server:project:update", id, project, changes); // Send the update result back to the updater (client)
            socket.broadcast.emit("server:project:update", id, project);
        },
    );

    socket.on("client:project:activation:toggle", async (id: string, checked: boolean) => {
        activeId = (checked && id) || null;
        io.emit("server:project:activation:toggle", activeId);
    });
}
