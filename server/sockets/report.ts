import type { DatasetRowKey } from "~/types/dataset";
import type { FinalServer, FinalSocket, SocketCallback } from "$/types";
import type { BlobBuffer } from "@/types";
import { writeToBuffer } from "@fast-csv/format";
import { getPermissions } from "@/lib/permission";

export function report(io: FinalServer, socket: FinalSocket) {
    socket.on(
        "client:report:export",
        async (
            rows: string[][],
            datasetKeys: DatasetRowKey[],
            callback: SocketCallback<BlobBuffer>,
        ) => {
            const user = socket.data.user;
            if (!user || !getPermissions(user.authorizeLevel).canReport) {
                return callback({
                    status: "error",
                    error: `Unauthorized report attempt by user: ${user?.name}`,
                });
            }

            const csv = await writeToBuffer(rows, {
                headers: ["Present", ...datasetKeys, "Validator", "Validated At", "Status"],
            });

            callback({
                status: "success",
                data: {
                    buffer: Buffer.from(csv),
                    type: "text/csv;charset=utf-8;",
                },
            });
        },
    );
}
