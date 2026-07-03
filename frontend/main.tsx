import "@fontsource-variable/figtree/index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/globals.css";
import { SocketInitiator } from "@/components/stores/socket-initiator.tsx";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";
import App from "./router.tsx";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <SocketInitiator />
        <TooltipProvider>
            <App />
        </TooltipProvider>
    </StrictMode>,
);
