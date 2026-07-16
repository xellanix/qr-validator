import type { NavigationLookup } from "@/components/dialogs/projects/shared";
import { QrCodeIcon, UserLock01Icon } from "@hugeicons/core-free-icons";
import { PresencePage } from "@/components/dialogs/projects/generated/contents/presence";
import { UserKeyPage } from "@/components/dialogs/projects/generated/contents/users";

export const NAVIGATION_LOOKUP: NavigationLookup = {
    "1": {
        id: "1",
        title: "Assigned User Key",
        icon: UserLock01Icon,
        content: <UserKeyPage />,
    },
    "2": {
        id: "2",
        title: "Presence QR",
        icon: QrCodeIcon,
        content: <PresencePage />,
    },
};
export const NAVIGATION_LIST = Object.values(NAVIGATION_LOOKUP);
