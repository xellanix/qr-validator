import { Database } from "bun:sqlite";
import { base64ToBytes, toNonSharedBytes } from "$/lib/utils";
import { publicDir } from "$/persist";

const dbPath = publicDir("app.db");
export const db = new Database(dbPath);
db.run("PRAGMA foreign_keys = ON;");

const SECRET_KEY = toNonSharedBytes(process.env.HASH_SECRET, 64, false);
const ENCRYPTION_KEY = toNonSharedBytes(process.env.ENCRYPTION_KEY, 32, false);

const key = await crypto.subtle.importKey("raw", ENCRYPTION_KEY, "AES-GCM", false, [
    "encrypt",
    "decrypt",
]);

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function createSearchHash(input: string | Uint8Array) {
    const bytes = typeof input === "string" ? base64ToBytes(input) : input;
    const hasher = new Bun.CryptoHasher("sha256", SECRET_KEY);
    hasher.update(bytes);
    return hasher.digest();
}

export async function encryptData(plainText: string, _key = key) {
    const iv = crypto.getRandomValues(new Uint8Array(12)); // Stick with 12 bytes for GCM!
    const encoded = encoder.encode(plainText);

    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, _key, encoded);

    // Combine IV + Encrypted Data for storage
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return combined;
}

export async function decryptData<T>(combined: Uint8Array, _key = key): Promise<T | null> {
    try {
        // Extract the 12-byte IV from the front
        const iv = combined.slice(0, 12);

        // Extract the ciphertext (everything after the 12th byte)
        const ciphertext = combined.slice(12);

        // Perform the decryption
        const decryptedBuffer = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            _key,
            ciphertext,
        );

        // Convert the buffer back to a string and parse the JSON
        const jsonString = decoder.decode(decryptedBuffer);
        return JSON.parse(jsonString) as T;
    } catch {
        // This will trigger if the key is wrong or the data was corrupted
        console.error("Decryption failed! The key might be wrong or data is tampered with.");
        return null;
    }
}
