import React, { useCallback, useEffect, useState } from "react";
import { useProjectStore } from "@/stores/project.store";
import { useSocketStore } from "@/stores/socket.store";
import { useCallbackLock } from "@/hooks/use-callback-lock";
import { disableCloseExceptButton } from "@/components/dialogs/shared";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

interface ActivateProjectDialogProps {
    projectId: string;
    isOpen: boolean;
    setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}
export function ActivateProjectDialog({
    projectId,
    isOpen,
    setIsOpen,
}: ActivateProjectDialogProps) {
    const projectName = useProjectStore((s) => s.projects[projectId]?.name ?? "Unknown Project");
    const [lastBatch, setLastBatch] = useState<number>(1);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        void (async () => {
            const emitAck = useSocketStore.getState().emitAck<number>;
            const batchNumber = await emitAck("client:project:activation:batch_number", projectId);
            if (batchNumber === undefined) return;

            setLastBatch(Math.max(batchNumber, 1));
        })();
    }, [projectId]);

    const validate = useCallback((value: string) => {
        const batchNumber = parseInt(value.trim());
        if (isNaN(batchNumber)) {
            setError("Batch number must be a number.");
            return;
        } else if (batchNumber < 1) {
            setError("Batch number must be at least 1.");
            return;
        }

        setError(null);
        return batchNumber;
    }, []);

    const { invoke: attemptSignUp, isLocked } = useCallbackLock(
        async (e: React.SubmitEvent<HTMLFormElement>) => {
            e.preventDefault();

            const formData = new FormData(e.currentTarget);
            const batchNumber = validate(formData.get("batch_number") as string);
            if (batchNumber === undefined) return;

            const { emitAck } = useSocketStore.getState();
            const success = await emitAck<boolean>(
                "client:project:activation:toggle",
                projectId,
                true,
                batchNumber,
            );
            if (!success) return;

            setLastBatch(batchNumber);
            setIsOpen(false);
        },
    );

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent
                showCloseButton={false}
                onEscapeKeyDown={disableCloseExceptButton}
                onPointerDownOutside={disableCloseExceptButton}
                onInteractOutside={disableCloseExceptButton}
            >
                <DialogHeader>
                    <DialogTitle>Activate Project</DialogTitle>
                    <DialogDescription>
                        Please enter the presence history batch number for this project:{" "}
                        <b className="font-semibold">{projectName}</b> (<code>{projectId}</code>)
                    </DialogDescription>
                </DialogHeader>

                <form className="flex flex-col gap-6" onSubmit={attemptSignUp}>
                    <fieldset className="contents" disabled={isLocked}>
                        <Field data-invalid={!!error}>
                            <FieldLabel htmlFor="batch_number">Batch Number</FieldLabel>
                            <Input
                                type="number"
                                name="batch_number"
                                id="batch_number"
                                defaultValue={lastBatch}
                                placeholder="e.g. 1, 2, 3"
                                required
                                aria-invalid={!!error}
                                onChange={(e) => validate(e.target.value)}
                            />
                            <FieldDescription>
                                Starting from 1. Last batch number:{" "}
                                <code className="bg-muted text-muted-foreground inline-flex h-5.5 items-center justify-center rounded-sm px-1 font-medium">
                                    {lastBatch}
                                </code>
                            </FieldDescription>
                            {error && <FieldError className="text-destructive">{error}</FieldError>}
                        </Field>
                        <DialogFooter className="flex-row justify-end">
                            <DialogClose asChild>
                                <Button variant="outline">Cancel</Button>
                            </DialogClose>
                            <Button type="submit" disabled={isLocked || !!error}>
                                Activate
                            </Button>
                        </DialogFooter>
                    </fieldset>
                </form>
            </DialogContent>
        </Dialog>
    );
}
