import { cn } from "@/lib/utils";
import { useSocketStore } from "@/stores/socket.store";

interface SocketStatusProps {
    showText?: boolean;
}
export function SocketStatus({ showText }: SocketStatusProps) {
    const isConnected = useSocketStore((s) => s.socketId !== null);

    return (
        <div className="flex flex-col items-center justify-center">
            <div className="flex h-6 items-center justify-center gap-2">
                <div
                    className={cn(
                        "relative flex aspect-square h-3 *:inline-flex *:rounded-full",
                        isConnected ? "*:bg-(--success-foreground)" : "*:bg-(--error-foreground)",
                    )}
                >
                    <div className="absolute h-full w-full animate-ping opacity-75" />
                    <div className="relative size-full" />
                </div>
                {showText && (
                    <h1 className="text-center text-xl font-semibold">
                        {isConnected ? "Connected" : "Disconnected"}
                    </h1>
                )}
            </div>
        </div>
    );
}
