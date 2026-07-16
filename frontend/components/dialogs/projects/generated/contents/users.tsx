import type { User } from "~/types/user";
import { Alert02Icon, Download01Icon, Idea01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMemo } from "react";
import { toast } from "sonner";
import { getUserRole } from "@/lib/user";
import { getBackendUrl } from "@/lib/utils";
import { useProjectStore } from "@/stores/project.store";
import { useUserStore } from "@/stores/user.store";
import { useCallbackLock } from "@/hooks/use-callback-lock";
import { FrameContainer } from "@/components/dialogs/projects/shared/frame";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";

type UniqueUser = User & { index: number };

export function UserKeyPage() {
    return (
        <FrameContainer>
            <FilesLocation />
            <Alert>
                <HugeiconsIcon icon={Alert02Icon} strokeWidth={1.75} />
                <AlertDescription className="text-wrap">
                    NEVER edit/delete/move these files. It is ONLY generated once.
                </AlertDescription>
            </Alert>

            <FileList />
        </FrameContainer>
    );
}

function FilesLocation() {
    const path = useProjectStore(({ generatedContents }) =>
        generatedContents ? "/output/users/" + generatedContents.projectId : null,
    );

    if (!path) return null;

    return (
        <Alert>
            <HugeiconsIcon icon={Idea01Icon} strokeWidth={1.75} />
            <AlertDescription className="text-wrap">
                The generated user key files are stored in{" "}
                <code className="font-mono font-semibold">{path}</code> in the root directory of the
                app.
            </AlertDescription>
        </Alert>
    );
}

function FileList() {
    const users = useProjectStore((s) => s.generatedContents?.users ?? []);
    const admin = useUserStore((s) => s.user);

    const collator = useMemo(
        () =>
            new Intl.Collator(undefined, {
                numeric: true,
                sensitivity: "base",
            }),
        [],
    );

    const sortedUsers = useMemo(() => {
        const sorted = [...users].sort((a, b) =>
            collator.compare(a.name, b.name),
        ) as unknown as Record<string, unknown>[];

        sorted[0].index = 0;
        const lastUnique = { name: sorted[0].name, index: 0 };
        for (let i = 1; i < sorted.length; i++) {
            const current = sorted[i];
            let targetIndex = 0;
            if (sorted[i - 1].name === current.name) {
                if (current.name !== lastUnique.name) {
                    lastUnique.index = i - 1;
                    lastUnique.name = sorted[i - 1].name;
                }

                targetIndex = i - lastUnique.index;
            }
            sorted[i].index = targetIndex;
        }
        return sorted as unknown as UniqueUser[];
    }, [users, collator]);

    if (!admin) return null;

    return (
        <ItemGroup className="*:not-first:rounded-t-none *:border-t-0 *:border-x-0 border-x border-y *:last:border-b-0 rounded-2xl *:not-last:rounded-b-none gap-0 h-full overflow-auto">
            <FileItem index={-1} {...admin} />

            {sortedUsers.map((user, i) => (
                <FileItem key={`(${user.name}, ${user.authorizeLevel})[${i}]`} {...user} />
            ))}
        </ItemGroup>
    );
}

const downloadFile = async (projectId: string, userName: string, index: number = 0) => {
    const id = toast.loading(`Downloading ${userName}...`);

    try {
        const api = new URL(
            `/api/download/user/${encodeURIComponent(projectId)}/${encodeURIComponent(userName)}/${index}`,
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
        let filename = "downloaded_file.key"; // Fallback name

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

function FileItem({ name, authorizeLevel, index }: UniqueUser) {
    const projectId = useProjectStore((s) => s.generatedContents?.projectId ?? "");
    const { invoke, isLocked } = useCallbackLock(async () => downloadFile(projectId, name, index));

    const role = getUserRole(authorizeLevel);

    if (!projectId) return null;

    return (
        <Item variant={"outline"}>
            <ItemContent>
                <ItemTitle>{name}</ItemTitle>
            </ItemContent>
            <ItemActions>
                <span className="font-mono">{role}</span>
                <Button variant={"outline"} size={"icon-sm"} onClick={invoke} disabled={isLocked}>
                    <HugeiconsIcon icon={Download01Icon} />
                </Button>
            </ItemActions>
        </Item>
    );
}
