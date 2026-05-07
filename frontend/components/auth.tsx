import type { ChangeEvent } from "react";
import type { User } from "@/types";
import { Logout02Icon, Upload01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { decodeQR } from "qr/decode.js";
import { useRef, useState } from "react";
import { signIn, signOut } from "@/lib/auth";
import { useSocketStore } from "@/stores/socket.store";
import { useCallbackLock } from "@/hooks/use-callback-lock";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const fileToImageData = async (file: File) => {
    // Create an ImageBitmap from the file
    const imageBitmap = await createImageBitmap(file);

    // Create a canvas
    const canvas = document.createElement("canvas");
    canvas.width = imageBitmap.width;
    canvas.height = imageBitmap.height;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
        throw new Error("Failed to get canvas context");
    }

    // Draw the ImageBitmap onto the canvas
    ctx.drawImage(imageBitmap, 0, 0);

    // Get the ImageData from the canvas
    return ctx.getImageData(0, 0, imageBitmap.width, imageBitmap.height);
};

export function AuthView() {
    const [token, setToken] = useState("");
    const [error, setError] = useState("");
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const { invoke: attemptAuth, isLocked } = useCallbackLock(async (authToken: string) => {
        if (!authToken) return;
        setError("");
        const emitAck = useSocketStore.getState().emitAck;
        const res = await emitAck<User>("client:auth:authenticate", authToken);

        if (!res) return;
        signIn(res, authToken);
    });

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const imageData = await fileToImageData(file);
            const decodedText = decodeQR(imageData);
            setToken(decodedText);
            await attemptAuth(decodedText);
        } catch (error) {
            console.log("Error decoding QR code: ", error);
            setError("Could not read QR code from the selected file.");
        }

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    return (
        <Card className="size-full">
            <CardHeader>
                <CardTitle>Authentication Required</CardTitle>
                <CardDescription>
                    Provide your access token by pasting it or uploading a QR code image.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Input
                        type="text"
                        placeholder="Enter encrypted token"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && attemptAuth(token)}
                        disabled={isLocked}
                    />
                    <Button
                        onClick={() => attemptAuth(token)}
                        className="w-full"
                        disabled={isLocked}
                    >
                        Authenticate
                    </Button>
                </div>
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

                <div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        className="hidden"
                        disabled={isLocked}
                    />
                    <Button
                        onClick={() => fileInputRef.current?.click()}
                        variant="outline"
                        className="w-full"
                        disabled={isLocked}
                    >
                        <HugeiconsIcon icon={Upload01Icon} className="mr-2 size-4" /> Upload Auth QR
                        Code
                    </Button>
                </div>

                {error && <p className="text-center text-sm font-medium text-red-500">{error}</p>}
            </CardContent>
        </Card>
    );
}

export function LogoutButton() {
    return (
        <Button variant="outline" size="icon" onClick={signOut} aria-label="Sign out">
            <HugeiconsIcon icon={Logout02Icon} className="size-4" />
        </Button>
    );
}
