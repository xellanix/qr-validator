import type { BlobBuffer, Dataset, ScanEntry, ScanStatus } from "@/types";
import {
    ArrowDown01Icon,
    ArrowDownZeroOneIcon,
    ArrowUpDownIcon,
    Download01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { compareNullableStrings } from "@/lib/utils";
import { useHistoryStore } from "@/stores/history.store";
import { useProjectStore } from "@/stores/project.store";
import { useSocketStore } from "@/stores/socket.store";
import { PaginationController } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

type JoinedDatasetType = Dataset & {
    present?: "Yes" | "No";
    validatorName?: string;
    validatedAt?: string;
    status?: ScanStatus;
};

const finalPresent = (initial: string | undefined, status: string | undefined) => {
    return initial === "Yes" && status != null ? "Yes" : "No";
};

export function ReportView() {
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const dataset = useProjectStore(
        (s) => ((s.activeId && s.projects[s.activeId]) || null)?.dataset,
    );
    const datasetKey = useProjectStore(
        (s) => ((s.activeId && s.projects[s.activeId]) || null)?.datasetKey,
    );
    const typeKeys = useProjectStore(
        (s) => ((s.activeId && s.projects[s.activeId]) || null)?.typeKeys,
    );
    const itemsPerPage = 10;

    const history = useHistoryStore((s) => s.entries);
    const joinedDataset = useMemo(() => {
        if (!dataset) return [];

        return Array.from(dataset.entries(), ([key, value]): JoinedDatasetType => {
            let lookup: ScanEntry | null = null;
            for (const scan of history) {
                if (scan.data === key) {
                    if (!(lookup === null || scan.status === "Valid")) continue;

                    lookup = scan;
                    if (scan.status === "Valid") {
                        break;
                    }
                }
            }
            if (!lookup) return value;

            return {
                present: "Yes",
                ...value,
                validatorName: lookup.validatorName,
                validatedAt: lookup.validatedAt,
                status: lookup.status,
            };
        });
    }, [history, dataset]);

    const sortedDataset = useMemo(() => {
        return [...joinedDataset].sort((a, b) => {
            const c = finalPresent(a.present, a.status).localeCompare(
                finalPresent(b.present, b.status),
            );
            if (c !== 0) return c;

            return compareNullableStrings(a.status, b.status);
        });
    }, [joinedDataset]);

    const filteredDataset = useMemo(() => {
        if (!sortedDataset) return [];
        if (!datasetKey) return sortedDataset;
        if (!searchTerm) return sortedDataset;

        return sortedDataset.filter((entry) => {
            if (datasetKey in entry === false) return false;

            return entry[datasetKey]?.toLowerCase().includes(searchTerm.toLowerCase());
        });
    }, [sortedDataset, datasetKey, searchTerm]);

    const totalPages = Math.ceil(filteredDataset.length / itemsPerPage);
    const paginatedDataset = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredDataset.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredDataset, currentPage, itemsPerPage]);

    const exportCsv = useCallback(
        (sorted: boolean) => async () => {
            const data = sorted ? sortedDataset : joinedDataset;
            if (!data || data.length < 1) {
                toast.error("No data to export.");
                return;
            }

            const toastId = toast(`Exporting ${sorted ? "Sorted" : "Unsorted"} CSV...`);

            const _typeKeys = useProjectStore.getState().activeTypeKeys();
            const headers = [
                "present",
                ..._typeKeys,
                "validatorName",
                "validatedAt",
                "status",
            ] as const;
            const rows = data.map((row) =>
                headers.map((header) =>
                    header === "present"
                        ? finalPresent(row.present, row.status)
                        : header === "validatedAt"
                          ? row.validatedAt
                              ? new Date(row.validatedAt).toLocaleString()
                              : ""
                          : (row[header] ?? ""),
                ),
            );
            const buffer = await useSocketStore
                .getState()
                .emitAck<BlobBuffer>("client:report:export", rows, _typeKeys);
            if (!buffer) return;
            {
                const now = new Date();
                const year = now.getFullYear().toString().padStart(4, "0");
                const month = (now.getMonth() + 1).toString().padStart(2, "0");
                const date = now.getDate().toString().padStart(2, "0");
                const timemark = year + month + date;

                const url = URL.createObjectURL(new Blob([buffer.buffer], { type: buffer.type }));
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = `presence_report_${timemark}.csv`;

                anchor.click();

                URL.revokeObjectURL(url);
            }

            toast.dismiss(toastId);
            toast.success(`${sorted ? "Sorted" : "Unsorted"} CSV exported successfully.`);
        },
        [sortedDataset, joinedDataset],
    );

    const exportJson = useCallback(
        (sorted: boolean) => async () => {
            const data = sorted ? sortedDataset : joinedDataset;
            if (!data || data.length < 1) {
                toast.error("No data to export.");
                return;
            }

            const toastId = toast(`Exporting ${sorted ? "Sorted" : "Unsorted"} JSON...`);

            const rows = data.map(
                ({ present, validatorName = "", validatedAt = "", status = "", ...row }) => ({
                    present: finalPresent(present, status),
                    ...row,
                    validatorName,
                    validatedAt,
                    status,
                }),
            );
            const blob = new Blob([JSON.stringify(rows, null, 2)], {
                type: "application/json",
            });
            {
                const now = new Date();
                const year = now.getFullYear().toString().padStart(4, "0");
                const month = (now.getMonth() + 1).toString().padStart(2, "0");
                const date = now.getDate().toString().padStart(2, "0");
                const timemark = year + month + date;

                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = `presence_report_${timemark}.json`;

                anchor.click();

                URL.revokeObjectURL(url);
            }

            toast.dismiss(toastId);
            toast.success(`${sorted ? "Sorted" : "Unsorted"} JSON exported successfully.`);
        },
        [sortedDataset, joinedDataset],
    );

    return (
        <Card className="h-full gap-0 overflow-hidden p-0 *:px-6 *:first:pt-6 *:last:pb-6">
            <CardHeader className="z-10 -mt-2 flex flex-row items-center justify-between gap-2">
                <CardTitle>Presence Report</CardTitle>
                <div className="flex items-center">
                    <Button
                        variant="outline"
                        size="icon-sm"
                        className="rounded-r-none"
                        onClick={exportCsv(true)}
                        aria-label="Export Sorted (.csv)"
                    >
                        <HugeiconsIcon icon={Download01Icon} />
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon-sm" className="rounded-l-none">
                                <HugeiconsIcon icon={ArrowDown01Icon} />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="mx-4 sm:mx-8">
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="gap-2">
                                    <HugeiconsIcon icon={ArrowUpDownIcon} className="size-4" />{" "}
                                    Export
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                    <DropdownMenuItem onClick={exportCsv(false)}>
                                        .csv
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={exportJson(false)}>
                                        .json
                                    </DropdownMenuItem>
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="gap-2">
                                    <HugeiconsIcon icon={ArrowDownZeroOneIcon} className="size-4" />{" "}
                                    Export Sorted
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                    <DropdownMenuItem onClick={exportCsv(true)}>
                                        .csv
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={exportJson(true)}>
                                        .json
                                    </DropdownMenuItem>
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardHeader>
            <CardContent className="flex h-full flex-col overflow-hidden *:-mx-6 *:-mb-4 *:px-6 *:py-4">
                <div className="flex flex-1 flex-col gap-y-4 overflow-hidden">
                    <Input
                        placeholder={`Search by ${datasetKey}...`}
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
                                    <TableHead className="text-center">Present</TableHead>
                                    {typeKeys?.map((key) => (
                                        <TableHead key={key}>{key}</TableHead>
                                    ))}
                                    <TableHead>Validator</TableHead>
                                    <TableHead>Validated At</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedDataset.length > 0 ? (
                                    paginatedDataset.map((scan, index) => (
                                        <ReportViewRow key={index} scan={scan} />
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell
                                            colSpan={4 + (typeKeys?.length ?? 0)}
                                            className="text-center"
                                        >
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
            </CardContent>
        </Card>
    );
}

interface ReportViewRowProps {
    scan: Record<string, string>;
}
function ReportViewRow({ scan }: ReportViewRowProps) {
    const { present, status, validatorName, validatedAt, ...others } = scan;

    return (
        <TableRow>
            <TableCell className="text-center">
                <Badge
                    variant={
                        present === "Yes"
                            ? status === "Valid"
                                ? "default"
                                : "warning"
                            : "destructive"
                    }
                >
                    {finalPresent(present, status)}
                </Badge>
            </TableCell>
            {Object.values(others).map((v, i) => (
                <DataTableCell key={i} value={v} />
            ))}
            <TableCell>{validatorName}</TableCell>
            <TableCell>{validatedAt && new Date(validatedAt).toLocaleString()}</TableCell>
            <TableCell className="text-center">
                <Badge
                    variant={status ? (status === "Valid" ? "default" : "destructive") : "ghost"}
                >
                    {status}
                </Badge>
            </TableCell>
        </TableRow>
    );
}

function DataTableCell({ value }: { value: string }) {
    return (
        <TableCell key={value} className="max-w-50 truncate sm:max-w-xs">
            {value}
        </TableCell>
    );
}
