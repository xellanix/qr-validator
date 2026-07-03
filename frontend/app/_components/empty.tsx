import { ArchiveOff03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";

interface EmptyProjectProps {
    title: string;
    description: string;
    children?: React.ReactNode;
}
export function EmptyProject({ title, description, children }: EmptyProjectProps) {
    return (
        <div className="flex flex-col size-full overflow-hidden">
            <div className="flex flex-col overflow-hidden p-1 -m-1 pt-1.25 flex-1 gap-4">
                <Empty className="bg-card text-card-foreground rounded-2xl ring-1 ring-border">
                    <EmptyHeader>
                        <EmptyMedia variant={"icon"}>
                            <HugeiconsIcon icon={ArchiveOff03Icon} />
                        </EmptyMedia>
                        <EmptyTitle>{title}</EmptyTitle>
                        <EmptyDescription>{description}</EmptyDescription>
                    </EmptyHeader>
                    {children && <EmptyContent>{children}</EmptyContent>}
                </Empty>
            </div>
        </div>
    );
}
