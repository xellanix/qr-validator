import "$/app-header";
import "$/migration";
import { join } from "path";
import { file, serve } from "bun";
import open from "open";
import { FRONTEND_PORT, IS_PROD, SERVER_PORT } from "$/const";
import {
    AUTH_HEADERS,
    getToken,
    getUserPayload,
    isAuthenticatedUser,
    trySignIn,
    trySignUp,
} from "$/lib/auth";
import { tryGetCSVColumnsRequest, trySubmitCSVRequest } from "$/lib/csv";
import { execDir, publicDir } from "$/persist";
import { engine } from "$/socket";
import { getPermissions } from "@/lib/permission";
import index from "../dist/frontend/index.html";

const { fetch, ...socketEngineHandler } = engine.handler();

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
        "/auth/signout": () => {
            const headers = new Headers();
            for (const [key, value] of Object.entries(AUTH_HEADERS)) {
                headers.append(key, value);
            }
            const securityAttr = `HttpOnly; Secure; Path=/; SameSite=${IS_PROD ? "Strict" : "Lax"}; Max-Age=0`;
            headers.append("Set-Cookie", `auth_token=; ${securityAttr}`);
            headers.append("Set-Cookie", `user_hash=; ${securityAttr}`);
            return new Response("OK", { status: 200, headers });
        },
        "/auth/signup": {
            POST: (req) => trySignUp(req),
        },
        "/api/dataset/submit": {
            POST: trySubmitCSVRequest,
        },
        "/api/dataset/extract": {
            POST: tryGetCSVColumnsRequest,
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
    if (!IS_PROD) {
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

    return getBunFile(baseDir, targetPath);
}

console.log("📂 Directories");
console.log("> Execution directory:", execDir());
console.log("> Public directory   :", publicDir());
console.log("");

if (IS_PROD && process.env.ALREADY_OPENED !== "true") {
    void open(`http://localhost:${IS_PROD ? SERVER_PORT : FRONTEND_PORT}/console`);
    process.env.ALREADY_OPENED = "true";
}
