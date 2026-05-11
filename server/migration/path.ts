import { exists, mkdir, readdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { publicDir } from "$/persist";

async function moveFolderContents(sourceDir: string, targetDir: string) {
    try {
        // Check if the source directory exists
        if (!(await exists(sourceDir))) {
            return true;
        }

        // Ensure the target directory exists (creates it if not)
        await mkdir(targetDir, { recursive: true });

        // Read all files/folders from the source
        const files = await readdir(sourceDir);

        // Move each item
        for (const file of files) {
            const oldPath = join(sourceDir, file);
            const newPath = join(targetDir, file);

            await rename(oldPath, newPath);
        }

        return true;
    } catch (error) {
        console.error("An error occurred:", error);
        return false;
    }
}

export async function migratePublicPath() {
    if (process.env.NODE_ENV !== "production") return true;

    return moveFolderContents(publicDir("public"), publicDir());
}
