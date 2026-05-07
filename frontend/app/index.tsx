import { useAppStore } from "@/stores/app.store";
import { HomePageTabs } from "@/components/core/tabs";
import { Synchronizer } from "@/components/history";
import { Spinner } from "@/components/ui/spinner";

export default function HomePage() {
    const isLoading = useAppStore((s) => s.isLoading);

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Spinner className="size-12" />
            </div>
        );
    }

    return (
        <>
            <Synchronizer />
            <HomePageTabs />
        </>
    );
}
