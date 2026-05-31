import type { Server, Socket } from "socket.io";

let activeId: string | null = null;

export function project(io: Server, socket: Socket) {
    socket.on("client:project:activation:init", () => {
        socket.emit("server:project:activation:toggle", activeId);
    });

    socket.on("client:project:activation:toggle", (id: string, checked: boolean) => {
        activeId = (checked && id) || null;
        io.emit("server:project:activation:toggle", activeId);
    });
}
