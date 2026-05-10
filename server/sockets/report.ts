import type { Server, Socket } from "socket.io";
import type { SocketCallback } from "$/types";
import type { BlobBuffer, DatasetKey, User } from "@/types";
import { writeToBuffer } from "@fast-csv/format";
import { getPermissions } from "@/lib/permission";

export function report(io: Server, socket: Socket) {
    socket.on(
        "client:report:export",
        async (
            rows: string[][],
            datasetKeys: DatasetKey[],
            callback: SocketCallback<BlobBuffer>,
        ) => {
            const user: User | undefined = socket.data.user;
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
