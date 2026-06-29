import type { FinalServer, FinalSocket, SocketCallback } from "$/types";
import { decryptData, toNonSharedBytes } from "$/lib/utils";

const USERDATA_ENCRYPTION_KEY = toNonSharedBytes(process.env.USERDATA_ENCRYPTION_KEY, 32, false);
const _key = await crypto.subtle.importKey("raw", USERDATA_ENCRYPTION_KEY, "AES-GCM", false, [
    "encrypt",
    "decrypt",
]);

export function security(io: FinalServer, socket: FinalSocket) {
    socket.on("client:security:decrypt", async (data: string, callback: SocketCallback<string>) => {
        if (!socket.data.user) return;

        const decrypted = await decryptData(data, _key);
        if (!decrypted) {
            return callback({
                status: "error",
                error: "Decryption failed.",
            });
        }

        callback({ status: "success", data: decrypted });
    });
}
