import { useUserStore } from "@/stores/user.store";

export default function ConsolePage() {
    if (!useUserStore.getState().hasConsoleAccess()) {
        return null;
    }

    return <></>;
}
