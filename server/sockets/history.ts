import type { FinalServer, FinalSocket, SocketCallback } from "$/types";
import type { ScanEntry, ScanStatus } from "@/types";
import { atomicWrite } from "$/lib/utils";
import { publicDir } from "$/persist";
import { getPermissions } from "@/lib/permission";

const historyFilePath = publicDir("output", "history.json");

async function readHistoryFromFile() {
    try {
        const historyFile = Bun.file(historyFilePath);
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
        await atomicWrite(historyFilePath, JSON.stringify(history, null, 2));
    } catch (error) {
        console.error("Error writing to history file:", error);
    }
}

let scanHistory: ScanEntry[] = await readHistoryFromFile();
let isWriting = false;
let needsWriteAgain = false;

async function syncHistoryToDisk() {
    if (isWriting) {
        needsWriteAgain = true;
        return;
    }

    isWriting = true;

    try {
        await writeHistoryToFile(scanHistory);
    } catch (err) {
        console.error("Disk write failed: ", err);
    }

    isWriting = false;

    // If mutations happened while writing, run it one more time with the latest data
    if (needsWriteAgain) {
        needsWriteAgain = false;
        await syncHistoryToDisk();
    }
}

export function history(io: FinalServer, socket: FinalSocket) {
    socket.on("client:history:init", () => {
        if (!socket.data.user) return;
        socket.emit("server:history:update", scanHistory);
    });

    socket.on(
        "client:history:validation",
        (qrData: string, status: ScanStatus, callback: SocketCallback<string>) => {
            const user = socket.data.user;
            if (!user || !getPermissions(user.authorizeLevel).canScan) {
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
            void syncHistoryToDisk();
            callback({
                status: "success",
                data: `Validation for ${qrData} has been submitted`,
            });
            io.emit("server:history:update", scanHistory);
        },
    );

    socket.on("client:history:delete", (idToDelete: string) => {
        const user = socket.data.user;
        if (!user || !getPermissions(user.authorizeLevel).canDelete) {
            console.log(`Unauthorized delete attempt by user:`, user?.name);
            return;
        }

        const initialLength = scanHistory.length;
        scanHistory = scanHistory.filter((entry) => entry.id !== idToDelete);
        if (scanHistory.length < initialLength) {
            void syncHistoryToDisk();
            io.emit("server:history:update", scanHistory);
        }
    });
}
