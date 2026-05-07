import type { Server, Socket } from "socket.io";
import type { SocketCallback } from "$/types";
import type { User } from "@/types";
import { file } from "bun";
import { publicDir } from "$/persist";
import { decrypt } from "$/utils";

const authorizedUsersPath = publicDir("output", "authorized-users.json");
let authorizedTokens: string[] = [];
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (ENCRYPTION_KEY?.length !== 32) {
    throw new Error("Encryption key is invalid. Check .env file.");
}
const key = Buffer.from(ENCRYPTION_KEY, "utf-8");

async function getTokens(force?: boolean) {
    if (!force && authorizedTokens.length > 0) return authorizedTokens;

    const tokenFile = file(authorizedUsersPath);
    if (!(await tokenFile.exists())) return authorizedTokens;

    const data: string[] = await tokenFile.json();
    authorizedTokens = data;
    return authorizedTokens;
}

export function auth(io: Server, socket: Socket) {
    socket.on("client:auth:authenticate", async (token: string, callback: SocketCallback<User>) => {
        await getTokens();

        if (authorizedTokens.includes(token)) {
            const decrypted = decrypt(token, key);
            if (decrypted) {
                const user = JSON.parse(decrypted) as User;
                console.log(`✅ Auth success for ${user.name} (Level ${user.authorizeLevel})`);
                socket.data.user = user;
                return callback({ status: "success", data: user });
            }
        }
        console.log(`❌ Auth failed for token: ${token.substring(0, 20)}...`);
        callback({ status: "error", error: "Invalid token." });
    });
}
