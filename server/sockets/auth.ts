import type { Server, Socket } from "socket.io";
import type { SocketCallback } from "$/types";
import type { User } from "@/types";
import { parse } from "cookie";
import { getUserPayload } from "$/lib/auth";

export function setupSocketAuth(io: Server) {
    io.use((_socket, _next) => {
        const action = async () => {
            const socket = _socket;
            const next = _next;
            const cookieHeader = socket.request.headers.cookie;
            if (!cookieHeader) return next(new Error("No cookies found"));

            const cookies = parse(cookieHeader);
            const token = cookies.auth_token;

            if (!token) return next(new Error("Authentication cookie missing"));

            try {
                socket.data.user = await getUserPayload(token);
                next();
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (_) {
                next(new Error("Session expired. Please sign in again."));
            }
        };

        void action();
    });
}

export function auth(io: Server, socket: Socket) {
    socket.on("client:auth:sync", (callback: SocketCallback<User>) => {
        if (socket.data.user) {
            // The middleware already verified the JWT and put data here!
            return callback({ status: "success", data: socket.data.user });
        }
        // If no user data, the JWT was missing or invalid
        callback({ status: "error", error: "Invalid token." });
    });
}
