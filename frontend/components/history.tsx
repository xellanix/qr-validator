import type { ScanEntry } from "@/types";
import { Delete03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useMemo, useState } from "react";
import { useHistoryStore } from "@/stores/history.store";
import { useProjectStore } from "@/stores/project.store";
import { useSocketStore } from "@/stores/socket.store";
import { useUserStore } from "@/stores/user.store";
import { PaginationController } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

export function Synchronizer() {
    const socket = useSocketStore((s) => s.socket);
    useEffect(() => {
        if (!socket) return;

        const update = (updatedHistory: ScanEntry[]) => {
            useHistoryStore.getState().setEntries(updatedHistory);
        };
        socket.emit("client:history:init");
        socket.on("server:history:update", update);

        return () => {
            socket.off("server:history:update", update);
        };
    }, [socket]);

    useEffect(() => {
        if (useUserStore.getState().isUseDataset) void useProjectStore.getState().initDataset();
    }, []);

    return null;
}

export function HistoryView() {
    const canDelete = useUserStore((s) => s.canDelete);

    const inputDataKey = useProjectStore(
        (s) => ((s.activeId && s.projects[s.activeId]) || null)?.inputKey,
    );
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const history = useHistoryStore((s) => s.entries);
    const filteredHistory = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return history;

        return history.filter(
            (entry) =>
                entry.data.toLowerCase().includes(term) ||
                entry.validatorName.toLowerCase().includes(term),
        );
    }, [history, searchTerm]);

    const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
    const paginatedHistory = filteredHistory.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage,
    );

    return (
        <div className="flex flex-1 flex-col gap-y-4 overflow-hidden">
            <Input
                placeholder="Search by data or validator name..."
                value={searchTerm}
                onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                }}
                className="max-w-sm"
            />

            <div className="flex-1 overflow-hidden rounded-4xl border">
                <Table>
                    <TableHeader className="sticky top-0 bg-card">
                        <div className="w-full bg-input/30 -z-10 absolute size-full" />
                        <TableRow>
                            <TableHead>{inputDataKey}</TableHead>
                            <TableHead>Validator</TableHead>
                            <TableHead>Validated At</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            {canDelete && <TableHead className="text-center">Actions</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedHistory.length > 0 ? (
                            paginatedHistory.map((scan) => (
                                <HistoryViewRow key={scan.id} scan={scan} canDelete={canDelete} />
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={canDelete ? 5 : 4} className="text-center">
                                    No results found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <PaginationController
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                totalPages={totalPages}
            />
        </div>
    );
}

interface HistoryViewRowProps {
    scan: ScanEntry;
    canDelete: boolean;
}
function HistoryViewRow({ scan, canDelete }: HistoryViewRowProps) {
    const handleDelete = (id: string) => {
        if (!canDelete) return;
        useSocketStore.getState().emit("client:history:delete", id);
    };

    return (
        <TableRow>
            <TableCell className="max-w-50 truncate font-medium whitespace-pre-line sm:max-w-xs">
                {scan.data}
            </TableCell>
            <TableCell>{scan.validatorName}</TableCell>
            <TableCell>{new Date(scan.validatedAt).toLocaleString()}</TableCell>
            <TableCell className="text-center">
                <Badge variant={scan.status === "Valid" ? "default" : "destructive"}>
                    {scan.status}
                </Badge>
            </TableCell>
            {canDelete && (
                <TableCell className="text-center w-fit">
                    <Button
                        variant="destructive"
                        size="icon-sm"
                        onClick={() => handleDelete(scan.id)}
                        aria-label="Delete entry"
                        disabled={scan.id.startsWith("mock_")}
                    >
                        <HugeiconsIcon icon={Delete03Icon} />
                    </Button>
                </TableCell>
            )}
        </TableRow>
    );
}
