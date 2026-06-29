import { Database } from "bun:sqlite";
import { base64ToBytes, decryptData as decrypt, encryptData, toNonSharedBytes } from "$/lib/utils";
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
    creator_user_hash BLOB,
    payload BLOB NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_user_hash) REFERENCES users (user_hash) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS dataset_rows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dataset_id TEXT NOT NULL,
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
    dataset_id TEXT,
    creator_user_hash BLOB,
    name TEXT,
    schema_objects TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dataset_id) REFERENCES datasets (id) ON DELETE SET NULL,
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

export function createSearchHash(input: string | Uint8Array) {
    const bytes = typeof input === "string" ? base64ToBytes(input) : input;
    const hasher = new Bun.CryptoHasher("sha256", SECRET_KEY);
    hasher.update(bytes);
    return hasher.digest();
}

export async function decryptData<T>(combined: Uint8Array, _key = key): Promise<T | null> {
    try {
        const jsonString = await decrypt(combined, _key);
        if (!jsonString) return null;

        // Parse the JSON
        return JSON.parse(jsonString) as T;
    } catch {
        // This will trigger if the key is wrong or the data was corrupted
        console.error("Decryption failed! The key might be wrong or data is tampered with.");
        return null;
    }
}

export { encryptData };
