import type { DatasetPayload } from "~/types/dataset";
import { Idea01Icon, Upload01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn, getBackendUrl } from "@/lib/utils";
import { useProjectStore } from "@/stores/project.store";
import { useSocketStore } from "@/stores/socket.store";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Combobox,
    ComboboxCollection,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxGroup,
    ComboboxInput,
    ComboboxItem,
    ComboboxLabel,
    ComboboxList,
} from "@/components/ui/combobox";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/item";

export function Step2() {
    return (
        <>
            <ItemGroup className="*:not-first:rounded-t-none *:not-first:border-t-0 *:not-last:rounded-b-none gap-0">
                <Alert>
                    <HugeiconsIcon icon={Idea01Icon} strokeWidth={1.75} />
                    <AlertDescription className="text-wrap">
                        Select a dataset from the dropdown below, or upload your own dataset.
                    </AlertDescription>
                </Alert>
            </ItemGroup>

            <ItemGroup className="*:not-first:rounded-t-none *:not-first:border-t-0 *:not-last:rounded-b-none gap-0">
                <Item variant={"outline"}>
                    <ItemContent>
                        <ItemTitle>Dataset</ItemTitle>
                        <ItemDescription className="line-clamp-none">
                            The dataset source used for validation and report generation.
                        </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                        <DatasetSourceAction />
                    </ItemActions>
                </Item>

                <NewDataset />
            </ItemGroup>
        </>
    );
}

type Dataset = DatasetPayload & {
    id: number;
};
const datasetIdLabel = (dataset: Dataset) => {
    const id = dataset.id;
    if (isNaN(id)) return "Uploaded Dataset";
    return `#${id}`;
};
const areNumbersEqual = (a: number, b: number) => {
    if (Number.isNaN(a) && Number.isNaN(b)) {
        return true;
    }
    return a === b;
};

export function DatasetSourceLabel() {
    const activeDataset = useProjectStore((s) => s.newProject?.data ?? null);
    if (activeDataset?.datasetId == null) return null;
    return datasetIdLabel({
        id: activeDataset.datasetId,
        key: activeDataset.key,
        keyLabel: activeDataset.keyLabel,
        columns: activeDataset.columns,
    });
}

function DatasetSourceAction() {
    const [datasets, setDatasets] = useState<Dataset[]>([]);
    const activeDataset = useProjectStore((s) => {
        const id = s.newProject?.data?.datasetId;
        return (id == null ? null : datasets.find((d) => areNumbersEqual(d.id, id))) ?? null;
    });

    useEffect(() => {
        const action = async () => {
            const res = await useSocketStore
                .getState()
                .emitAck<typeof datasets>("client:dataset:all");
            if (!res) return;

            const current = useProjectStore.getState().newProject?.uploadedDataset ?? null;
            if (current != null) {
                res.push({
                    id: current.datasetId,
                    key: current.key,
                    keyLabel: current.keyLabel,
                    columns: current.columns,
                });
            }
            setDatasets(res);

            useProjectStore.subscribe((s, p) => {
                const pd = p.newProject?.uploadedDataset ?? null;
                const sd = s.newProject?.uploadedDataset ?? null;
                if (pd === sd) return;

                setDatasets((prev) => {
                    if (!sd) {
                        return prev.filter((d) => !areNumbersEqual(d.id, pd!.datasetId));
                    }

                    const exist = prev.some((d) => areNumbersEqual(d.id, sd.datasetId));
                    const newDataset = {
                        id: sd.datasetId,
                        key: sd.key,
                        keyLabel: sd.keyLabel,
                        columns: sd.columns,
                    };
                    if (exist)
                        return prev.map((d) =>
                            areNumbersEqual(d.id, sd.datasetId) ? newDataset : d,
                        );
                    else return [...prev, newDataset];
                });
            });
        };
        void action();
    }, []);

    const datasetChanged = (v: typeof activeDataset) => {
        useProjectStore.setState((s) => {
            const prev = s.newProject;
            if (!prev?.data) return s;

            const rest = v
                ? {
                      key: v.key,
                      keyLabel: v.keyLabel,
                      columns: v.columns,
                      columnKeys: Object.keys(v.columns),
                  }
                : {};
            return {
                newProject: { ...prev, data: { ...prev.data, datasetId: v?.id ?? null, ...rest } },
            };
        });
    };

    useEffect(() => {
        const { registerNextHandler, removeNextHandler } = useProjectStore.getState();

        const handler = registerNextHandler((prev) => {
            if (prev?.datasetId == null) return "Please select a dataset.";
            return "";
        });

        return () => removeNextHandler(handler);
    }, []);

    return (
        <Combobox
            items={datasets}
            value={activeDataset}
            onValueChange={datasetChanged}
            itemToStringLabel={datasetIdLabel}
            limit={5}
        >
            <ComboboxInput placeholder="Select a dataset" className="w-42 h-8" />
            <ComboboxContent className="pointer-events-auto">
                <ComboboxEmpty>No dataset found.</ComboboxEmpty>
                <ComboboxList>
                    <ComboboxGroup>
                        <ComboboxLabel>Limited to 5</ComboboxLabel>
                        <ComboboxCollection>
                            {(dataset) => (
                                <ComboboxItem key={dataset.id} value={dataset}>
                                    {datasetIdLabel(dataset)}
                                </ComboboxItem>
                            )}
                        </ComboboxCollection>
                    </ComboboxGroup>
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    );
}

