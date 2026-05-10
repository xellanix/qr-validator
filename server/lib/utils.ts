import type { IncomingMessage } from "node:http";
import { createDecipheriv } from "crypto";
import fs from "fs";
import { parse } from "@fast-csv/parse";
import { type Dataset } from "@/types";

export function isTrulyLocal(req: IncomingMessage, ip?: string): boolean {
    const headers = req.headers;
    const _ip = req?.socket?.remoteAddress ?? (ip || undefined);

    // Check IP: If it's not 127.0.0.1 (or IPv6 equiv), it's definitely remote.
    // This handles the "0.0.0.0" case.
    const isLocalIP = _ip && ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(_ip);
    if (!isLocalIP) return false;

    // Check Proxy Headers: If ANY of these exist, it's a Tunnel.
    const proxyHeaders = [
        "x-forwarded-for", // Standard
        "x-real-ip", // Standard
        "cf-connecting-ip", // Cloudflare
        "true-client-ip", // Cloudflare / Akamai
        "fastly-client-ip", // Fastly
        "x-cluster-client-ip", // Rackspace / Riverbed
        "x-forwarded", // General
        "forwarded-for", // General
        "foward", // General
        "ngrok-skip-browser-warning", // Ngrok
    ];

    const hasProxyHeader = proxyHeaders.some((header) => headers[header] !== undefined);

    // It is only "True Local" if it has a Local IP AND No Proxy Headers
    return !hasProxyHeader;
}

export function decrypt(token: string, _key: Uint8Array<ArrayBuffer>): string | null {
    try {
        const combined = Buffer.from(token, "base64");

        // Extract the iv, authTag, and encrypted data from the combined buffer
        const iv = combined.subarray(0, 16);
        const authTag = combined.subarray(16, 32);
        const encrypted = combined.subarray(32);

        if (!iv || !authTag || !encrypted) return null;

        const decipher = createDecipheriv("aes-256-gcm", _key, iv);
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        return decrypted.toString("utf8");
    } catch (error) {
        console.error("Decryption failed:", error);
        return null;
    }
}

export async function csvToJson(path: string): Promise<Dataset[]> {
    return new Promise((resolve, reject: (error: Error) => void) => {
        const input = fs.createReadStream(path);
        const parser = parse({ headers: true, trim: true, ignoreEmpty: true });

        const result: Dataset[] = [];

        parser
            .on("error", () => reject(new Error("Error parsing CSV")))
            .on("data", (row) => result.push(row))
            .on("end", () => resolve(result));

        input.pipe(parser);
    });
}

export function toNonSharedBytes(data: string, length: number) {
    const encoded = new TextEncoder().encode(data);
    if (encoded?.length !== length) {
        throw new Error(`Expected ${length} bytes, but got ${encoded?.length ?? -1}`);
    }
    return encoded;
}
