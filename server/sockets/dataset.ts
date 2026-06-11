import type { Server, Socket } from "socket.io";
import type { DatasetRow, DatasetRowValue } from "~/types/dataset";
import type { SocketCallback } from "$/types";
import type { User } from "@/types";
import { findDatasetRow, findDatasetRows, getAllDatasets } from "$/db/dataset";
import { getPermissions } from "@/lib/permission";

export function dataset(io: Server, socket: Socket) {
    socket.on(
        "client:dataset:row:get",
        async (
            datasetId: number,
            rowKey: DatasetRowValue,
            callback: SocketCallback<DatasetRow>,
        ) => {
            const row = await findDatasetRow(datasetId, rowKey);
            if (!row) return callback({ status: "error", error: "Row not found." });
            callback({ status: "success", data: row });
        },
    );

    socket.on(
        "client:dataset:row:all",
        async (datasetId: number, callback: SocketCallback<(DatasetRow | null)[]>) => {
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
}
