import type { ChangeEvent } from "react";
import { Logout02Icon, Upload01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRef, useState } from "react";
import { signIn, signOut } from "@/lib/auth";
import { useCallbackLock } from "@/hooks/use-callback-lock";
import { CreateAdminAccountDialog } from "@/components/dialogs/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const base64ToArrayBuffer = async (base64: string) => {
    const response = await fetch(`data:application/octet-stream;base64,${base64}`);
    return response.arrayBuffer();
};

export function AuthView() {
    const [token, setToken] = useState("");
    const [error, setError] = useState("");
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const { invoke: attemptAuth, isLocked } = useCallbackLock(
        async (authToken: ArrayBuffer | string) => {
            if (!authToken) return;
            setError("");

            const buffer =
                typeof authToken === "string" ? await base64ToArrayBuffer(authToken) : authToken;
            await signIn(buffer);
        },
    );

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const buffer = await file.arrayBuffer();
            await attemptAuth(buffer);
        } catch (error) {
            console.log("Error reading key code: ", error);
            setError("Could not read key code from the selected file.");
        }

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    return (
        <Card className="size-full p-6 *:px-0 overflow-y-auto gap-0">
            <CardHeader className="sticky top-0 bg-inherit pb-6">
                <CardTitle>Authentication Required</CardTitle>
                <CardDescription>
                    Provide your access key by pasting it or uploading a key file.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <Input
                    type="text"
                    placeholder="Enter encrypted key"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && attemptAuth(token)}
                    disabled={isLocked}
                />
                <div className="flex flex-col gap-2">
                    <Button
                        onClick={() => attemptAuth(token)}
                        className="w-full"
                        disabled={isLocked}
                    >
                        Authenticate
                    </Button>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="text-muted-foreground bg-white px-2 dark:bg-gray-950">
                                Or
                            </span>
                        </div>
                    </div>

                    <div className="contents">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept=".key"
                            className="hidden"
                            disabled={isLocked}
                        />
                        <Button
                            onClick={() => fileInputRef.current?.click()}
                            variant="outline"
                            className="w-full"
                            disabled={isLocked}
                        >
                            <HugeiconsIcon icon={Upload01Icon} className="mr-2 size-4" /> Upload
                            Auth Key File
                        </Button>
                    </div>
                </div>

                <div className="flex justify-center items-center flex-wrap">
                    Setting up a new project? <CreateAdminAccountDialog />
                </div>

                {error && <p className="text-center text-sm font-medium text-red-500">{error}</p>}
            </CardContent>
        </Card>
    );
}

export function LogoutButton() {
    const { invoke: attemptSignOut, isLocked } = useCallbackLock(async () => {
        await signOut();
    });

    return (
        <Button
            variant="outline"
            size="icon"
            onClick={attemptSignOut}
            aria-label="Sign out"
            disabled={isLocked}
        >
            <HugeiconsIcon icon={Logout02Icon} className="size-4" />
        </Button>
    );
}
