import type { PresenceContent } from "~/types/generated-contents";
import type { ProjectItem } from "@/types/project";
import { Download01Icon, Idea01Icon, Refresh01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { getBackendUrl } from "@/lib/utils";
import { useProjectStore } from "@/stores/project.store";
import { useSocketStore } from "@/stores/socket.store";
import { useCallbackLock } from "@/hooks/use-callback-lock";
import { useDialogContent } from "@/components/context/dialog";
import { FrameContainer } from "@/components/dialogs/projects/shared/frame";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const getPresenceFiles = async (projectId: ProjectItem["id"], key: string) => {
    const trimmed = projectId.trim();
    if (!trimmed) return null;

    const emitAck = useSocketStore.getState().emitAck<PresenceContent[]>;
    const presences = await emitAck("client:presence:fetch", trimmed, key);
    if (!presences) return null;

    return presences;
};

export function PresencePage() {
    const [query, setQuery] = useState("");
    const deferredValue = useDeferredValue(query);

    const presences = useProjectStore(useShallow((s) => s.generatedContents?.presences ?? []));
    const { missing, generated } = useMemo(() => {
        const missing: string[] = [];
        const generated: string[] = [];

        for (const p of presences) {
            if (deferredValue && !p.key.startsWith(deferredValue)) continue;

            if (p.status === "missing") missing.push(p.key);
            if (p.status === "generated") generated.push(p.key);
        }

        return { missing, generated };
    }, [presences, deferredValue]);

    useEffect(() => {
        const action = async () => {
            const c = useProjectStore.getState().generatedContents;
            if (!c) return;

            const presences = await getPresenceFiles(c.projectId, c.datasetKey);
            if (!presences) return;

            useProjectStore.setState({ generatedContents: { ...c, presences } });
        };

        const { on } = useSocketStore.getState();
        const [off] = on("server:presence:update", (type: string, payload: unknown) => {
            const c = useProjectStore.getState().generatedContents;
            if (!c || !payload) return;

            let presences: PresenceContent[] = c.presences;
            if (type === "generate") {
                presences = c.presences.map((p) =>
                    p.key === (payload as string) ? { ...p, status: "generated" } : p,
                );
            } else if (type === "delete") {
                const deleted = payload as string[];
                if (!deleted.length) return;

                presences = c.presences.map((p) =>
                    deleted.includes(p.key) ? { ...p, status: "missing" } : p,
                );
            }

            useProjectStore.setState({ generatedContents: { ...c, presences } });
        });

        void action();

        return () => {
            off();
        };
    }, []);

    return (
        <FrameContainer>
            <FilesLocation />

            <div className="flex flex-col px-4 w-full">
                <Input
                    type="search"
                    placeholder="Search..."
                    className="h-8"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </div>
            <Tabs
                defaultValue="missing"
                className="h-full w-full overflow-hidden gap-4 px-4"
                activationMode={"manual"}
            >
                <TabsList className="flex w-full *:flex-1 rounded-2xl *:rounded-xl bg-input/30">
                    <TabsTrigger value="missing">
                        Missing Files<Badge className="h-4 px-1 text-2xs">{missing.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="generated">
                        Generated Files
                        <Badge className="h-4 px-1 text-2xs">{generated.length}</Badge>
                    </TabsTrigger>
                </TabsList>
                <TabsContent
                    value="missing"
                    className="overflow-hidden gap-2 flex flex-col -mt-4 pt-4 px-4 -mx-4 overflow-x-visible"
                >
                    <MissingFileContent list={missing} />
                </TabsContent>
                <TabsContent
                    value="generated"
                    className="overflow-hidden -mt-4 pt-4 px-4 -mx-4 overflow-x-visible"
                >
                    <GeneratedFileContent list={generated} />
                </TabsContent>
            </Tabs>
        </FrameContainer>
    );
}

function FilesLocation() {
    const path = useProjectStore(({ generatedContents }) =>
        generatedContents ? "/output/presence/" + generatedContents.projectId : null,
    );

    if (!path) return null;

    return (
        <div className="px-4 flex flex-col w-full">
            <Alert>
                <HugeiconsIcon icon={Idea01Icon} strokeWidth={1.75} />
                <AlertDescription className="text-wrap">
                    The generated presence QR files are stored in{" "}
                    <code className="font-mono font-semibold">{path}</code> in the root directory of
                    the app.
                </AlertDescription>
            </Alert>
        </div>
    );
}

function MissingFileAction({ id }: { id: string }) {
    const { invoke, isLocked } = useCallbackLock(async () => {
        const emitAck = useSocketStore.getState().emitAck<boolean>;
        const c = useProjectStore.getState().generatedContents;
        if (!c) return;
        const success = await emitAck("client:presence:generate", id, c.projectId);
        if (!success) return;

        toast.success(`Successfully generated presence for "${id}".`);
    });

    return (
        <ItemActions>
            <Button variant={"outline"} size={"icon-sm"} onClick={invoke} disabled={isLocked}>
                <HugeiconsIcon icon={Refresh01Icon} />
            </Button>
        </ItemActions>
    );
}

function MissingFileContent({ list }: { list: string[] }) {
    const { invoke, isLocked } = useCallbackLock(async () => {
        await new Promise<void>((resolve) => {
            const { on, emit } = useSocketStore.getState();
            const c = useProjectStore.getState().generatedContents;
            if (!c) return;

            const [off] = on("server:presence:generate:done", (success: number) => {
                if (success === 0) toast.error("Failed to generate presence.");
                toast.success(
                    `Successfully generated presence for ${success} of ${list.length} file(s).`,
                );

                resolve();
                off();
            });

            emit("client:presence:generate:many", list, c.projectId);
        });
    });
    const { setIsLocked } = useDialogContent();
    useEffect(() => setIsLocked(isLocked), [isLocked, setIsLocked]);

    if (!list.length) return <Empty>No missing files.</Empty>;

    return (
        <fieldset className="flex flex-col size-full gap-2 m-0! p-0! border-none!">
            <div className="flex flex-row gap-2 justify-end">
                <Button variant={"outline"} size={"sm"} onClick={invoke}>
                    <HugeiconsIcon icon={Refresh01Icon} />
                    Generate All
                </Button>
            </div>
            <ItemGroup className="*:not-first:rounded-t-none *:border-t-0 *:border-x-0 border-x border-y *:last:border-b-0 rounded-2xl *:not-last:rounded-b-none gap-0 h-full overflow-auto">
                {list.map((f) => (
                    <Item key={f} variant={"outline"}>
                        <ItemContent>
                            <ItemTitle>{f}</ItemTitle>
                        </ItemContent>
                        <MissingFileAction id={f} />
                    </Item>
                ))}
            </ItemGroup>
        </fieldset>
    );
}

const downloadFile = async (projectId: string, fileName: string) => {
    const id = toast.loading(`Downloading ${fileName}...`);

    try {
        const api = new URL(
            `/api/download/presence/${encodeURIComponent(projectId)}/${encodeURIComponent(fileName)}`,
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
        const disposition = res.headers.get("content-disposition");
        let filename = "downloaded_file.png"; // Fallback name

        if (disposition?.includes("filename=")) {
            // Extract the filename (handling optional quotes)
            const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
            const matches = filenameRegex.exec(disposition);
            if (matches?.[1]) {
                filename = matches[1].replace(/['"]/g, "");
            }
        }

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;

        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        const msg = `Error downloading file: ${error instanceof Error ? error.message : String(error)}`;
        console.error(msg);
        toast.error(msg);
    } finally {
        toast.dismiss(id);
    }
};

function GeneratedFileAction({ id }: { id: string }) {
    const { invoke, isLocked } = useCallbackLock(async () => {
        const c = useProjectStore.getState().generatedContents;
        if (!c) return;

        await downloadFile(c.projectId, id);
    });

    return (
        <ItemActions>
            <Button variant={"outline"} size={"icon-sm"} onClick={invoke} disabled={isLocked}>
                <HugeiconsIcon icon={Download01Icon} />
            </Button>
        </ItemActions>
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

function GeneratedFileContent({ list }: { list: string[] }) {
    const { invoke, isLocked } = useCallbackLock(async () => {
        await new Promise<void>((resolve) => {
            const { on, emit } = useSocketStore.getState();
            const c = useProjectStore.getState().generatedContents;
            if (!c) return;

            const [off] = on("server:presence:delete:done", (success: number) => {
                if (success === 0) toast.error("Failed to delete presence.");
                toast.success(
                    `Successfully deleted presence for ${success} of ${list.length} file(s).`,
                );

                resolve();
                off();
            });

            emit("client:presence:delete:all", list, c.projectId);
        });
    });
    const { setIsLocked } = useDialogContent();
    useEffect(() => setIsLocked(isLocked), [isLocked, setIsLocked]);

    if (!list.length) return <Empty>No generated files.</Empty>;

    return (
        <fieldset className="flex flex-col size-full gap-2 m-0! p-0! border-none!">
            <div className="flex flex-row gap-2 justify-end items-center">
                <span>
                    Used space: <GeneratedFilesSize />
                </span>
                <Button variant={"outline"} size={"sm"} onClick={invoke}>
                    <HugeiconsIcon icon={Refresh01Icon} />
                    Delete All
                </Button>
            </div>
            <ItemGroup className="*:not-first:rounded-t-none *:border-t-0 *:border-x-0 border-x border-y *:last:border-b-0 rounded-2xl *:not-last:rounded-b-none gap-0 h-full overflow-auto">
                {list.map((f) => (
                    <Item key={f} variant={"outline"}>
                        <ItemContent>
                            <ItemTitle>{f}</ItemTitle>
                        </ItemContent>
                        <GeneratedFileAction id={f} />
                    </Item>
                ))}
            </ItemGroup>
        </fieldset>
    );
}

function GeneratedFilesSize() {
    const [size, setSize] = useState(-1);

    useEffect(() => {
        void (async () => {
            await new Promise<void>((resolve) => {
                const { on, emit } = useSocketStore.getState();
                const c = useProjectStore.getState().generatedContents;
                if (!c) return;

                const [off] = on("server:presence:usage:done", (totalSize: number) => {
                    setSize(totalSize);

                    resolve();
                    off();
                });

                emit("client:presence:usage", c.projectId);
            });
        })();
    }, []);

    if (size === -1) return <code>Loading...</code>;

    return <code>{formatFileSize(size)}</code>;
}
