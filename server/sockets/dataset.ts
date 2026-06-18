import type { Server, Socket } from "socket.io";
import type { DatasetPayload, DatasetRow, DatasetRowValue } from "~/types/dataset";
import type { Project } from "~/types/project";
import type { SocketCallback } from "$/types";
import type { User } from "@/types";
import { addDataset, findDatasetRow, findDatasetRows, getAllDatasets } from "$/db/dataset";
import { getPermissions } from "@/lib/permission";

export function dataset(io: Server, socket: Socket) {
    socket.on(
        "client:dataset:row:get",
        async (
            datasetId: Project["datasetId"] | Project["id"],
            rowKey: DatasetRowValue,
            callback: SocketCallback<DatasetRow>,
        ) => {
            if (
                datasetId == null ||
                (typeof datasetId === "string" && datasetId.trim().length === 0)
            )
                return callback({ status: "error", error: `Dataset (${datasetId}) not found.` });

            const row = await findDatasetRow(datasetId, rowKey);
            if (!row) return callback({ status: "error", error: "Row not found." });
            callback({ status: "success", data: row });
        },
    );

    socket.on(
        "client:dataset:row:all",
        async (
            datasetId: Project["datasetId"] | Project["id"],
            callback: SocketCallback<(DatasetRow | null)[]>,
        ) => {
            if (
                datasetId == null ||
                (typeof datasetId === "string" && datasetId.trim().length === 0)
            )
                return callback({ status: "error", error: `Dataset (${datasetId}) not found.` });

            const user: User | undefined = socket.data.user;
            if (!user || !getPermissions(user.authorizeLevel).canAccessConsole) {
                return callback({
                    status: "error",
                    error: `Unauthorized fetch all attempt by user: ${user?.name}`,
                });
            }

            const rows = await findDatasetRows(datasetId);
            callback({ status: "success", data: rows });
        },
    );

    socket.on("client:dataset:all", async (callback) => {
        const user: User | undefined = socket.data.user;
        if (!user || !getPermissions(user.authorizeLevel).canAccessConsole) {
            return callback({
                status: "error",
                error: `Unauthorized fetch many attempt by user: ${user?.name}`,
            });
        }

        const rows = await getAllDatasets();
        callback({ status: "success", data: rows });
    });

    socket.on("client:dataset:add", async (data: DatasetPayload, callback) => {
        const res = await addDataset(data);
        callback({ status: "success", data: res });
    });
}
