import { toast } from "sonner";
import { string } from "zod";
import { useProjectStore } from "@/stores/project.store";
import { MAX_STEP_INDEX, STEP_LIST } from "@/components/dialogs/projects/add/registry";
import { StepBars } from "@/components/dialogs/projects/add/step-bar";
import { disableCloseExceptButton } from "@/components/dialogs/shared";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

export function NewProjectButton({ children }: { children?: React.ReactNode }) {
    return (
        <Dialog
            onOpenChange={(o) =>
                useProjectStore.setState({
                    newProject: o
                        ? {
                              activePageIndex: 0,
                              isSuccess: true,
                              data: {
                                  id: "",
                                  name: "",
                                  datasetId: null,
                                  key: "",
                                  keyLabel: "",
                                  columns: {},
                                  columnKeys: [],
                                  schemaObjects: [],
                                  schema: string(),
                                  users: [],
                                  allowDuplicateValid: false,
                                  maxValidDuplicate: 2,
                                  isContinuousScanning: true,
                              },
                              nextHandler: [],
                              uploadedDataset: null,
                              uploadedDatasetBuffer: null,
                          }
                        : null,
                })
            }
        >
            <DialogTrigger asChild>{children}</DialogTrigger>
            <NewProjectDialog />
        </Dialog>
    );
}

export function NewProjectDialog() {
    const activeIndex = useProjectStore((s) => s.newProject?.activePageIndex ?? 0);
    const activeStep = STEP_LIST[activeIndex];

    const move = (delta: number) => () => {
        const current = useProjectStore.getState().newProject;
        if (!current) return;

        if (delta > 0) {
            let fastfail = false;
            for (const handler of current.nextHandler ?? []) {
                const errMessage = handler(current.data);
                if (errMessage) {
                    toast.error(errMessage);
                    fastfail = true;
                }
            }

            if (fastfail) return;
        }
        useProjectStore.setState((prev) => {
            const prevProject = prev.newProject;
            if (!prevProject) return prev;

            return {
                newProject: {
                    ...prevProject,
                    activePageIndex: Math.min(
                        Math.max(0, prevProject.activePageIndex + delta),
                        MAX_STEP_INDEX,
                    ),
                },
            };
        });
    };

    return (
        <DialogContent
            className="overflow-hidden max-md:size-full p-0 [&>div]:px-6 py-6 max-md:max-w-full! md:h-[80dvh] md:max-h-[80dvh] md:max-w-[80dvw] lg:max-w-[90dvw] grid-rows-[auto_1fr_auto]"
            onEscapeKeyDown={disableCloseExceptButton}
            onPointerDownOutside={disableCloseExceptButton}
            onInteractOutside={disableCloseExceptButton}
        >
            <DialogHeader className="mr-8 min-h-4 justify-center">
                <DialogTitle className="absolute opacity-0 select-none">New Project</DialogTitle>
                <StepBars activeIndex={activeIndex} />
            </DialogHeader>

            <div className="flex flex-col size-full overflow-auto gap-4 has-[fieldset]:px-0!">
                {activeStep.content}
            </div>

            <DialogFooter className="flex-row justify-between!">
                <Button
                    type="button"
                    variant="outline"
                    onClick={move(-1)}
                    className={activeIndex === 0 || activeStep.prevButton === 1 ? "hidden" : ""}
                >
                    {activeStep.prevButton ?? "Previous"}
                </Button>
                {activeStep.nextButton === 0 ? (
                    <DialogClose asChild>
                        <Button type="button" className={"ml-auto"}>
                            Close
                        </Button>
                    </DialogClose>
                ) : (
                    <Button
                        type="button"
                        onClick={move(1)}
                        className={"ml-auto" + (activeStep.nextButton === 1 ? " hidden" : "")}
                    >
                        {activeStep.nextButton ?? "Next"}
                    </Button>
                )}
            </DialogFooter>
        </DialogContent>
    );
}
