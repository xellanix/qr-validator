import type { DatasetPayload, DatasetRow, DatasetRowValue } from "~/types/dataset";
import type { Project } from "~/types/project";
import type { FinalServer, FinalSocket, SocketCallback } from "$/types";
import { addDataset, findDatasetRow, findDatasetRows, getAllDatasets } from "$/db/dataset";
import { getPermissions } from "@/lib/permission";

export function dataset(io: FinalServer, socket: FinalSocket) {
    socket.on(
        "client:dataset:row:get",
        async (
            datasetId: Project["datasetId"] | Project["id"],
            isProject: boolean,
            rowKey: DatasetRowValue,
            callback: SocketCallback<DatasetRow>,
        ) => {
            const trimmed = datasetId?.trim();
            if (!trimmed)
                return callback({ status: "error", error: `Dataset (${datasetId}) not found.` });

            const row = await findDatasetRow(trimmed, isProject, rowKey);
            if (!row) return callback({ status: "error", error: "Row not found." });
            callback({ status: "success", data: row });
        },
    );

    socket.on(
        "client:dataset:row:all",
        async (
            datasetId: Project["datasetId"] | Project["id"],
            isProject: boolean,
            callback: SocketCallback<(DatasetRow | null)[]>,
        ) => {
            const trimmed = datasetId?.trim();
            if (!trimmed)
                return callback({ status: "error", error: `Dataset (${datasetId}) not found.` });

            const user = socket.data.user;
            if (!user || !getPermissions(user.authorizeLevel).canAccessConsole) {
                return callback({
                    status: "error",
                    error: `Unauthorized fetch all attempt by user: ${user?.name}`,
                });
            }

            const rows = await findDatasetRows(trimmed, isProject);
            callback({ status: "success", data: rows });
        },
    );

    socket.on("client:dataset:all", async (callback) => {
        const user = socket.data.user;
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
        if (!res) return callback({ status: "error", error: "Failed to add dataset." });
        callback({ status: "success", data: res });
    });
}
