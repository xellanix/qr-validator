import { atomicWrite } from "$/lib/utils";
import { execDir } from "$/persist";

export async function migrateEnv() {
    const b32s = ["ENCRYPTION_KEY", "AUTH_ENCRYPTION_KEY", "USERDATA_ENCRYPTION_KEY"];
    const b64s = ["HASH_SECRET", "JWT_SECRET"];
    const linesToAdd: string[] = [];

    for (const key of b32s) {
        if (!process.env[key]) {
            const base64 = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
            process.env[key] = base64;
            linesToAdd.push(`${key}=${base64}`);
        }
    }
    for (const key of b64s) {
        if (!process.env[key]) {
            const base64 = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(64))));
            process.env[key] = base64;
            linesToAdd.push(`${key}=${base64}`);
        }
    }

    if (linesToAdd.length === 0) return;
    console.log("> Generating missing environment variables...");

    const envPath = execDir(".env");
    const file = Bun.file(envPath);

    let existingContent = "";
    if (await file.exists()) {
        existingContent = await file.text();
    }

    const needsNewline = existingContent.length > 0 && !existingContent.endsWith("\n");
    const prefix = needsNewline ? "\n" : "";

    const contentToAppend = prefix + linesToAdd.join("\n") + "\n";

    await atomicWrite(envPath, existingContent + contentToAppend);
}
