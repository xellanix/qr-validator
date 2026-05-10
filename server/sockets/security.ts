import type { Server, Socket } from "socket.io";
import type { SocketCallback } from "$/types";
import { decrypt, toNonSharedBytes } from "$/utils";

const USERDATA_ENCRYPTION_KEY = toNonSharedBytes(process.env.USERDATA_ENCRYPTION_KEY, 32);

export function security(io: Server, socket: Socket) {
    socket.on("client:security:decrypt", (data: string, callback: SocketCallback<string>) => {
        if (!socket.data.user) return;

        const decrypted = decrypt(data, USERDATA_ENCRYPTION_KEY);
        if (!decrypted) {
            return callback({
                status: "error",
                error: "Decryption failed.",
            });
        }

        callback({ status: "success", data: decrypted });
    });
}
