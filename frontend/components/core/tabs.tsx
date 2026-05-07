import { useUserStore } from "@/stores/user.store";
import { HistoryView } from "@/components/history";
import { ReportView } from "@/components/report";
import { ScannerView } from "@/components/scanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
                    <Card className="h-full overflow-hidden p-0 *:px-6 *:first:pt-6 *:last:pb-6">
                        <CardHeader>
                            <CardTitle>Scan QR Code</CardTitle>
                        </CardHeader>
                        <CardContent className="flex h-full flex-col justify-center overflow-hidden">
                            <ScannerView />
                        </CardContent>
                    </Card>
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
                    <ReportView />
                </TabsContent>
            )}
        </Tabs>
    );
}
