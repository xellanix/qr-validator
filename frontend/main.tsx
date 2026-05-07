import "@fontsource-variable/figtree/index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/globals.css";
import { SocketInitiator } from "@/components/stores/socket-initiator.tsx";
import App from "./router.tsx";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <SocketInitiator />
        <App />
    </StrictMode>,
);
