import type { User } from "~/types/user";
import { createSearchHash, db, decryptData, encryptData } from "$/db";
import { base64ToBytes, bytesToBase64, toNonSharedBytes } from "$/lib/utils";
import { publicDir } from "$/persist";

const AUTH_ENCRYPTION_KEY = toNonSharedBytes(process.env.AUTH_ENCRYPTION_KEY, 32, false);
const key = await crypto.subtle.importKey("raw", AUTH_ENCRYPTION_KEY, "AES-GCM", false, [
    "encrypt",
    "decrypt",
]);

// PREDEFINED PREPARED STATEMENTS
const ADD_USER_QUERY = db.prepare("INSERT INTO users (user_hash, payload) VALUES (?, ?)");
const FIND_USER_BY_TOKEN_QUERY = db.query<{ payload: Uint8Array }, [Uint8Array]>(
    "SELECT payload FROM users WHERE user_hash = ?",
);
const REMOVE_USER_BY_TOKEN_QUERY = db.prepare("DELETE FROM users WHERE user_hash = ?");

async function writeTokenFile(name: string, tokenBytes: Uint8Array) {
    const now = new Date();
    const year = now.getFullYear().toString().padStart(4, "0");
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const date = now.getDate().toString().padStart(2, "0");
    const timemark = year + month + date;

    const fileName = `${name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}_${timemark}.key`;
    await Bun.write(publicDir("output", "users", fileName), tokenBytes);
}

export async function addUser(user: User) {
    try {
        const tokenBytes = await encryptData(JSON.stringify(user), key);
        const token = bytesToBase64(tokenBytes);

        await writeTokenFile(user.name, tokenBytes);

        const hash = createSearchHash(token);
        const payload = await encryptData(JSON.stringify({ token }));
        const info = ADD_USER_QUERY.run(hash, payload);

        if (info.changes === 0) return null;

        return tokenBytes;
    } catch {
        return null;
    }
}

export async function findUserByToken(rawToken: string | Uint8Array) {
    const hash = createSearchHash(rawToken);

    const row = FIND_USER_BY_TOKEN_QUERY.get(hash);
    if (row) {
        const res = await decryptData<{ token: string }>(row.payload);
        if (res?.token) {
            const user = await decryptData<User>(base64ToBytes(res.token), key);
            if (user) {
                return user;
            }
        }
    }
    return null;
}

export async function findUserByFile(filePath: string) {
    try {
        const file = Bun.file(filePath);
        if (!(await file.exists())) return null;

        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);

        return findUserByToken(bytes);
    } catch {
        return null;
    }
}

export function removeUserByToken(rawToken: string | Uint8Array) {
    const hash = createSearchHash(rawToken);
    const info = REMOVE_USER_BY_TOKEN_QUERY.run(hash);
    return info.changes > 0;
}

export async function removeUserByFile(filePath: string) {
    try {
        const file = Bun.file(filePath);
        if (!(await file.exists())) return false;

        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);

        return removeUserByToken(bytes);
    } catch {
        return false;
    }
}
