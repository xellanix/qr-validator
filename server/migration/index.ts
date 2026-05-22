import { migrateEnv } from "$/migration/env";
import { migratePublicPath } from "$/migration/path";

export async function startMigration() {
    await migrateEnv();
    await migratePublicPath();
}

await startMigration();
