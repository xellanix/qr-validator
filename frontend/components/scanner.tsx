/* eslint-disable react-hooks/immutability */
import { Alert02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { QRCanvas, frontalCamera } from "qr/dom.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { validate } from "@/lib/validation";
import { useHistoryStore } from "@/stores/history.store";
import { useProjectStore } from "@/stores/project.store";
import { useSocketStore } from "@/stores/socket.store";
import { useUserStore } from "@/stores/user.store";
import { useValidateStore } from "@/stores/validate.store";
import { ValidationDialog } from "@/components/dialogs/validation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function ScannerView() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const cameraRef = useRef<Awaited<ReturnType<typeof frontalCamera>> | null>(null);
    const canvasRef = useRef<QRCanvas | null>(null);

    const requestRef = useRef<number>(0);
    const lastScanTime = useRef<number>(0);
    const isScanningRef = useRef(false);

    const [isScanning, setIsScanning] = useState(false);
    const [lastMessage, setLastMessage] = useState<string>("Scanner stopped.");

    const cleanupScanner = useCallback(() => {
        isScanningRef.current = false;

        if (requestRef.current) {
            cancelAnimationFrame(requestRef.current);
        }

        if (cameraRef.current) {
            cameraRef.current.stop();
            cameraRef.current = null;
        }

        if (canvasRef.current) {
            canvasRef.current.clear();
            canvasRef.current = null;
        }

        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    }, []);

    const stopScanner = useCallback(() => {
        cleanupScanner();
        setIsScanning(false);
        setLastMessage((p) => (p === "Scanner active..." ? "Scanner stopped." : p));
    }, [cleanupScanner]);

    // The core scanning function, runs in a loop via requestAnimationFrame
    const scanFrame = useCallback(() => {
        // Stop the loop if the component is no longer in a scanning state
        if (!isScanningRef.current) return;

        const now = Date.now();
        // Throttle scanning to 10 FPS (100ms delay)
        // Most QR libraries don't need 60fps to be effective.
        if (now - lastScanTime.current < 100) {
            requestRef.current = requestAnimationFrame(scanFrame);
            return;
        }
        lastScanTime.current = now;

        if (
            !videoRef.current ||
            !cameraRef.current ||
            !canvasRef.current ||
            videoRef.current.paused
        ) {
            return;
        }

        const frame = cameraRef.current.readFrame(canvasRef.current, true);

        if (frame) {
            videoRef.current.pause(); // Pause video to "freeze" on the scanned code
            // QR code found!
            console.log("QR code scanned:", frame);
            useSocketStore
                .getState()
                .emitAck<string>("client:security:decrypt", frame)
                .then(
                    (res) => {
                        const resumeScan = () => {
                            videoRef.current?.play().then(
                                () => (requestRef.current = requestAnimationFrame(scanFrame)),
                                () => {},
                            );
                        };

                        if (!res) return resumeScan(); // Resume scanning after a failed validation

                        const schemaValidation = validate(res);
                        if (!schemaValidation.success) {
                            setLastMessage(schemaValidation.error.message);
                            return resumeScan();
                        }

                        const project = useProjectStore.getState().getProject();
                        let totalDuplicates = 0;
                        for (const entry of useHistoryStore.getState().entries) {
                            if (entry.data === res && entry.status === "Valid") {
                                if (project?.allowDuplicateValid) {
                                    if (++totalDuplicates > project.maxValidDuplicate) {
                                        setLastMessage(`Skipped: Too many valid duplicates.`);
                                        return resumeScan();
                                    }
                                } else {
                                    setLastMessage(`Skipped: Already in history.`);
                                    return resumeScan();
                                }
                            }
                        }

                        if (project && !project.isContinuousScanning) {
                            stopScanner();
                        }

                        setLastMessage(`Found: ${res.substring(0, 30)}...`);
                        useValidateStore.getState().setCandidate(schemaValidation.value);
                    },
                    () => {},
                );
        } else {
            setLastMessage("Scanner active...");
            // No code found, request the next animation frame to continue
            requestRef.current = requestAnimationFrame(scanFrame);
        }
    }, [stopScanner]);

    useEffect(() => {
        // Stop scanning if the component is no longer in a scanning state
        if (!isScanning) {
            cleanupScanner();
            return;
        }

        // Start scanning if the component is in a scanning state

        // Use a local variable to prevent starting if the component unmounts mid-stream
        let isActive = true;

        // Start the scanning process
        void (async () => {
            try {
                if (!videoRef.current) return;

                canvasRef.current = new QRCanvas();
                cameraRef.current = await frontalCamera(videoRef.current);

                if (isActive) {
                    await videoRef.current.play();
                    setLastMessage("Scanner active...");
                    isScanningRef.current = true;
                    requestRef.current = requestAnimationFrame(scanFrame);
                }
            } catch (err) {
                if (isActive) {
                    console.error("Camera error:", err);
                    let message = "Error: Could not start camera.";
                    if (err instanceof Error && err.name === "NotAllowedError") {
                        message = "Error: Camera permission denied.";
                    }
                    setLastMessage(message);
                    setIsScanning(false);
                }
            }
        })();

        return () => {
            isActive = false;
            cleanupScanner();
        };
    }, [cleanupScanner, isScanning, scanFrame]);

    const validationCandidate = useValidateStore((s) => s.candidate);
    useEffect(() => {
        if (isScanning && !validationCandidate && videoRef.current?.paused) {
            videoRef.current
                .play()
                .then(() => {
                    isScanningRef.current = true;
                    requestRef.current = requestAnimationFrame(scanFrame);
                })
                .catch((err) => {
                    console.error("Failed to resume video:", err);
                    setLastMessage("Error: Could not resume scanner.");
                });
        }
    }, [isScanning, validationCandidate, scanFrame]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === "hidden" && isScanning) {
                stopScanner();
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [isScanning, stopScanner]);

    if (!useUserStore((s) => s.canScan)) {
        return (
            <div className="flex h-48 flex-col items-center justify-center text-center">
                <HugeiconsIcon
                    icon={Alert02Icon}
                    className="mb-4 size-12 text-(--warning-foreground)"
                />
                <p className="font-semibold">Access Denied</p>
                <p className="text-sm text-gray-500">
                    You do not have permission to use the scanner.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center gap-4 size-full">
            <div className="flex aspect-square w-full max-w-sm items-center justify-center overflow-hidden rounded-lg border-2 border-input border-dashed bg-muted">
                <video
                    ref={videoRef}
                    playsInline // Crucial for inline playback on mobile browsers
                    className="h-full w-full object-cover"
                />
            </div>
            <div className="h-6">
                {lastMessage && <Badge variant="secondary">{lastMessage}</Badge>}
            </div>
            <Button type="button" onClick={() => setIsScanning((prev) => !prev)} className="w-42">
                {isScanning ? "Stop" : "Start"} Scanning
            </Button>
            <ValidationDialog />
        </div>
    );
}
