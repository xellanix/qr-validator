import "$/migration";
import { join } from "path";
import { file, serve } from "bun";
import open from "open";
import {
    AUTH_HEADERS,
    getToken,
    getUserPayload,
    isAuthenticatedUser,
    trySignIn,
    trySignUp,
} from "$/lib/auth";
import { csvToJson } from "$/lib/utils";
import { execDir, publicDir } from "$/persist";
import { FRONTEND_PORT, SERVER_PORT, engine } from "$/socket";
import { getPermissions } from "@/lib/permission";
import index from "../dist/frontend/index.html";

const isProd = process.env.NODE_ENV === "production";
const { fetch, ...socketEngineHandler } = engine.handler();

declare const VERSION: string;

console.log("┌────────────────────────────────┐");
console.log("│ Xellanix PreMark               │");
{
    const len = 22 - VERSION.length;
    console.log(`│ Version ${VERSION}${len > 0 ? " ".repeat(len) : ""} │`);
}
console.log("├────────────────────────────────┤");

serve({
    ...socketEngineHandler,

    // Set it at the end of the server configuration options
    // so that all custom settings are fully applied
    // and not overridden by the configuration
    // from the libraries being used.
    port: SERVER_PORT,
    routes: {
        "/": prod(index),
        "/console": prod(index),
        "/index.html": prod(index),
        "/auth/signin": {
            GET: (req) => isAuthenticatedUser(req.headers.get("cookie")),
            POST: (req) => trySignIn(req),
        },
        "/auth/signout": new Response("OK", {
            status: 200,
            headers: {
                ...AUTH_HEADERS,
                "Set-Cookie": `auth_token=; HttpOnly; Secure; Path=/; SameSite=${isProd ? "Strict" : "Lax"}; Max-Age=0`,
            },
        }),
        "/auth/signup": {
            POST: (req) => trySignUp(req),
        },
    },
    async fetch(req, server) {
        const url = new URL(req.url);
        const path = decodeURIComponent(url.pathname)
            .replace(/^(\.\.(\/|\\|$))+/g, "")
            .replace(/\\/g, "/");

        if (path.startsWith(engine.opts.path)) {
            return engine.handleRequest(req, server);
        }

        if (req.method === "OPTIONS") {
            return new Response(null, { headers: AUTH_HEADERS });
        }

        if (path.startsWith("/api/assets")) {
            let reqPath = path.replace("/api/assets", "");
            if (reqPath.startsWith("/")) reqPath = reqPath.slice(1);

            if (reqPath.startsWith("input")) {
                const token = getToken(req.headers.get("cookie"));
                if (typeof token !== "string") return token;
                try {
                    const user = await getUserPayload(token);
                    if (!getPermissions(user.authorizeLevel).isUseDataset) {
                        return new Response("Forbidden: Insufficient Permissions", {
                            status: 403,
                            headers: AUTH_HEADERS,
                        });
                    }

                    const response = await servePublicFile(reqPath, url.searchParams);
                    Object.entries(AUTH_HEADERS).forEach(([key, value]) => {
                        response.headers.set(key, value);
                    });
                    return response;
                } catch {
                    return new Response("Internal Server Error", {
                        status: 500,
                        headers: AUTH_HEADERS,
                    });
                }
            }
        }

        return new Response("Not Found: Invalid Path", { status: 404 });
    },
});

function prod<T>(val: T) {
    if (!isProd) {
        return new Response(
            "Bun Backend: Running in DEV mode. Please use the Vite dev server to view the frontend.",
        );
    }

    return val;
}

async function getBunFile(baseDir: string, targetPath: string) {
    if (!targetPath.startsWith(baseDir)) {
        return new Response("Forbidden: Invalid Path", { status: 403 });
    }

    const requestedFile = file(targetPath);
    if (!(await requestedFile.exists())) {
        return new Response("Not Found", { status: 404 });
    }

    return new Response(requestedFile);
}

async function servePublicFile(reqPath: string, searchParams: URLSearchParams) {
    const baseDir = publicDir();
    const targetPath = join(baseDir, reqPath);

    console.log("File request...");
    console.log("> Request path:", reqPath);
    console.log("> Resolved path:", targetPath);
    console.log("> Search params:", searchParams.toJSON());

    // If the requested file is a csv file
    if (reqPath.endsWith(".csv")) {
        if (searchParams.has("to-json")) {
            const json = await csvToJson(targetPath);
            return Response.json(json);
        }
    }

    return getBunFile(baseDir, targetPath);
}

console.log(`│ Server: http://localhost:${SERVER_PORT} │`);
console.log(`│ Mode  : ${isProd ? "production " : "development"}            │`);
console.log("└────────────────────────────────┘");

console.log("> Execution directory:", execDir());
console.log("> Public directory   :", publicDir());

if (isProd && process.env.ALREADY_OPENED !== "true") {
    void open(`http://localhost:${isProd ? SERVER_PORT : FRONTEND_PORT}/console`);
    process.env.ALREADY_OPENED = "true";
}
