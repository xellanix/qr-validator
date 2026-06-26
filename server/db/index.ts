import { Database } from "bun:sqlite";
import { base64ToBytes, toNonSharedBytes } from "$/lib/utils";
import { publicDir } from "$/persist";

const dbPath = publicDir("app.db");
export const db = new Database(dbPath);
db.run("PRAGMA foreign_keys = ON;");

// Setup Table
db.run(
    `
CREATE TABLE IF NOT EXISTS users (
    user_hash BLOB PRIMARY KEY,
    payload BLOB
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS datasets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payload BLOB NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS dataset_rows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dataset_id INTEGER NOT NULL,
    key_hash BLOB NOT NULL,
    payload BLOB NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_dataset_rows_key_hash ON dataset_rows (dataset_id, key_hash);

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY DEFAULT (
      lower(
        hex(randomblob(4)) || '-' || 
        hex(randomblob(2)) || '-4' || 
        substr(hex(randomblob(2)), 2) || '-' || 
        substr('89ab', abs(randomblob(1) % 4) + 1, 1) || 
        substr(hex(randomblob(2)), 2) || '-' || 
        hex(randomblob(6))
      )
    ),
    dataset_id INTEGER,
    creator_user_hash BLOB,
    name TEXT,
    schema_objects TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dataset_id) REFERENCES datasets (id) ON DELETE SET NULL
    FOREIGN KEY (creator_user_hash) REFERENCES users (user_hash) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_project_dataset_id ON projects (dataset_id);
CREATE INDEX IF NOT EXISTS idx_project_user_hash ON projects (creator_user_hash);
`,
);

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
