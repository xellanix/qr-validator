import { migrateEnv } from "$/migration/env";
import { migratePublicPath } from "$/migration/path";

export async function startMigration() {
    console.log("⌛ Starting migration if needed...");
    await migrateEnv();
    await migratePublicPath();
    console.log("✅ Migration completed.");
    console.log("");
}

await startMigration();
