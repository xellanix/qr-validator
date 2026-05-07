import { join } from "path";
import { file, serve } from "bun";
import open from "open";
import { execDir, publicDir } from "$/persist";
import { FRONTEND_PORT, SERVER_PORT, engine } from "$/socket";
import { csvToJson } from "$/utils";
import index from "../dist/frontend/index.html";

const isProd = process.env.NODE_ENV === "production";
const { fetch, ...socketEngineHandler } = engine.handler();

declare const VERSION: string;

console.log("┌────────────────────────────────┐");
console.log("│ Xellanix ControlMaster         │");
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
    },
    async fetch(req, server) {
        const url = new URL(req.url);
        const path = url.pathname;

        if (path.startsWith(engine.opts.path)) {
            return engine.handleRequest(req, server);
        }

        if (path.startsWith("/api/assets/")) {
            return servePublicFile(path.replace("/api/assets/", ""), url.searchParams);
        }

        return prod(serveStaticFile(path));
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

async function servePublicFile(path: string, searchParams: URLSearchParams) {
    const baseDir = publicDir();
    const reqPath = decodeURIComponent(path);
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

async function serveStaticFile(path: string, baseDir: string = execDir()) {
    const reqPath = decodeURIComponent(path);
    const targetPath = join(baseDir, reqPath);

    console.log("File request...");
    console.log("> Request path:", reqPath);
    console.log("> Resolved path:", targetPath);

    return getBunFile(baseDir, targetPath);
}

console.log(`│ Server: http://localhost:${SERVER_PORT} │`);
console.log(`│ Mode  : ${isProd ? "production " : "development"}            │`);
console.log("└────────────────────────────────┘");

console.log("> Execution directory:", execDir());
console.log("> Public directory   :", publicDir());

if (isProd && process.env.ALREADY_OPENED !== "true") {
    void open(`http://localhost:${isProd ? SERVER_PORT : FRONTEND_PORT}/master`);
    process.env.ALREADY_OPENED = "true";
}
