import { DialogContentProvider } from "@/components/context/dialog";
import { DialogContent as DContent } from "@/components/ui/dialog";

export function DialogContent({ children, ...props }: React.ComponentProps<typeof DContent>) {
    return (
        <DContent {...props}>
            <DialogContentProvider>{children}</DialogContentProvider>
        </DContent>
    );
}
