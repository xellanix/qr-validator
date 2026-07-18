/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from "react";

interface DialogContent {
    isLocked: boolean;
    setIsLocked: (v: boolean) => void;
}

const DialogContentContext = createContext<DialogContent>({
    isLocked: false,
    setIsLocked: () => {},
});

export const useDialogContent = () => useContext(DialogContentContext);

export function DialogContentProvider({ children }: { children: React.ReactNode }) {
    const [isLocked, setIsLocked] = useState(false);

    return (
        <DialogContentContext.Provider value={{ isLocked, setIsLocked }}>
            <fieldset className="contents" disabled={isLocked}>
                {children}
            </fieldset>
        </DialogContentContext.Provider>
    );
}
