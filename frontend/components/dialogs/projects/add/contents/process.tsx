import { useEffect, useRef } from "react";
import { getBackendUrl } from "@/lib/utils";
import { useProjectStore } from "@/stores/project.store";
import { useSocketStore } from "@/stores/socket.store";
import { MAX_STEP_INDEX } from "@/components/dialogs/projects/add/registry";
import { Spinner } from "@/components/ui/spinner";

const quickError = (err: string) => {
    useProjectStore.setState((prev) => {
        const p = prev.newProject;
        if (!p) return prev;

        const activePageIndex = Math.min(Math.max(0, p.activePageIndex + 1), MAX_STEP_INDEX);

        let isSuccess = p.isSuccess;
        if (typeof isSuccess === "string") {
            isSuccess += "\n\n" + err;
        } else {
            isSuccess = err;
        }

        return { newProject: { ...p, activePageIndex, isSuccess } };
    });
};

export function ProcessSection() {
    const isProcessing = useRef(false);

    useEffect(() => {
        if (isProcessing.current) return;
        isProcessing.current = true;

        const action = async () => {
            const np = useProjectStore.getState().newProject;
            const data = np?.data;
            let datasetId = data?.datasetId;
            if (!np || !data || datasetId == null)
                return quickError("Project data or dataset not found.");

            const datasetPayload = {
                columns: data.columns,
                key: data.key,
                keyLabel: data.keyLabel,
            };

            if (datasetId === "uploaded" && np.uploadedDatasetBuffer) {
                const { emitAck } = useSocketStore.getState();
                const _datasetId = await emitAck<string>("client:dataset:add", datasetPayload);
                if (_datasetId == null) return quickError("Failed to add dataset.");

                const url = new URL("/api/dataset/submit", getBackendUrl());
                url.searchParams.append("id", _datasetId);
                url.searchParams.append("key", data.key);

                const res = await fetch(url.href, {
                    method: "POST",
                    body: await np.uploadedDatasetBuffer.arrayBuffer(),
                    headers: { "Content-Type": "application/octet-stream" },
                    credentials: "include",
                });
                const text = await res.text();
                if (!res.ok) {
                    const message = `Failed to submit dataset. ${text}`;
                    console.error(message);
                    return quickError(message);
                }
                datasetId = _datasetId;
            }

            useSocketStore.getState().emit(
                "client:project:add",
                {
                    datasetId,
                    name: data.name,
                    schemaObjects: data.schemaObjects.map(({ sortId, ...rest }) => rest),
                    users: data.users,
                    allowDuplicateValid: data.allowDuplicateValid,
                    maxValidDuplicate: data.maxValidDuplicate,
                    isContinuousScanning: data.isContinuousScanning,
                },
                datasetPayload,
            );
        };

        void action();
    }, []);

    return (
        <div className="flex size-full items-center justify-center">
            <Spinner className="size-12" />
        </div>
    );
}
