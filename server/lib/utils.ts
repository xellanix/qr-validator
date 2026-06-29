import type { IncomingMessage } from "node:http";
import type { Archive, BlobPart } from "bun";
import { rename } from "node:fs/promises";

const ENCRYPTION_KEY = toNonSharedBytes(process.env.ENCRYPTION_KEY, 32, false);
const _key = await crypto.subtle.importKey("raw", ENCRYPTION_KEY, "AES-GCM", false, [
    "encrypt",
    "decrypt",
]);
const decoder = new TextDecoder();

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

export async function encryptData<AsString extends boolean = false>(
    plainText: string,
    key = _key,
    asString: AsString = false as AsString,
): Promise<AsString extends true ? string : Uint8Array> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = Buffer.from(plainText, "utf-8");

    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);

    // Combine IV + Encrypted Data for storage
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    if (asString) return bytesToBase64(combined) as never;

    return combined as never;
}

export async function decryptData(combined: Uint8Array | string, key = _key) {
    try {
        if (typeof combined === "string") combined = base64ToBytes(combined);

        // Extract the 12-byte IV from the front
        const iv = combined.slice(0, 12);

        // Extract the ciphertext (everything after the 12th byte)
        const ciphertext = combined.slice(12);

        // Perform the decryption
        const decryptedBuffer = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key,
            ciphertext,
        );

        // Convert the buffer back to a string
        const plainText = decoder.decode(decryptedBuffer);
        return plainText;
    } catch {
        // This will trigger if the key is wrong or the data was corrupted
        console.error("Decryption failed! The key might be wrong or data is tampered with.");
        return null;
    }
}

export function toNonSharedBytes(data: string | null | undefined, length: number, isThrow = true) {
    if (!data) {
        const errorMsg = "Error: Missing data. Force exit with code (1).";
        if (isThrow) throw new Error(errorMsg);
        else {
            console.error(errorMsg);
            process.exit(1);
        }
    }
    const decoded = base64ToBytes(data);
    if (decoded?.length !== length) {
        const errorMsg = `Error: Expected ${length} bytes, but got ${decoded?.length ?? -1}. Force exit with code (1).`;
        if (isThrow) throw new Error(errorMsg);
        else {
            console.error(errorMsg);
            process.exit(1);
        }
    }
    return decoded;
}

export function bytesToBase64(data: Uint8Array) {
    return Buffer.from(data).toString("base64");
}

export function base64ToBytes(data: string) {
    return new Uint8Array(Buffer.from(data, "base64"));
}

export async function atomicWrite(
    destination: string,
    input: Blob | NodeJS.TypedArray | ArrayBufferLike | string | BlobPart[] | Archive,
    options?: { mode?: number; createPath?: boolean },
): Promise<number> {
    const tempPath = `${destination}.tmp`;
    const result = await Bun.write(tempPath, input, options);
    // Atomically replace the old file with the new one
    // Tt either succeeds entirely or fails entirely
    await rename(tempPath, destination);
    return result;
}
