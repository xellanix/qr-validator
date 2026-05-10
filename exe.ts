import version from "./frontend/data/version.json";

console.log("⌛ Building server...");

const result = await Bun.build({
    entrypoints: ["./server/index.ts"],
    compile: {
        target: "bun-windows-x64",
        outfile: "./dist/server/premark",
        execArgv: ["--smol"],
        autoloadDotenv: false,
        autoloadBunfig: false,
        windows: {
            icon: "./public/favicon.ico",
            hideConsole: false,
            title: "Xellanix PreMark",
            publisher: "Xellanix",
            version: version.version,
            description: "Xellanix PreMark",
            copyright: "Copyright (c) 2025-2026, Xellanix",
        },
    },
    minify: true,
    sourcemap: "none",
    bytecode: true,
    define: {
        "process.env.NODE_ENV": JSON.stringify("production"),
        "process.env.ENCRYPTION_KEY": JSON.stringify(process.env.ENCRYPTION_KEY),
        "process.env.JWT_SECRET": JSON.stringify(process.env.JWT_SECRET),
        "process.env.USERDATA_ENCRYPTION_KEY": JSON.stringify(process.env.USERDATA_ENCRYPTION_KEY),
        "process.env.HASH_SECRET": JSON.stringify(process.env.HASH_SECRET),
        "process.env.AUTH_ENCRYPTION_KEY": JSON.stringify(process.env.AUTH_ENCRYPTION_KEY),
        VERSION: JSON.stringify(version.version),
    },
});

if (result.success) {
    console.log("✅ Successfully built server:", result.outputs[0].path);
} else {
    console.error("❌ Failed to build server:", result.logs);
}

export {};
