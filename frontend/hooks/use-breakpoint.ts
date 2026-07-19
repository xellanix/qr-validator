import { useEffect, useRef, useState } from "react";

export function addBreakpointHandler(media: string, handler: (trigger: boolean) => void) {
    const mql = window.matchMedia(media);
    const onChange = (ev: MediaQueryListEvent) => {
        handler(ev.matches);
    };
    mql.addEventListener("change", onChange);
    handler(mql.matches);
    return () => mql.removeEventListener("change", onChange);
}

export function useBreakpoint(initialMaxWidth: number) {
    const initial = useRef(initialMaxWidth);
    const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);

    useEffect(() => {
        return addBreakpointHandler(`(max-width: ${initial.current - 1}px)`, setIsMobile);
    }, []);

    return !!isMobile;
}
