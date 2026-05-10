import { useState } from "react";
import { toast } from "sonner";
import { signUp } from "@/lib/auth";
import { useCallbackLock } from "@/hooks/use-callback-lock";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function CreateAdminAccountDialog() {
    const [isOpen, setIsOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
        const name = e.target.value.trim();
        if (name.length === 0) {
            if (e.target.value.length > 0) {
                // Empty reason: filled with spaces
                return setError("Name cannot be filled with spaces.");
            } else {
                return setError("Name cannot be empty.");
            }
        }

        setError(null);
    };

    const { invoke: attemptSignUp, isLocked } = useCallbackLock(
        async (e: React.SubmitEvent<HTMLFormElement>) => {
            e.preventDefault();

            const formData = new FormData(e.currentTarget);
            const name = formData.get("name") as string;
            const success = await signUp(name);

            if (success) {
                toast.success("Congratulations! You have created an admin account.", {
                    description: (
                        <p>
                            As the authentication, please use the generated key file to sign in. The
                            key file is stored in{" "}
                            <code className="font-mono font-semibold">
                                /output/users/your_name.key
                            </code>{" "}
                            in the root directory of the app.{" "}
                            <span className="font-semibold">
                                Please DO NOT share it with anyone. It is ONLY generated once.
                            </span>
                        </p>
                    ),
                });
            }

            setIsOpen(!success);
        },
    );

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant={"link"} className="font-semibold" asChild>
                    <a>Create an Admin account</a>
                </Button>
            </DialogTrigger>
            <DialogContent showCloseButton={false}>
                <DialogHeader>
                    <DialogTitle>Create an Admin account</DialogTitle>
                    <DialogDescription>
                        Set up your admin account to launch projects, record presence, and manage
                        the team permissions.
                    </DialogDescription>
                </DialogHeader>

                <form className="flex flex-col gap-6" onSubmit={attemptSignUp}>
                    <Field data-invalid={!!error}>
                        <FieldLabel htmlFor="name">Name</FieldLabel>
                        <Input
                            type="text"
                            name="name"
                            id="name"
                            placeholder="Your name"
                            required
                            disabled={isLocked}
                            aria-invalid={!!error}
                            onChange={onChanged}
                        />
                        <FieldDescription>
                            Leading or trailing spaces will be trimmed.
                        </FieldDescription>
                        {error && <FieldError className="text-destructive">{error}</FieldError>}
                    </Field>
                    <DialogFooter className="flex-row justify-end">
                        <DialogClose asChild>
                            <Button variant="outline" disabled={isLocked}>
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button type="submit" disabled={isLocked || !!error}>
                            Create Admin Account
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
