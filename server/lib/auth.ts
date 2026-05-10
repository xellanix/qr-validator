import type { User } from "@/types";
import { parse } from "cookie";
import { SignJWT, jwtVerify } from "jose";
import { addUser, findUserByToken } from "$/db/user";
import { toNonSharedBytes } from "$/lib/utils";
import { FRONTEND_PORT } from "$/socket";

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

async function getUserJwt(id?: Uint8Array) {
    if (!id) return null;

    const user = await findUserByToken(id);
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
    const body = await req.body.bytes();
    const user = await getUserJwt(body);
    if (!user) {
        return new Response(`Unauthorized: Invalid User Id`, {
            status: 401,
            headers: AUTH_HEADERS,
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

export async function trySignUp(req: Bun.BunRequest) {
    const body = await req.body.json();
    const userName = (body?.name ?? "").trim();
    if (!userName) {
        return new Response(`Bad Request: Invalid User Name`, {
            status: 400,
            headers: AUTH_HEADERS,
        });
    }

    const userId = await addUser({ name: userName, authorizeLevel: 3 });
    if (!userId) {
        return new Response(`Internal Server Error`, { status: 500, headers: AUTH_HEADERS });
    }

    const user = await getUserJwt(userId);
    const jwt = user?.jwt ?? "";

    return new Response("OK", {
        status: 200,
        headers: {
            ...AUTH_HEADERS,
            "Set-Cookie": `auth_token=${jwt}; HttpOnly; Secure; Path=/; SameSite=${isProd ? "Strict" : "Lax"}; Max-Age=86400`,
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
