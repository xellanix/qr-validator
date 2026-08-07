import { Download01Icon, Refresh01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getBackendUrl, getDispositionFilename } from "@/lib/utils";
import { useProjectStore } from "@/stores/project.store";
import { useReportStore } from "@/stores/report.store";
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
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from "@/components/ui/input-group";
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const generateReportFile = async () => {
    const projectId = useProjectStore.getState().activeId ?? "";
    const { batch, ext, grouped } = useReportStore.getState();
    const batchNumber = typeof batch === "string" ? 0 : batch;

    const id = toast.loading(`Generate presence report for ${projectId} ...`);

    try {
        if (!projectId) throw new Error("Project ID is required");
        if (batchNumber == null) throw new Error("Batch number is required");
        if (batchNumber < 1) throw new Error("Batch number must be at least 1");
        if (!ext) throw new Error("File extension is required");
        if (/\^(csv|json)$/.test(ext)) throw new Error("Invalid file extension");

        const api = new URL(
            `/api/generate/report/${encodeURIComponent(projectId)}/${encodeURIComponent(batchNumber)}/${encodeURIComponent(ext)}/${encodeURIComponent(grouped)}`,
            getBackendUrl(),
        ).href;
        const res = await fetch(api, {
            method: "GET",
            headers: {
                // This allows the browser to receive and store the HttpOnly cookie
                credentials: "include",
            },
        });

        if (!res.ok) {
            const errorText = await res.text();
            // Fallback to the HTTP status text if the backend sent an empty body
            throw new Error(errorText || `Status ${res.status}: ${res.statusText}`);
        }

        // Look for the Content-Disposition header from Fiber
        const filename = getDispositionFilename(
            res.headers.get("content-disposition"),
            `presence_report_${projectId}_${batchNumber}${grouped ? "_grouped" : ""}.${ext}`,
        );

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;

        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        toast.success(`Presence report for ${projectId} generated successfully`);
        return true;
    } catch (error) {
        const msg = `Error generate report file: ${error instanceof Error ? error.message : String(error)}`;
        console.error(msg);
        toast.error(msg);
        return false;
    } finally {
        toast.dismiss(id);
    }
};

export function DownloadReportDialog() {
    const projectName = useProjectStore(
        (s) => (s.activeId && s.projects[s.activeId]?.name) ?? "Unknown Project",
    );
    const [isOpen, setIsOpen] = useState<boolean>(false);

    useEffect(() => {
        void (async () => {
            const projectId = useProjectStore.getState().activeId ?? "";
            const emitAck = useSocketStore.getState().emitAck<number>;
            const batchNumber = await emitAck("client:project:activation:batch_number", projectId);
            if (batchNumber === undefined) return;

            useReportStore.setState({ batch: batchNumber, defaultBatch: batchNumber });
        })();
    }, []);

    const { invoke, isLocked } = useCallbackLock(async () => {
        const success = await generateReportFile();
        if (success) setIsOpen(false);
    });

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <HugeiconsIcon icon={Download01Icon} />
                    Download
                </Button>
            </DialogTrigger>

            <DialogContent
                className="overflow-hidden max-md:size-full p-0 [&>div]:px-6 py-6 max-md:max-w-full! md:h-[80dvh] md:max-h-[80dvh] md:max-w-[80dvw] lg:max-w-[90dvw] grid-rows-[auto_1fr_auto]"
                showCloseButton={false}
                onEscapeKeyDown={disableCloseExceptButton}
                onPointerDownOutside={disableCloseExceptButton}
                onInteractOutside={disableCloseExceptButton}
            >
                <DialogHeader>
                    <DialogTitle>Download Presence Report</DialogTitle>
                    <DialogDescription>
                        Active project: <b className="font-semibold">{projectName}</b>
                    </DialogDescription>
                </DialogHeader>

                <fieldset className="contents" disabled={isLocked}>
                    <div className="flex flex-col gap-4 size-full overflow-auto px-6">
                        <ItemGroup className="*:not-first:rounded-t-none *:not-first:border-t-0 *:not-last:rounded-b-none gap-0!">
                            <BatchItem />
                        </ItemGroup>
                        <ItemGroup className="*:not-first:rounded-t-none *:not-first:border-t-0 *:not-last:rounded-b-none gap-0!">
                            <ExtensionItem />
                        </ItemGroup>
                        <ItemGroup className="*:not-first:rounded-t-none *:not-first:border-t-0 *:not-last:rounded-b-none gap-0!">
                            <SortItem />
                            <GroupedItem />
                        </ItemGroup>
                    </div>

                    <DialogFooter className="flex-row justify-end px-6">
                        <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button type="submit" onClick={invoke}>
                            Download
                        </Button>
                    </DialogFooter>
                </fieldset>
            </DialogContent>
        </Dialog>
    );
}

