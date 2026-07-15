import type { PresenceContent } from "~/types/generated-contents";
import type { ProjectItem } from "@/types/project";
import { Idea01Icon, Refresh01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { useProjectStore } from "@/stores/project.store";
import { useSocketStore } from "@/stores/socket.store";
import { useCallbackLock } from "@/hooks/use-callback-lock";
import { FrameContainer } from "@/components/dialogs/projects/shared/frame";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
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
    const presences = useProjectStore(useShallow((s) => s.generatedContents?.presences ?? []));
    const { missing, generated } = useMemo(() => {
        const missing: string[] = [];
        const generated: string[] = [];

        for (const p of presences) {
            if (p.status === "missing") missing.push(p.key);
            if (p.status === "generated") generated.push(p.key);
        }

        return { missing, generated };
    }, [presences]);

    useEffect(() => {
        const action = async () => {
            const c = useProjectStore.getState().generatedContents;
            if (!c) return;

            const presences = await getPresenceFiles(c.projectId, c.datasetKey);
            if (!presences) return;

            useProjectStore.setState({ generatedContents: { ...c, presences } });
        };

        const { on } = useSocketStore.getState();
        const [off] = on("server:presence:update", (newPresences: string) => {
            const c = useProjectStore.getState().generatedContents;
            if (!c) return;

            const presences = c.presences.map((p) =>
                p.key === newPresences ? { ...p, status: "generated" } : p,
            ) as PresenceContent[];
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

            <Tabs defaultValue="missing" className="h-full w-full overflow-hidden gap-4">
                <TabsList className="flex w-full *:flex-1 rounded-2xl *:rounded-xl bg-input/30">
                    <TabsTrigger value="missing">
                        Missing Files<Badge className="h-4 px-1 text-2xs">{missing.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="generated">
                        Generated Files
                        <Badge className="h-4 px-1 text-2xs">{generated.length}</Badge>
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="missing" className="overflow-hidden gap-2 flex flex-col">
                    <MissingFileContent list={missing} />
                </TabsContent>
                <TabsContent value="generated" className="overflow-hidden">
                    <GeneratedFileContent list={generated} />
                </TabsContent>
            </Tabs>
        </FrameContainer>
    );
}

function FilesLocation() {
    const [path, setPath] = useState("");
    useEffect(() => {
        const { emit, on } = useSocketStore.getState();
        const c = useProjectStore.getState().generatedContents;
        if (!c) return;
        emit("client:presence:path", c.projectId);

        const [off] = on("server:presence:path", (data) => {
            setPath(data);
        });

        return () => {
            off();
        };
    }, []);

    if (!path) return null;

    return (
        <Alert>
            <HugeiconsIcon icon={Idea01Icon} strokeWidth={1.75} />
            <AlertDescription className="text-wrap">
                The generated presence QR files are stored in the <code>{path}</code>
            </AlertDescription>
        </Alert>
    );
}

function FileList({ list }: { list: string[] }) {
    return (
        <ItemGroup className="*:not-first:rounded-t-none *:border-t-0 *:border-x-0 border-x border-y *:last:border-b-0 rounded-2xl *:not-last:rounded-b-none gap-0 h-full overflow-auto">
            {list.map((f) => (
                <Item key={f} variant={"outline"}>
                    <ItemContent>
                        <ItemTitle>{f}</ItemTitle>
                    </ItemContent>
                    <FileAction id={f} />
                </Item>
            ))}
        </ItemGroup>
    );
}

function FileAction({ id }: { id: string }) {
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

    if (!list.length) return <Empty>No missing files.</Empty>;

    return (
        <fieldset
            className="flex flex-col size-full overflow-hidden gap-2 m-0! p-0! border-none!"
            disabled={isLocked}
        >
            <div className="flex flex-row gap-2 justify-end">
                <Button variant={"outline"} size={"sm"} onClick={invoke}>
                    <HugeiconsIcon icon={Refresh01Icon} />
                    Generate All
                </Button>
            </div>
            <FileList list={list} />
        </fieldset>
    );
}

function GeneratedFileContent({ list }: { list: string[] }) {
    if (!list.length) return <Empty>No generated files.</Empty>;

    return <FileList list={list} />;
}