const getStorageStandardForOS = () => {
    if (typeof window === "undefined") return "decimal";

    const platform =
        // @ts-expect-error - userAgentData is modern but TS types might lag
        window.navigator?.userAgentData?.platform?.toLowerCase() ||
        window.navigator?.platform?.toLowerCase() ||
        "";

    if (platform.includes("win")) {
        return "binary";
    }

    return "decimal";
};

const formatFileSize = (bytes: number, decimals = 3) => {
    if (bytes === 0) return "0 byte";

    const k = getStorageStandardForOS() === "binary" ? 1024 : 1000;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["bytes", "KB", "MB", "GB", "TB", "PB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

function NewDataset() {
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [isDragging, setIsDragging] = useState(false);
    const [isDragInvalid, setIsDragInvalid] = useState(false);
    const [metadata, setMetadata] = useState<{
        lastModified: number;
        name: string;
        size: number;
        columnKeys: string[];
    } | null>(() => {
        const { newProject } = useProjectStore.getState();
        const file = newProject?.uploadedDatasetBuffer;
        if (file) {
            return {
                lastModified: file.lastModified,
                name: file.name,
                size: file.size,
                columnKeys: newProject.data?.columnKeys ?? [],
            };
        }
        return null;
    });

    const isUploaded = useProjectStore((s) => s.newProject?.uploadedDataset != null);

    useEffect(() => {
        const { registerNextHandler, removeNextHandler } = useProjectStore.getState();

        const handler = registerNextHandler((prev) => {
            if (prev?.datasetId == null) return "Please select or upload a dataset.";
            if (!prev || prev.columnKeys.length === 0)
                return "Please select or upload a dataset with at least one column.";
            return "";
        });

        return () => removeNextHandler(handler);
    }, []);

    const handleFileChange = useCallback(
        async (event: React.ChangeEvent<HTMLInputElement> | FileList) => {
            const file = "target" in event ? event.target.files?.[0] : event[0];
            if (!file) return;

            try {
                const buffer = await file.arrayBuffer();
                const url = new URL("/api/dataset/extract", getBackendUrl()).href;
                const res = await fetch(url, {
                    method: "POST",
                    body: buffer,
                    headers: { "Content-Type": "application/octet-stream" },
                    credentials: "include",
                });
                const text = await res.text();
                if (!res.ok) {
                    const message = `Failed to read the CSV file. ${text}`;
                    console.error(message);
                    toast.error(message);
                }

                const columnKeys = JSON.parse(text) as string[];
                const columns: Record<string, "text" | "image"> = {};
                for (const c of columnKeys) {
                    columns[c] = "text";
                }

                useProjectStore.setState((s) => {
                    const prev = s.newProject;
                    if (!prev?.data) return s;

                    const rest = {
                        datasetId: Number.NaN,
                        key: "",
                        keyLabel: "",
                        columns,
                        columnKeys,
                    };
                    return {
                        newProject: {
                            ...prev,
                            data: { ...prev.data, ...rest },
                            uploadedDataset: rest,
                            uploadedDatasetBuffer: file,
                        },
                    };
                });

                setMetadata({
                    name: file.name,
                    size: file.size,
                    lastModified: file.lastModified,
                    columnKeys,
                });
            } catch (error) {
                console.error("Error reading CSV file: ", error);
                toast.error("Could not read the dataset from the selected file.");
            }
        },
        [],
    );

    const handleDrag = useCallback(
        (isDragging: boolean, isInvalid?: boolean) => (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(isDragging);

            let _isInvalid = isInvalid ?? false;
            if (isInvalid === undefined) {
                const items = Array.from(e.dataTransfer.items);
                const containsNonCsv = items.some((item) => {
                    return (
                        item.kind === "file" &&
                        !["text/csv", "application/vnd.ms-excel", "text/plain"].includes(item.type)
                    );
                });

                _isInvalid = containsNonCsv;
            }

            setIsDragInvalid(_isInvalid);
        },
        [],
    );

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            handleDrag(false, false)(e);

            const files = Array.from(e.dataTransfer.files);

            // Filter out anything that isn't a csv
            const csvFiles = files.filter((file) =>
                ["text/csv", "application/vnd.ms-excel", "text/plain"].includes(file.type),
            );

            if (csvFiles.length !== files.length) {
                toast.error("Only CSV files are allowed.");
                return;
            }

            if (csvFiles.length > 0) {
                void handleFileChange(csvFiles as unknown as FileList);
            }
        },
        [handleDrag, handleFileChange],
    );

    return (
        <Item
            className="bg-input/30 relative flex shrink-0 items-center justify-center overflow-hidden p-0"
            onDragOver={handleDrag(true)} // Prevent default behavior to allow drop
            onDragLeave={handleDrag(false, false)} // Reset visual state when leaving
            onDrop={handleDrop} // Capture the files
        >
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="text/csv"
                className="hidden"
                tabIndex={-1}
            />
            {isUploaded ? (
                <div className="relative flex w-full flex-col justify-center px-4 pt-4">
                    <span>
                        File name: <code>{metadata?.name}</code>
                    </span>
                    <span>
                        Size: <code>{formatFileSize(metadata?.size ?? 0)}</code>
                    </span>
                    <span>
                        Last modified:{" "}
                        <code>{new Date(metadata?.lastModified ?? 0).toLocaleString()}</code>
                    </span>
                    <span>
                        Columns: <code>{metadata?.columnKeys.join(", ")}</code>
                    </span>
                </div>
            ) : (
                <div className="relative flex w-full flex-col items-center justify-center px-16 pt-12">
                    <HugeiconsIcon icon={Upload01Icon} className="mb-4 size-12" />
                    <span className="mb-1 text-xl font-semibold">Upload New Dataset</span>
                    <span className="text-center">
                        by dragging and dropping a CSV file or selecting one from your computer.
                    </span>
                    <div className="flex flex-col items-center mt-4 gap-1">
                        <span>Supported file types</span>
                        <Badge variant={"outline"} className="bg-card text-card-foreground">
                            .csv
                        </Badge>
                    </div>
                </div>
            )}

            <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={cn("mb-12 mt-4.5", isUploaded && "mb-4")}
            >
                {isUploaded ? "Change File" : "Pick a File"}
            </Button>

            <div
                className={cn(
                    "absolute bg-popover flex size-full flex-col opacity-0 pointer-events-none items-center justify-center p-12",
                    isDragging && "opacity-100",
                    isDragInvalid && "text-destructive",
                )}
            >
                <div
                    className={cn(
                        "absolute size-full bg-input/30",
                        isDragInvalid && "bg-destructive/10 dark:bg-destructive/20",
                    )}
                />
                <HugeiconsIcon icon={Upload01Icon} className="mb-4 size-16 z-10" />
                <span className="mb-1 text-2xl font-semibold z-10">
                    {isDragInvalid ? "File Not Supported" : "Drop Here"}
                </span>
            </div>
        </Item>
    );
}
