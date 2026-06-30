import type { User } from "~/types/user";
import type { Permissions } from "@/types/permission";

export const readOnlyPermission: Permissions = {
    canScan: false,
    canReport: false,
    canDelete: false,
    isUseDataset: false,
    canAccessConsole: false,
};

export function getPermissions(level: User["authorizeLevel"]) {
    // level 0: Read-Only
    const permissions: Permissions = { ...readOnlyPermission };

    // Read-Write
    if (level >= 1) {
        permissions.canScan = true;
    }

    // Read-Write-Generate
    if (level >= 2) {
        permissions.isUseDataset = true;
        permissions.canReport = true;
        permissions.canDelete = true;
    }

    if (level >= 3) {
        permissions.canAccessConsole = true;
    }

    return permissions;
}
