import { useSocketStore } from "@/stores/socket.store";

export default function ConsolePage() {
    const isTrulyLocal = useSocketStore((s) => s.isLocal);
    if (!isTrulyLocal) return null;

    if (typeof window === "undefined") return null;

    const href = window.location.href;
    const port = import.meta.env.DEV ? "26052" : "26051";
    if (
        !(href.endsWith(`localhost:${port}/console`) || href.endsWith(`127.0.0.1:${port}/console`))
    ) {
        return null;
    }

    return <></>;
}
