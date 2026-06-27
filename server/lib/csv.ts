import type { Blob } from "node:buffer";
import type { DatasetRow } from "~/types/dataset";
import { Readable } from "node:stream";
import { parse } from "@fast-csv/parse";
import { addDatasetRows } from "$/db/dataset";
import { AUTH_HEADERS } from "$/lib/auth";

export async function isBinaryFile(blob: Blob): Promise<boolean> {
    const arrBuffer = await blob.slice(0, 4).arrayBuffer(); // Read just the first 4 bytes
    const bytes = new Uint8Array(arrBuffer);

    // Check common executable / binary magic numbers
    const isExe = bytes[0] === 0x4d && bytes[1] === 0x5a; // "MZ" (Windows EXE)
    const isElf = bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46; // ELF (Linux Executable)
    const isMachO =
        (bytes[0] === 0xcf && bytes[1] === 0xfa && bytes[2] === 0xed && bytes[3] === 0xfe) ||
        (bytes[0] === 0xce && bytes[1] === 0xfa && bytes[2] === 0xed && bytes[3] === 0xfe); // macOS Executable

    return isExe || isElf || isMachO;
}

async function getCSVColumns(blob: Blob): Promise<string[]> {
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const readable = Readable.from(buffer);

    return new Promise((resolve, reject) => {
        let headers: string[] = [];

        const stream = readable.pipe(parse({ headers: true }));

        stream
            .on("headers", (detectedHeaders: string[]) => {
                headers = detectedHeaders;
                stream.destroy();
            })
            .on("close", () => resolve(headers))
            .on("error", reject);
    });
}

export async function csvToJson(blob: Blob): Promise<DatasetRow[]> {
    if (await isBinaryFile(blob)) return [];

    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const readable = Readable.from(buffer);

    return new Promise((resolve, reject: (error: Error) => void) => {
        const stream = readable.pipe(parse({ headers: true, trim: true, ignoreEmpty: true }));
        const result: DatasetRow[] = [];

        stream
            .on("error", () => reject(new Error("Error parsing CSV")))
            .on("data", (row) => result.push(row))
            .on("end", () => resolve(result));
    });
}

export async function trySubmitCSVRequest(req: Bun.BunRequest) {
    try {
        const searchParams = new URL(req.url).searchParams;
        const datasetId = searchParams.get("id");
        const datasetKey = searchParams.get("key");
        if (datasetId == null || datasetKey == null) {
            return new Response("Bad Request", { status: 400, headers: AUTH_HEADERS });
        }

        const fileData = await req.blob();
        const rows = await csvToJson(fileData);
        const changes = await addDatasetRows(datasetId, rows, datasetKey);

        return Response.json(changes, { headers: AUTH_HEADERS });
    } catch (err: unknown) {
        const message = err instanceof Error ? `: ${err.message}` : "";
        return new Response(`Internal Server Error${message}`, {
            status: 500,
            headers: AUTH_HEADERS,
        });
    }
}

export async function tryGetCSVColumnsRequest(req: Bun.BunRequest) {
    try {
        const fileData = await req.blob();
        const columns = await getCSVColumns(fileData);
        return Response.json(columns, { headers: AUTH_HEADERS });
    } catch (err: unknown) {
        const message = err instanceof Error ? `: ${err.message}` : "";
        return new Response(`Internal Server Error${message}`, {
            status: 500,
            headers: AUTH_HEADERS,
        });
    }
}
