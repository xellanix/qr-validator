import { cn } from "@/lib/utils";
import { STEP_LIST } from "@/components/dialogs/projects/add/registry";
import { Badge } from "@/components/ui/badge";

export function StepBars({ activeIndex }: { activeIndex: number }) {
    const activeStep = STEP_LIST[activeIndex];
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-row gap-2 *:flex-1">
                {STEP_LIST.map((_, i) => (
                    <div
                        key={i}
                        className={cn(
                            "h-2 bg-muted rounded-full",
                            i <= activeIndex && "bg-primary",
                        )}
                    ></div>
                ))}
            </div>
            <div className="flex flex-row gap-2 items-center">
                <h3 className="font-heading text-base leading-none font-medium">
                    {activeStep.title}
                </h3>
                {activeStep.isOptional && <Badge variant={"outline"}>Optional</Badge>}
            </div>
        </div>
    );
}
