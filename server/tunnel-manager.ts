import type { ChildProcess } from "node:child_process";
import type { TunnelStatus } from "@/types/tunnel";
import { spawn } from "node:child_process";
import EventEmitter from "node:events";

declare global {
    var __TUNNEL_MANAGER__: TunnelManager | undefined;
}

export class TunnelManager extends EventEmitter {
    private tunnelProcess: ChildProcess | null = null;
    private currentUrl: string | null = null;
    private _processing: boolean = false;

    constructor() {
        super();
        const handler = (signal: string | number) => {
            console.log(`Received ${signal}. Shutting down gracefully...`);
            this.forceKill();
            console.log("Press Ctrl+C again to exit.");
            process.exit(typeof signal === "number" ? signal : 0);
        };

        // AUTOMATIC KILL SWITCH:
        // This ensures that if you kill the server (Ctrl+C),
        // the tunnel child process is also killed immediately.
        (["SIGINT", "SIGTERM", "SIGHUP", "SIGQUIT"] as const).forEach((signal) => {
            process.removeAllListeners(signal);
            process.once(signal, handler);
        });

        process.once("exit", handler);
    }

    static getInstance(): TunnelManager {
        if (!global.__TUNNEL_MANAGER__) {
            global.__TUNNEL_MANAGER__ = new TunnelManager();
        }
        return global.__TUNNEL_MANAGER__;
    }

    get status(): TunnelStatus {
        if (this._processing) {
            return { active: undefined, url: null };
        }
        return {
            active: !!this.currentUrl,
            url: this.currentUrl,
        };
    }

    async startTunnel(port: number): Promise<TunnelStatus> {
        if (this._processing) {
            throw new Error("BUSY: Tunnel is already transitioning states.");
        }
        if (this.currentUrl) return this.status;

        this._processing = true; // Lock acquired

        try {
            console.log("Spawning native cloudflared process...");

            return await new Promise<TunnelStatus>((resolve, reject) => {
                // Spawn the binary directly
                const child = spawn(
                    "cloudflared",
                    ["tunnel", "--url", `http://localhost:${port}`],
                    {
                        stdio: ["ignore", "ignore", "pipe"],
                    },
                );
                this.tunnelProcess = child;

                // Failsafe: If regex never matches, reject after 15s
                const timeout = setTimeout(() => {
                    this.forceKill();
                    reject(new Error("Timed out waiting for Cloudflare URL"));
                }, 15000);

                // Listen to stderr for the URL (Cloudflare outputs logs to stderr)
                child.stderr.on("data", (data) => {
                    const output = data.toString() as string;
                    // Regex to catch the "trycloudflare.com" URL
                    const match = /https:\/\/[\w-]+\.trycloudflare\.com/.exec(output);

                    if (match) {
                        clearTimeout(timeout);
                        this.currentUrl = match[0];
                        console.log(`Tunnel Ready: ${this.currentUrl}`);
                        resolve({
                            active: !!this.currentUrl,
                            url: this.currentUrl,
                        });
                    }
                });

                // Handle Errors (e.g., binary not found)
                child.on("error", (err) => {
                    clearTimeout(timeout);
                    reject(err);
                });

                // Handle Unexpected Exit
                child.on("close", (code) => {
                    clearTimeout(timeout);
                    // Only reject if we were trying to start.
                    // If we are stopping, this is normal.
                    if (!this.currentUrl) {
                        reject(new Error(`Process exited early code ${code}`));
                    }
                });

                child.once("exit", () => {
                    console.warn("Process dead, port freed. It was probably killed externally.");
                    this.cleanup(1);
                });
            });
        } finally {
            this._processing = false; // Lock released
        }
    }

    async stopTunnel(): Promise<TunnelStatus> {
        if (this._processing) {
            throw new Error("BUSY: Tunnel is already transitioning states.");
        }
        if (!this.tunnelProcess) return this.status;

        this._processing = true; // Lock acquired

        try {
            console.log("Stopping Tunnel...");

            await new Promise<void>((resolve) => {
                if (!this.tunnelProcess) return resolve();

                // Listen for the actual exit event
                this.tunnelProcess.once("exit", () => resolve());

                // Send the kill signal
                this.tunnelProcess.kill("SIGTERM");
            });

            return this.cleanup(0);
        } finally {
            this._processing = false; // Lock released
        }
    }

    // Synchronous kill for server shutdown (emergency only)
    private forceKill() {
        if (!this.tunnelProcess) return;
        console.log("Force killing tunnel process...");

        try {
            // Negative PID kills the entire process group
            process.kill(-this.tunnelProcess.pid!, "SIGTERM");
        } catch {
            // Fallback if process group kill fails
            this.tunnelProcess.kill("SIGTERM");
        }

        this.cleanup(-1);
    }

    private cleanup(retCode: -1 | 1): void;
    private cleanup(retCode: 0): { active: false; url: null };
    private cleanup(retCode: -1 | 0 | 1) {
        this.tunnelProcess = null;
        this.currentUrl = null;

        const res = { active: false, url: null };
        if (retCode === 0) return res;
        else if (retCode === 1) this.emit("status:changed", res);
    }
}
