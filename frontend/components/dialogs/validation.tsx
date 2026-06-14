import type { DatasetRow, DatasetRowValue } from "~/types/dataset";
import type { ScanStatus } from "@/types";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useProjectStore } from "@/stores/project.store";
import { useSocketStore } from "@/stores/socket.store";
import { useValidateStore } from "@/stores/validate.store";
import { useCallbackLock } from "@/hooks/use-callback-lock";
import { fieldBuilder } from "@/components/generators";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

export function ValidationDialog() {
    const qrData = useValidateStore((s) => s.candidate);
    const isOpen = !!qrData;

    const { invoke: onSubmit } = useCallbackLock(async (status: ScanStatus) => {
        const candidate = useValidateStore.getState().candidate;
        if (candidate) {
            const res = await useSocketStore
                .getState()
                .emitAck<string>("client:history:validation", candidate, status);

            res && toast.success(res);
        }
        useValidateStore.getState().setCandidate(null);
    });

    if (!isOpen || !qrData) return null;

    return (
        <Dialog open={isOpen} onOpenChange={() => useValidateStore.getState().setCandidate(null)}>
            <DialogContent className="xs:max-w-106 xs:max-h-[80dvh] not-xs:max-w-dvw flex max-h-dvh w-dvw flex-col">
                <DialogHeader>
                    <DialogTitle>Validate Scanned Data</DialogTitle>
                </DialogHeader>
                <div className="flex flex-1 flex-col gap-4 overflow-hidden py-4">
                    <div className="flex flex-col items-center justify-start gap-2 overflow-auto">
                        <ValidationData entry={qrData} />
                    </div>
                </div>
                <DialogFooter className="flex-row justify-end">
                    <Button variant="outline" onClick={() => onSubmit("Not Valid")}>
                        Not Valid
                    </Button>
                    <Button onClick={() => onSubmit("Valid")}>Valid</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

async function getValidationFields(keyValue: DatasetRowValue) {
    const _active = useProjectStore.getState().activeProject();
    if (!_active) return;

    const emitAck = useSocketStore.getState().emitAck<DatasetRow>;
    const detailed = await emitAck("client:dataset:row:get", _active.id, keyValue);
    if (!detailed) return;

    const built = Object.entries(detailed).map(([key, value]) => {
        const columns = _active.columns;
        if (key in columns) {
            return fieldBuilder[columns[key]](value);
        }
    });

    return built;
}

export function ValidationData({ entry }: { entry: DatasetRowValue }) {
    const [result, setResult] = useState<React.ReactNode[] | undefined>(undefined);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const action = async () => {
            setLoading(true);

            const comp = await getValidationFields(entry);
            setResult(comp);

            setLoading(false);
        };

        void action();
    }, [entry]);

    return (
        <div className="contents">
            {loading && (
                <div className="mt-6 flex w-full items-center justify-center">
                    <Spinner className="size-6" />
                </div>
            )}
            {result}
        </div>
    );
}
