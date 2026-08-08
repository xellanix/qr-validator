import { Suspense, lazy } from "react";
import { useUserStore } from "@/stores/user.store";
import { HistoryView } from "@/components/history";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ReportView = lazy(() => import("@/components/report"));
const ScannerView = lazy(() => import("@/components/scanner"));

export function HomePageTabs() {
    const canScan = useUserStore((s) => s.canScan);
    const canReport = useUserStore((s) => s.canReport);

    return (
        <Tabs
            defaultValue={canScan ? "scanner" : "history"}
            className="h-full w-full overflow-hidden gap-4"
        >
            <TabsList className="flex w-full *:flex-1 rounded-2xl *:rounded-xl">
                {canScan && <TabsTrigger value="scanner">Scanner</TabsTrigger>}
                <TabsTrigger value="history">History</TabsTrigger>
                {canReport && <TabsTrigger value="report">Report</TabsTrigger>}
            </TabsList>

            {canScan && (
                <TabsContent value="scanner" className="flex flex-col overflow-hidden p-1 -m-1">
                    <Suspense fallback={<ScannerSkeleton />}>
                        <ScannerView />
                    </Suspense>
                </TabsContent>
            )}

            <TabsContent value="history" className="flex flex-col overflow-hidden p-1 -m-1">
                <Card className="h-full gap-0 overflow-hidden p-0 *:px-6 *:first:pt-6 *:last:pb-6">
                    <CardHeader>
                        <CardTitle>Scan History</CardTitle>
                    </CardHeader>
                    <CardContent className="flex h-full flex-col overflow-hidden *:-mx-6 *:-mb-4 *:px-6 *:py-4">
                        <HistoryView />
                    </CardContent>
                </Card>
            </TabsContent>

            {canReport && (
                <TabsContent value="report" className="flex flex-col overflow-hidden p-1 -m-1">
                    <Suspense fallback={<ReportSkeleton />}>
                        <ReportView />
                    </Suspense>
                </TabsContent>
            )}
        </Tabs>
    );
}

function ScannerSkeleton() {
    return (
        <Card className="h-full overflow-hidden p-0 *:px-6 *:first:pt-6 *:last:pb-6">
            <CardHeader>
                <Skeleton className="h-4 w-1/3" />
            </CardHeader>
            <CardContent className="flex h-full flex-col justify-center overflow-hidden">
                <div className="flex flex-col items-center justify-center gap-4 size-full">
                    <Skeleton className="aspect-square w-full max-w-sm" />
                    <Skeleton className="h-6 w-1/4" />
                    <Skeleton className="h-9 w-42" />
                </div>
            </CardContent>
        </Card>
    );
}

function ReportSkeleton() {
    return (
        <Card className="h-full gap-0 overflow-hidden p-0 *:px-6 *:first:pt-6 *:last:pb-6">
            <CardHeader className="z-10 -mt-2 flex flex-row items-center justify-between gap-2">
                <Skeleton className="h-4 w-1/3" />
                <div className="flex items-center">
                    <Skeleton className="h-8 w-28" />
                </div>
            </CardHeader>
            <CardContent className="flex h-full flex-col overflow-hidden *:-mx-6 *:-mb-4 *:px-6 *:py-4">
                <div className="flex flex-1 flex-col gap-y-4 overflow-hidden">
                    <Skeleton className="h-9 max-w-sm" />

                    <div className="flex-1 overflow-hidden rounded-4xl border">
                        <Skeleton className="h-12 w-full rounded-b-none" />
                        {Array.from({ length: 5 }).map((_, index) => (
                            <div className="flex h-12 p-3 gap-3" key={index}>
                                <Skeleton className="h-full w-12" />
                                <Skeleton className="h-full flex-7" />
                                <Skeleton className="h-full flex-3" />
                                <Skeleton className="h-full w-14" />
                            </div>
                        ))}
                    </div>

                    <Skeleton className="ml-auto h-8 w-1/3" />
                </div>
            </CardContent>
        </Card>
    );
}
