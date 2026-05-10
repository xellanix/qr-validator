import type { User } from "@/types";
import { file } from "bun";
import { parse } from "cookie";
import { SignJWT, jwtVerify } from "jose";
import { decrypt, toNonSharedBytes } from "$/lib/utils";
import { publicDir } from "$/persist";
import { FRONTEND_PORT } from "$/socket";

const authorizedUsersPath = publicDir("output", "authorized-users.json");
let authorizedIds: string[] = [];
const ENCRYPTION_KEY = toNonSharedBytes(process.env.ENCRYPTION_KEY, 32);
const JWT_SECRET = toNonSharedBytes(process.env.JWT_SECRET, 64);

const isProd = process.env.NODE_ENV === "production";
const ALLOWED_ORIGIN = isProd ? "" : `http://localhost:${FRONTEND_PORT}`;

export const AUTH_HEADERS = isProd
    ? {}
    : {
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "7200",
      };

async function initIds(reInit?: boolean) {
    if (!reInit && authorizedIds.length > 0) return;

    const idFile = file(authorizedUsersPath);
    if (!(await idFile.exists())) return;

    authorizedIds = await idFile.json();
}

async function verifyId(id: string): Promise<User | null> {
    try {
        await initIds();
        if (authorizedIds.includes(id)) {
            const decrypted = decrypt(id, ENCRYPTION_KEY);
            if (decrypted) {
                const user = JSON.parse(decrypted) as User;
                return user;
            }
        }
        return null;
    } catch {
        return null;
    }
}

async function getUserJwt(id?: string) {
    if (!id) return null;

    const user = await verifyId(id);
    if (user) {
        const jwt = await new SignJWT({ ...user })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime("2h")
            .sign(JWT_SECRET);
        return { user, jwt };
    }

    return null;
}

export async function trySignIn(req: Bun.BunRequest) {
    const body = await req.body.json();
    const user = await getUserJwt(body?.userId);
    if (!user) {
        return new Response(`Unauthorized: Invalid User (${body?.userId})`, {
            status: 401,
        });
    }

    return new Response("OK", {
        status: 200,
        headers: {
            ...AUTH_HEADERS,
            "Set-Cookie": `auth_token=${user.jwt}; HttpOnly; Secure; Path=/; SameSite=${isProd ? "Strict" : "Lax"}; Max-Age=86400`,
        },
    });
}

export async function getUserPayload(token: string) {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as User;
}

export function getToken(cookieHeader: string) {
    const cookies = parse(cookieHeader || "");
    const token = cookies.auth_token;
    if (!token) return new Response("Unauthorized", { status: 401, headers: AUTH_HEADERS });

    return token;
}

export async function isAuthenticatedUser(cookieHeader: string) {
    const token = getToken(cookieHeader);
    if (typeof token !== "string") return token;

    try {
        await getUserPayload(token);
        return new Response("OK", { status: 200, headers: AUTH_HEADERS });
    } catch {
        return new Response("Internal Server Error", { status: 500, headers: AUTH_HEADERS });
    }
}
