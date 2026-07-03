import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";

interface FooterProps {
    onSave: () => void;
    onCancel: () => void;
}
export function DefaultFooter({ onSave, onCancel }: FooterProps) {
    return (
        <DialogFooter className="flex-row justify-end p-6">
            <DialogClose asChild>
                <Button variant={"outline"} onClick={onCancel}>
                    Cancel
                </Button>
            </DialogClose>
            <Button onClick={onSave}>Save</Button>
        </DialogFooter>
    );
}

interface OnlyBackFooterProps {
    onBack: () => void;
}
export function OnlyBackFooter({ onBack }: OnlyBackFooterProps) {
    return (
        <DialogFooter className="flex-row justify-end p-6">
            <Button onClick={onBack}>Back</Button>
        </DialogFooter>
    );
}

export function OnlyCloseFooter({ onCancel }: Pick<FooterProps, "onCancel">) {
    return (
        <DialogFooter className="flex-row justify-end p-6">
            <DialogClose asChild>
                <Button variant={"outline"} onClick={onCancel}>
                    Close
                </Button>
            </DialogClose>
        </DialogFooter>
    );
}
