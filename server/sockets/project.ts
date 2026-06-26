/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SnakeCaseKeys } from "~/types";
import type { Project, ProjectWithDataset } from "~/types/project";
import type { FinalServer, FinalSocket } from "$/types";
import { updateDataset } from "$/db/dataset";
import {
    addProject,
    findProjectById,
    getAllProjects,
    removeProjectById,
    updateProject,
} from "$/db/project";
import { getPermissions } from "@/lib/permission";

type InitOptions = {
    activation?: boolean;
    projects?: boolean;
    all?: boolean;
};

type SubmitProject = Omit<Project, "id" | "datasetId"> & { datasetId: number };

const activeIds: Record<string, string | null> = {};

async function fetchProjects(userHash: Uint8Array, id: string | null, all?: boolean) {
    if (all) return getAllProjects(userHash, true);

    if (!id) return {};
    const project = await findProjectById(userHash, id, true, true);
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

export function project(io: FinalServer, socket: FinalSocket) {
    socket.on("client:project:init", async (opt: InitOptions) => {
        const { user, userHash } = socket.data;
        if (
            !userHash ||
            (opt.all && (!user || !getPermissions(user.authorizeLevel).canAccessConsole))
        ) {
            return socket.emit(
                "server:project:error",
                `Unauthorized fetch all attempt by user: ${user?.name}`,
            );
        }

        const res: Record<string, unknown> = {};
        const activeId = activeIds[userHash.base64] ?? null;
        if (opt.activation) res.activeId = activeId;
        if (opt.projects) res.projects = await fetchProjects(userHash.bytes, activeId, opt.all);

        socket.emit("server:project:init", res);
    });

    socket.on(
        "client:project:add",
        async (
            project: SubmitProject,
            forward: Pick<ProjectWithDataset, "columns" | "key" | "keyLabel">,
        ) => {
            const { user, userHash } = socket.data;
            if (!userHash || !user || !getPermissions(user.authorizeLevel).canAccessConsole) {
                return socket.emit(
                    "server:project:error",
                    `Unauthorized add attempt by user: ${user?.name}`,
                );
            }

            const { name, datasetId, schemaObjects } = project;
            const projectId = addProject(userHash.bytes, datasetId, name, schemaObjects);
            const success = !!projectId;
            const res = success
                ? ({
                      id: projectId,
                      name,
                      datasetId,
                      columns: forward.columns,
                      key: forward.key,
                      keyLabel: forward.keyLabel,
                      schemaObjects,
                  } as Omit<ProjectWithDataset, "columnKeys">)
                : null;
            socket.emit("server:project:add", res, success);
            socket.broadcast.emit("server:project:add", res, success);
        },
    );

    socket.on(
        "client:project:update",
        async (id: string, datasetId: number | null, projectsPayload, datasetsPayload) => {
            const { user, userHash } = socket.data;
            if (!userHash || !user || !getPermissions(user.authorizeLevel).canAccessConsole) {
                return socket.emit(
                    "server:project:error",
                    `Unauthorized update attempt by user: ${user?.name}`,
                );
            }

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
                changes = updateProject(userHash.bytes, id, camelToSnakeCase(copied));
            }

            const project = { ...projectsPayload, ...datasetsPayload };

            if (changes === 0) {
                return socket.emit("server:project:error", "Failed to update project.");
            }
            socket.emit("server:project:update", id, project, true); // Send the update result back to the updater (client)
            socket.broadcast.emit("server:project:update", id, project);
        },
    );

    socket.on("client:project:delete", async (id: string, callback) => {
        const { user, userHash } = socket.data;
        if (!userHash || !user || !getPermissions(user.authorizeLevel).canAccessConsole) {
            return socket.emit(
                "server:project:error",
                `Unauthorized delete attempt by user: ${user?.name}`,
            );
        }

        const success = removeProjectById(userHash.bytes, id);
        if (success) {
            if (id === activeIds[userHash.base64]) delete activeIds[userHash.base64];
            io.emit("server:project:delete", id);
        }
        callback({ status: "success", data: success });
    });

    socket.on("client:project:activation:toggle", async (id: string, checked: boolean) => {
        const { user, userHash } = socket.data;
        if (!userHash || !user || !getPermissions(user.authorizeLevel).canAccessConsole) {
            return socket.emit(
                "server:project:error",
                `Unauthorized activation toggle attempt by user: ${user?.name}`,
            );
        }
        const activeId = (checked && id) || null;
        activeIds[userHash.base64] = activeId;
        io.emit("server:project:activation:toggle", activeId);
    });
}
