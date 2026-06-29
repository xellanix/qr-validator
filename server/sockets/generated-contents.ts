import type { PresenceContent } from "~/types/generated-contents";
import type { Project } from "~/types/project";
import type { FinalServer, FinalSocket, SocketCallback } from "$/types";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { encodeQR } from "qr";
import sharp from "sharp";
import { findDatasetRows } from "$/db/dataset";
import { encryptData, toNonSharedBytes } from "$/lib/utils";
import { publicDir } from "$/persist";
import { getPermissions } from "@/lib/permission";

const USERDATA_ENCRYPTION_KEY = toNonSharedBytes(process.env.USERDATA_ENCRYPTION_KEY, 32, false);
const _key = await crypto.subtle.importKey("raw", USERDATA_ENCRYPTION_KEY, "AES-GCM", false, [
    "encrypt",
    "decrypt",
]);

const generateQR = async (value: string) => {
    const encrypted = await encryptData(value, _key, true);
    const svgString = encodeQR(encrypted, "svg", {
        scale: 4,
        ecc: "medium",
    });

    try {
        const output = publicDir("output", "presence_qr", `${value}.png`);
        const targetDir = dirname(output);
        await mkdir(targetDir, { recursive: true });

        await sharp(Buffer.from(svgString))
            .resize(1024, 1024, { fit: "contain", kernel: "nearest" })
            .flatten({ background: "#ffffff" })
            .png()
            .toFile(output);

        return true;
    } catch (error) {
        console.error("Error generating PNG:", error);
        return false;
    }
};

export function generatedContents(io: FinalServer, socket: FinalSocket) {
    socket.on("client:presence:path", () => {
        if (socket.data.isTrulyLocal) {
            socket.emit("server:presence:path", publicDir("output", "presence_qr"));
        }
    });

    socket.on(
        "client:presence:fetch",
        async (
            projectId: Project["id"],
            key: string,
            callback: SocketCallback<PresenceContent[]>,
        ) => {
            const trimmed = projectId?.trim();
            if (!trimmed)
                return callback({ status: "error", error: `Project (${projectId}) not found.` });

            const user = socket.data.user;
            if (!user || !getPermissions(user.authorizeLevel).canAccessConsole) {
                return callback({
                    status: "error",
                    error: `Unauthorized fetch all attempt by user: ${user?.name}`,
                });
            }

            const rows = await findDatasetRows(trimmed, true);
            const actions: Promise<PresenceContent>[] = [];
            for (const row of rows) {
                if (!row) continue;
                actions.push(
                    (async () => {
                        const isExist = await Bun.file(
                            publicDir("output", "presence_qr", `${row[key]}.png`),
                        ).exists();

                        return {
                            key: row[key],
                            status: isExist ? "generated" : "missing",
                        };
                    })(),
                );
            }

            const presences = await Promise.all(actions);
            presences.sort((k1, k2) => k1.key.localeCompare(k2.key));

            callback({ status: "success", data: presences });
        },
    );

    socket.on(
        "client:presence:generate",
        async (value: string, callback: SocketCallback<boolean>) => {
            const { user, userHash } = socket.data;
            if (!userHash || !user || !getPermissions(user.authorizeLevel).canAccessConsole) {
                return socket.emit(
                    "server:response:error",
                    `Unauthorized generate attempt by user: ${user?.name}`,
                );
            }

            const result = await generateQR(value);
            if (!result) callback({ status: "error", error: "Error generating PNG." });

            callback({ status: "success", data: true });
            io.to(userHash.base64).emit("server:presence:update", value);
        },
    );

    socket.on("client:presence:generate:many", async (value: string[]) => {
        const { user, userHash } = socket.data;
        if (!userHash || !user || !getPermissions(user.authorizeLevel).canAccessConsole) {
            return socket.emit(
                "server:response:error",
                `Unauthorized generate attempt by user: ${user?.name}`,
            );
        }

        const results = await Promise.all(
            value.map(async (v) => {
                const res = await generateQR(v);
                if (res) io.to(userHash.base64).emit("server:presence:update", v);
                return res;
            }),
        );
        let count = 0;
        for (const r of results) {
            if (r) count++;
        }

        socket.emit("server:presence:generate:done", count);
    });
}
