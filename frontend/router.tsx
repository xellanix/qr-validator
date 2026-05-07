import { BrowserRouter, Route, Routes } from "react-router-dom";
import HomePage from "@/app";
import ConsolePage from "@/app/console";
import Layout from "@/app/layout";

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<HomePage />} />
                    <Route path="console" element={<ConsolePage />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}
