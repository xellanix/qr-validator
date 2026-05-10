import { HomePageTabs } from "@/components/core/tabs";
import { Synchronizer } from "@/components/history";

export default function HomePage() {
    return (
        <>
            <Synchronizer />
            <HomePageTabs />
        </>
    );
}
