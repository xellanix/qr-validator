import type { Server, Socket } from "socket.io";
import type { SocketCallback } from "$/types";
import { decrypt } from "$/utils";

const userdataKey = Buffer.from(process.env.USERDATA_ENCRYPTION_KEY!, "utf-8");

export function security(io: Server, socket: Socket) {
    socket.on("client:security:decrypt", (data: string, callback: SocketCallback<string>) => {
        const decrypted = decrypt(data, userdataKey);
        if (!decrypted) {
            return callback({
                status: "error",
                error: "Decryption failed.",
            });
        }

        callback({ status: "success", data: decrypted });
    });
}
