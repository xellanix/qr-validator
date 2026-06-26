import type { User } from "~/types/user";
import type { FinalServer, FinalSocket, SocketCallback } from "$/types";
import { parse } from "cookie";
import { getUserPayload } from "$/lib/auth";
import { base64ToBytes } from "$/lib/utils";

export function setupSocketAuth(io: FinalServer) {
    io.use((_socket, _next) => {
        const action = async () => {
            const socket = _socket;
            const next = _next;
            const cookieHeader = socket.request.headers.cookie;
            if (!cookieHeader) return next(new Error("No cookies found"));

            const cookies = parse(cookieHeader);
            const { auth_token, user_hash } = cookies;

            if (!auth_token || !user_hash) return next(new Error("Authentication cookie missing"));

            try {
                socket.data.user = await getUserPayload(auth_token);
                socket.data.userHash = {
                    bytes: base64ToBytes(user_hash),
                    base64: user_hash,
                };
                next();
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (_) {
                next(new Error("Session expired. Please sign in again."));
            }
        };

        void action();
    });
}

export function auth(io: FinalServer, socket: FinalSocket) {
    socket.on("client:auth:sync", (callback: SocketCallback<User>) => {
        if (socket.data.user) {
            // The middleware already verified the JWT and put data here!
            return callback({ status: "success", data: socket.data.user });
        }
        // If no user data, the JWT was missing or invalid
        callback({ status: "error", error: "Invalid token." });
    });
}
