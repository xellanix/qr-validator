import { dirname, join } from "path";

let EXEC_DIR = "";
let PUBLIC_BASE = "";

export function execDir() {
    if (!EXEC_DIR) {
        const isProd = process.env.NODE_ENV === "production";
        const base = isProd ? dirname(process.execPath) : process.cwd();
        EXEC_DIR = base;
    }
    return EXEC_DIR;
}

export function publicDir(...segments: string[]) {
    if (!PUBLIC_BASE) {
        const base = execDir();
        const isProd = process.env.NODE_ENV === "production";
        const publicPath = isProd ? [""] : ["public", "__"];
        PUBLIC_BASE = join(base, ...publicPath);
    }
    return join(PUBLIC_BASE, ...segments);
}
