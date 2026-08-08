import type { ScanEntry } from "@/types";
import { Alert02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMemo, useState } from "react";
import { compareNullableStrings } from "@/lib/utils";
import { useHistoryStore } from "@/stores/history.store";
import { useProjectStore } from "@/stores/project.store";
import { useUserStore } from "@/stores/user.store";
import { DownloadReportDialog } from "@/components/dialogs/report/download";
import { PaginationController } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

type JoinedDatasetType = Record<string, string | number> &
    Partial<Pick<ScanEntry, "presenceBy" | "createdAt" | "status">> & {
        present?: "Yes" | "No";
        count?: number;
    };

const finalPresent = (initial: string | undefined, status: string | undefined) => {
    return initial === "Yes" && status != null ? "Yes" : "No";
};

export default function ReportView() {
    if (!useUserStore((s) => s.canReport)) {
        return (
            <div className="flex h-48 flex-col items-center justify-center text-center">
                <HugeiconsIcon
                    icon={Alert02Icon}
                    className="mb-4 size-12 text-(--warning-foreground)"
                />
                <p className="font-semibold">Access Denied</p>
                <p className="text-sm text-gray-500">
                    You do not have permission to access this page.
                </p>
            </div>
        );
    }

    return <ReportContentView />;
}

function ReportContentView() {
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const dataset = useProjectStore((s) => s.dataset);
    const datasetKey = useProjectStore(
        (s) => ((s.activeId && s.projects[s.activeId]) || null)?.key,
    );
    const datasetKeyLabel = useProjectStore(
        (s) => ((s.activeId && s.projects[s.activeId]) || null)?.keyLabel,
    );
    const columnKeys = useProjectStore(
        (s) => ((s.activeId && s.projects[s.activeId]) || null)?.columnKeys,
    );
    const itemsPerPage = 10;

    const history = useHistoryStore((s) => s.entries);
    const sortedDataset = useMemo(() => {
        if (!dataset) return [];

        const joinedDataset = Array.from(dataset.entries(), ([key, value]): JoinedDatasetType => {
            let lookup: ScanEntry | null = null;
            let count = 0;
            for (const scan of history) {
                if (scan.datasetRow === key) {
                    if (lookup === null) lookup = scan;
                    count++;
                }
            }
            if (!lookup) return value;

            return {
                present: "Yes",
                ...value,
                presenceBy: lookup.presenceBy,
                createdAt: lookup.createdAt,
                status: lookup.status,
                count,
            };
        });

        return joinedDataset.sort((a, b) => {
            let c = finalPresent(a.present, a.status).localeCompare(
                finalPresent(b.present, b.status),
            );
            if (c !== 0) return c;

            if (datasetKey) {
                c = compareNullableStrings(
                    a[datasetKey] as string | undefined,
                    b[datasetKey] as string | undefined,
                );
                if (c !== 0) return c;
            }

            return (a.createdAt || -1) - (b.createdAt || -1);
        });
    }, [dataset, history, datasetKey]);

    const filteredDataset = useMemo(() => {
        if (!sortedDataset) return [];
        if (!datasetKey) return sortedDataset;
        if (!searchTerm) return sortedDataset;

        return sortedDataset.filter((entry) => {
            if (datasetKey in entry === false) return false;

            return (entry[datasetKey] as string).toLowerCase().includes(searchTerm.toLowerCase());
        });
    }, [sortedDataset, datasetKey, searchTerm]);

    const totalPages = Math.ceil(filteredDataset.length / itemsPerPage);
    const paginatedDataset = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredDataset.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredDataset, currentPage, itemsPerPage]);

    return (
        <Card className="h-full gap-0 overflow-hidden p-0 *:px-6 *:first:pt-6 *:last:pb-6">
            <CardHeader className="z-10 -mt-2 flex flex-row items-center justify-between gap-2">
                <CardTitle>Presence Report</CardTitle>
                <div className="flex items-center">
                    <DownloadReportDialog />
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
                                <TableRow className="relative after:absolute after:inset-0 after:bg-input/30 after:-z-10">
                                    <TableHead className="text-center">Present</TableHead>
                                    {columnKeys?.map((key) => (
                                        <TableHead key={key}>
                                            {key === datasetKey ? datasetKeyLabel : key}
                                        </TableHead>
                                    ))}
                                    <TableHead>Presence By</TableHead>
                                    <TableHead>Created At</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                    <TableHead className="text-center">Count</TableHead>
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
                                            colSpan={4 + (columnKeys?.length ?? 0)}
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
    scan: JoinedDatasetType;
}
function ReportViewRow({ scan }: ReportViewRowProps) {
    const { present, status, presenceBy, createdAt, count, ...others } = scan;

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
                <DataTableCell key={i} value={v as string} />
            ))}
            <TableCell>{presenceBy}</TableCell>
            <TableCell>{createdAt && new Date(createdAt).toLocaleString()}</TableCell>
            <TableCell className="text-center">
                <Badge
                    variant={status ? (status === "Valid" ? "default" : "destructive") : "ghost"}
                >
                    {status}
                </Badge>
            </TableCell>
            <TableCell className="text-center">{count}</TableCell>
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
