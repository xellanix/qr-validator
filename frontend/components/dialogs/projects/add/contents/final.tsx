import { Alert02Icon, CheckmarkBadge01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useProjectStore } from "@/stores/project.store";

const STATE = {
    error: {
        icon: Alert02Icon,
        iconColor: "fill-destructive",
        title: "Project Creation Failed",
        description:
            "An error occurred while setting up your project. Please check your connection or details and try again.",
    },
    success: {
        icon: CheckmarkBadge01Icon,
        iconColor: "fill-primary",
        title: "Project Successfully Added",
        description:
            "You can now activate this project from your dashboard to begin scanning, tracking history, and generating reports.",
    },
} as const;

export function FinalSection() {
    const isSuccess = useProjectStore(
        (s) => s.newProject?.isSuccess ?? "New project is not created.",
    );
    const cond = STATE[isSuccess === true ? "success" : "error"];

    return (
        <div className="flex flex-col gap-4 h-full overflow-hidden justify-center items-center">
            <HugeiconsIcon
                icon={cond.icon}
                className={`*:first:stroke-0 size-48 [color:var(--color-popover)] ${cond.iconColor}`}
            />
            <h1 className="text-center font-bold text-2xl">{cond.title}</h1>
            <p className="text-center text-muted-foreground text-balance max-w-3/4">
                {cond.description}
            </p>
            {isSuccess !== true && (
                <code className="bg-muted px-2 py-1 rounded-sm text-muted-foreground text-sm max-w-3/4 max-h-24 overflow-y-auto whitespace-pre-wrap">
                    {isSuccess || "Unknown error"}
                </code>
            )}
        </div>
    );
}
