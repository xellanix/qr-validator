import type { Server, Socket } from "socket.io";
import type { SocketCallback } from "$/types";
import type { ScanEntry, ScanStatus, User } from "@/types";
import { file, write } from "bun";
import { publicDir } from "$/persist";

const historyFilePath = publicDir("output", "history.json");

async function readHistoryFromFile() {
    try {
        const historyFile = file(historyFilePath);
        if (await historyFile.exists()) {
            const json = await historyFile.json();
            return json as ScanEntry[];
        }
    } catch (error) {
        console.error("Error reading history file:", error);
    }
    return [];
}

async function writeHistoryToFile(history: ScanEntry[]) {
    try {
        await write(historyFilePath, JSON.stringify(history, null, 2));
    } catch (error) {
        console.error("Error writing to history file:", error);
    }
}

let scanHistory: ScanEntry[] = [];

export function history(io: Server, socket: Socket) {
    socket.on("client:history:init", async () => {
        scanHistory = await readHistoryFromFile();
        socket.emit("server:history:update", scanHistory);
    });

    socket.on(
        "client:history:validation",
        async (qrData: string, status: ScanStatus, callback: SocketCallback<string>) => {
            const user: User | undefined = socket.data.user;

            if (!user || user.authorizeLevel < 1) {
                return callback({
                    status: "error",
                    error: `Unauthorized validation attempt by user: ${user?.name}`,
                });
            }

            let duplicatedValidator = "";
            const isDuplicate = scanHistory.some((entry) => {
                if (entry.data === qrData && entry.status === "Valid") {
                    duplicatedValidator = entry.validatorName;
                    return true;
                }

                return false;
            });
            if (isDuplicate) {
                return callback({
                    status: "info",
                    message: `This entry data (${qrData}) has already been validated by ${duplicatedValidator}`,
                });
            }

            const newScan: ScanEntry = {
                id: `scan_${Date.now()}`,
                data: qrData,
                status: status,
                validatorName: user.name,
                validatedAt: new Date().toISOString(),
            };
            scanHistory.unshift(newScan);
            await writeHistoryToFile(scanHistory);
            callback({
                status: "success",
                data: `Validation for ${qrData} has been submitted`,
            });
            io.emit("server:history:update", scanHistory);
        },
    );

    socket.on("client:history:delete", async (idToDelete: string) => {
        const user: User | undefined = socket.data.user;
        if (!user || user.authorizeLevel < 2) {
            console.log(`Unauthorized delete attempt by user:`, user?.name);
            return;
        }

        const initialLength = scanHistory.length;
        scanHistory = scanHistory.filter((entry) => entry.id !== idToDelete);
        if (scanHistory.length < initialLength) {
            await writeHistoryToFile(scanHistory);
            io.emit("server:history:update", scanHistory);
        }
    });
}
