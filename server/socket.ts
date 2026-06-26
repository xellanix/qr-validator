import type { FinalServer } from "$/types";
import { hostname } from "os";
import { Server as Engine } from "@socket.io/bun-engine";
import { Server } from "socket.io";
import { FRONTEND_PORT, IS_PROD, SERVER_PORT } from "$/const";
import { isTrulyLocal } from "$/lib/utils";
import { TunnelManager } from "$/tunnel-manager";
import { auth, setupSocketAuth } from "$/sockets/auth";
import { dataset } from "$/sockets/dataset";
import { history } from "$/sockets/history";
import { project } from "$/sockets/project";
import { report } from "$/sockets/report";
import { security } from "$/sockets/security";

const tunnelMgr = TunnelManager.getInstance();
const io = new Server({ transports: ["websocket"] }) as unknown as FinalServer;
const engine = new Engine({
    path: "/api/socket_io/",
    cors: {
        origin: IS_PROD ? false : `http://localhost:${FRONTEND_PORT}`,
        methods: ["GET", "POST"],
        credentials: true,
    },
});
io.bind(engine);
setupSocketAuth(io);
if (tunnelMgr.listenerCount("status:changed") === 0) {
    tunnelMgr.on("status:changed", (status) => {
        io.to("local-user").emit("server:tunnel:status", status);
    });
}
io.on("connection", (socket) => {
    console.log("✅ Client connected:", socket.id);

    const _isTrulyLocal = isTrulyLocal(
        socket.request,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (socket.conn.transport as any).socket.remoteAddress,
    );
    socket.emit("server:socket:device:info", {
        isTrulyLocal: _isTrulyLocal,
        name: hostname(),
    });
    console.log("Device name:", hostname());

    auth(io, socket);
    project(io, socket);
    dataset(io, socket);
    history(io, socket);
    security(io, socket);
    report(io, socket);

    if (_isTrulyLocal) {
        void socket.join("local-user");

        socket.emit("server:tunnel:status", tunnelMgr.status);
        // "client:tunnel:status"
        socket.on("client:tunnel:status", () => {
            socket.emit("server:tunnel:status", tunnelMgr.status);
        });

        socket.on("client:tunnel:toggle", async (shouldStart: boolean) => {
            try {
                // Check if the requested state matches current reality
                // If user asks to START, but we are ALREADY STARTED, do nothing.
                const current = tunnelMgr.status;
                if (shouldStart && current.active === true) return;
                if (!shouldStart && current.active === false) return;

                // Send "Loading" immediately to lock the UI
                io.to("local-user").emit("server:tunnel:status", {
                    active: undefined,
                    url: null,
                });

                let newStatus;
                if (shouldStart) {
                    newStatus = await tunnelMgr.startTunnel(SERVER_PORT);
                } else {
                    newStatus = await tunnelMgr.stopTunnel();
                }

                // Success! Send result
                io.to("local-user").emit("server:tunnel:status", newStatus);
            } catch (err) {
                if (!(err instanceof Error)) return;

                if (err.message?.startsWith("BUSY")) {
                    console.warn("Race condition prevented: User clicked too fast.");
                    io.to("local-user").emit("server:tunnel:status", tunnelMgr.status);
                    return;
                }

                console.error("Tunnel Error:", err);
                // Revert UI to "Offline" or "Error" state
                io.to("local-user").emit("server:tunnel:status", {
                    active: false,
                    url: null,
                    error: err.message,
                });
            }
        });
    }

    socket.on("disconnect", () => {
        const str = `❌ Client disconnected: ${socket.id}`;
        socket.data.user = undefined;
        socket.data.userHash = undefined;
        console.log(str);
        console.log("-".repeat(Bun.stringWidth(str)));
    });
});

export { engine };
