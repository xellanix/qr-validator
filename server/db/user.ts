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
const ADD_USER_QUERY = db.prepare(
    "INSERT OR IGNORE INTO users (user_hash, payload) VALUES ($user_hash, $payload)",
);
const ADD_USERS_QUERY = db.transaction(
    (data: { $user_hash: Uint8Array; $payload: Uint8Array }[]) => {
        for (const row of data) {
            ADD_USER_QUERY.run(row);
        }
        return data.length;
    },
);
const FIND_USER_BY_TOKEN_QUERY = db.query<{ payload: Uint8Array }, [Uint8Array]>(
    "SELECT payload FROM users WHERE user_hash = ?",
);
const REMOVE_USER_BY_TOKEN_QUERY = db.prepare("DELETE FROM users WHERE user_hash = ?");

const GET_PROJECT_CREATOR_FOR_USER_QUERY = db.query<
    { project_id: string; creator_user_hash: Uint8Array },
    [Uint8Array]
>(
    "SELECT pu.project_id, p.creator_user_hash FROM project_users pu JOIN projects p ON pu.project_id = p.id WHERE pu.user_hash = ?",
);

export async function writeTokenFile(name: string, tokenBytes: Uint8Array) {
    const now = new Date();
    const year = now.getFullYear().toString().padStart(4, "0");
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const date = now.getDate().toString().padStart(2, "0");
    const hour = now.getHours().toString().padStart(2, "0");
    const minute = now.getMinutes().toString().padStart(2, "0");
    const second = now.getSeconds().toString().padStart(2, "0");
    const millisecond = now.getMilliseconds().toString().padStart(3, "0");
    const timemark =
        year +
        month +
        date +
        hour +
        minute +
        second +
        millisecond +
        (Math.random() * 1000).toFixed();

    const fileName = `${name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}_${timemark}.key`;
    await Bun.write(publicDir("output", "users", fileName), tokenBytes);
}

export async function createUserHash(user: User) {
    const tokenBytes = await encryptData(JSON.stringify(user), key);
    const token = bytesToBase64(tokenBytes);

    return { hash: createSearchHash(tokenBytes), tokenBytes, token };
}

export async function addUser(user: User | Uint8Array, payload?: Uint8Array) {
    try {
        if (payload) {
            const hash = user as Uint8Array;
            const info = ADD_USER_QUERY.run({ $user_hash: hash, $payload: payload });
            if (info.changes === 0) return null;
            return hash;
        } else {
            const _user = user as User;
            const { hash, token, tokenBytes } = await createUserHash(_user);
            const payload = await encryptData(JSON.stringify({ token }));
            const info = ADD_USER_QUERY.run({ $user_hash: hash, $payload: payload });

            if (info.changes === 0) return null;

            await writeTokenFile(_user.name, tokenBytes);
            return tokenBytes;
        }
    } catch {
        return null;
    }
}

export async function addUsers(users: User[]) {
    try {
        const filePayloads: { name: string; tokenBytes: Uint8Array }[] = [];
        const hashes: Uint8Array[] = [];
        const data = await Promise.all(
            users.map(async (user) => {
                const { hash, token, tokenBytes } = await createUserHash(user);
                const payload = await encryptData(JSON.stringify({ token }));

                filePayloads.push({ name: user.name, tokenBytes });
                hashes.push(hash);

                return { $user_hash: hash, $payload: payload };
            }),
        );

        ADD_USERS_QUERY(data);

        const tokensBytes: Uint8Array[] = [];
        await Promise.all(
            filePayloads.map(async (f) => {
                await writeTokenFile(f.name, f.tokenBytes);
                tokensBytes.push(f.tokenBytes);
            }),
        );
        return { tokensBytes, hashes };
    } catch {
        return null;
    }
}

export async function getUser(payload: Uint8Array) {
    const res = await decryptData<{ token: string }>(payload);
    if (res?.token) {
        const user = await decryptData<User>(base64ToBytes(res.token), key);
        if (user) {
            return user;
        }
    }

    return null;
}

export async function findUserByToken(rawToken: string | Uint8Array) {
    const hash = createSearchHash(rawToken);

    const row = FIND_USER_BY_TOKEN_QUERY.get(hash);
    if (row) return getUser(row.payload);
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

export function getProjectCreatorForUser(userHash: Uint8Array) {
    return GET_PROJECT_CREATOR_FOR_USER_QUERY.get(userHash);
}
