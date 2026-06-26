import type { FinalServer, FinalSocket, SocketCallback } from "$/types";
import { decrypt, toNonSharedBytes } from "$/lib/utils";

const USERDATA_ENCRYPTION_KEY = toNonSharedBytes(process.env.USERDATA_ENCRYPTION_KEY, 32, false);

export function security(io: FinalServer, socket: FinalSocket) {
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
