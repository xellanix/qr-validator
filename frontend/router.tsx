import { lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import ConsoleGuard from "@/app/console/layout";
import Layout from "@/app/layout";

const HomePage = lazy(() => import("@/app"));
const ConsolePage = lazy(() => import("@/app/console"));

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<HomePage />} />
                    <Route path="console" element={<ConsoleGuard />}>
                        <Route index element={<ConsolePage />} />
                    </Route>
                </Route>
            </Routes>
        </BrowserRouter>
    );
}
