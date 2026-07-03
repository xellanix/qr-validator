import { defineConfig } from "vite";
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import path from "path"

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react(),
        babel({ presets: [reactCompilerPreset()] })
    ],
    server: {
        allowedHosts: [".trycloudflare.com"],
        port: 26052,
        proxy: {
            "/api/socket_io/": {
                target: "ws://localhost:26051",
                changeOrigin: true,
                ws: true,
            },
        },
    },
    base: "./",
    build: {
        minify: true,
        assetsInlineLimit: 0,
        outDir: "server/dist/frontend",
        modulePreload: false
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./frontend"),
            "#": path.resolve(__dirname, "./"),
        },
    },
});
