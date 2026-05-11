import { migratePublicPath } from "$/migration/path";

export async function startMigration() {
    await migratePublicPath();
}
