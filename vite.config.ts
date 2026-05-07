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
        port: 26042,
        proxy: {
            "/api/socket_io/": {
                target: "ws://localhost:26041",
                changeOrigin: true,
                ws: true,
            },
            "/api/assets/": {
                target: "http://localhost:26041",
                changeOrigin: true,
            },
        },
    },
    base: "./",
    build: {
        minify: true,
        assetsInlineLimit: 0,
        outDir: "dist/frontend",
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./frontend"),
            $: path.resolve(__dirname, "./server"),
            "#": path.resolve(__dirname, "./"),
        },
    },
});
