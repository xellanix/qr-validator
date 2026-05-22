import { exists, mkdir, readdir, rename, rmdir } from "node:fs/promises";
import { join } from "node:path";
import { publicDir } from "$/persist";

async function removeDirIfEmpty(dirPath: string) {
    try {
        const items = await readdir(dirPath, { withFileTypes: true });

        // Recurse into any nested directories first
        for (const item of items) {
            const fullPath = join(dirPath, item.name);
            if (item.isDirectory()) {
                // Go deeper
                await removeDirIfEmpty(fullPath);
            } else {
                // It contains a file, so this parent directory cannot be safely deleted
                console.log(`> Old directory is not empty. Skipping...`);
                return false;
            }
        }

        // Now that the subdirectories are cleaned out, try deleting this folder
        await rmdir(dirPath);
        console.log(`Successfully removed: ${dirPath}`);
        return true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        if (error.code === "ENOENT") {
            console.log(`> Old directory does not exist.`);
            return false;
        }

        throw error;
    }
}

async function moveFolderContents(sourceDir: string, targetDir: string) {
    try {
        // Check if the source directory exists
        if (!(await exists(sourceDir))) {
            return true;
        }

        console.log("> Migating public path...");

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

        // Remove the source directory if it's empty
        await removeDirIfEmpty(sourceDir);

        return true;
    } catch (error) {
        console.error("> An error occurred:", error);
        return false;
    }
}

export async function migratePublicPath() {
    if (process.env.NODE_ENV !== "production") return true;

    return moveFolderContents(publicDir("public"), publicDir());
}