function BatchItem() {
    return (
        <Item variant={"outline"}>
            <ItemContent>
                <ItemTitle>Batch Number</ItemTitle>
            </ItemContent>
            <ItemActions>
                <BatchAction />
            </ItemActions>
        </Item>
    );
}
function BatchAction() {
    const batch = useReportStore((s) => s.batch);

    const onChanged = (e: React.ChangeEvent<HTMLInputElement, HTMLInputElement>) => {
        const value = e.target.value.trim();
        useReportStore.getState().setBatch(value.length ? parseInt(value) : "");
    };

    return (
        <InputGroup className="w-24 h-8">
            <InputGroupInput
                type="number"
                value={batch}
                placeholder="e.g. 1, 2, 3"
                required
                onChange={onChanged}
            />
            <InputGroupAddon align={"inline-end"}>
                <InputGroupButton
                    size={"icon-sm"}
                    className="rounded-full"
                    onClick={useReportStore.getState().resetBatch}
                >
                    <HugeiconsIcon icon={Refresh01Icon} />
                </InputGroupButton>
            </InputGroupAddon>
        </InputGroup>
    );
}

function ExtensionItem() {
    return (
        <Item variant={"outline"}>
            <ItemContent>
                <ItemTitle>Extension</ItemTitle>
            </ItemContent>
            <ItemActions>
                <ExtensionAction />
            </ItemActions>
        </Item>
    );
}
function ExtensionAction() {
    const ext = useReportStore((s) => s.ext);

    const onChanged = (value: string) => {
        useReportStore.getState().setExt(value);
    };

    return (
        <Select value={ext} onValueChange={onChanged} required>
            <SelectTrigger size="sm" className="w-24">
                <SelectValue placeholder="Extension" />
            </SelectTrigger>
            <SelectContent>
                <SelectGroup>
                    <SelectLabel>Extension</SelectLabel>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                </SelectGroup>
            </SelectContent>
        </Select>
    );
}

function SortItem() {
    const dataKey = useProjectStore((s) => s.activeId && s.projects[s.activeId]?.key);
    if (!dataKey) return null;

    return (
        <Item variant={"outline"}>
            <ItemContent>
                <ItemTitle>
                    Sort By <code>{dataKey}</code>
                </ItemTitle>
            </ItemContent>
            <ItemActions>
                <Switch checked disabled />
            </ItemActions>
        </Item>
    );
}

function GroupedItem() {
    return (
        <Item variant={"outline"}>
            <ItemContent>
                <ItemTitle>Group By Presence</ItemTitle>
            </ItemContent>
            <ItemActions>
                <GroupedAction />
            </ItemActions>
        </Item>
    );
}
function GroupedAction() {
    const grouped = useReportStore((s) => s.grouped);

    const checkChanged = (checked: boolean) => {
        useReportStore.getState().setGrouped(checked);
    };

    return <Switch checked={grouped} onCheckedChange={checkChanged} required />;
}
