import type { Server, Socket } from "socket.io";
import type { DatasetRow, DatasetRowValue } from "~/types/dataset";
import type { SocketCallback } from "$/types";
import { findDatasetRow } from "$/db/dataset";

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
}
