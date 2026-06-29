import type { NavigationLookup } from "@/components/dialogs/projects/shared";
import { QrCodeIcon } from "@hugeicons/core-free-icons";
import { PresencePage } from "@/components/dialogs/projects/generated/contents/presence";

export const NAVIGATION_LOOKUP: NavigationLookup = {
    "1": {
        id: "1",
        title: "Presence QR",
        icon: QrCodeIcon,
        content: <PresencePage />,
    },
};
export const NAVIGATION_LIST = Object.values(NAVIGATION_LOOKUP);
