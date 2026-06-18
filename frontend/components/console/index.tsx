import { useCallback } from "react";
import { useProjectStore } from "@/stores/project.store";
import { useSocketStore } from "@/stores/socket.store";
import { ProjectMoreButton } from "@/components/dialogs/projects";
import { NewProjectButton } from "@/components/dialogs/projects/add";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { Switch } from "@/components/ui/switch";
import { EmptyProject } from "@/app/_components/empty";

export function ActiveProject() {
    const activeProject = useProjectStore((s) => (s.activeId && s.projects[s.activeId]) || null);

    if (!activeProject) {
        return (
            <Card className="w-full p-0 **:ring-0">
                <EmptyProject
                    title={"No Active Project"}
                    description={
                        "Activate a project, so you and your team can start scanning, viewing history, or generating reports."
                    }
                ></EmptyProject>
            </Card>
        );
    }

    return (
        <Card className="w-full overflow-hidden p-0 *:px-6 *:first:pt-6 *:last:pb-6">
            <CardHeader>
                <CardTitle>Active Project</CardTitle>
            </CardHeader>
            <CardContent className="flex h-full flex-col justify-center overflow-hidden px-0!">
                <div className="flex flex-col overflow-auto px-6 size-full">
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] auto-rows-auto items-start gap-4 w-full">
                        {activeProject && (
                            <ProjectItem name={activeProject.name} id={activeProject.id} />
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export function AllProjects() {
    const projects = useProjectStore((s) => s.projects);

    return (
        <Card className="w-full overflow-hidden p-0 *:px-6 *:first:pt-6 *:last:pb-6 flex-1">
            <CardHeader>
                <CardTitle>Projects</CardTitle>
                <CardAction>
                    <NewProjectButton>
                        <Button size={"sm"}>New Project</Button>
                    </NewProjectButton>
                </CardAction>
            </CardHeader>
            <CardContent className="flex h-full flex-col justify-center overflow-hidden px-0!">
                <div className="flex flex-col overflow-auto px-6 size-full">
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] auto-rows-auto items-start gap-4 w-full">
                        {Object.values(projects).map((p, i) => (
                            <ProjectItem key={i} id={p.id} name={p.name} />
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

interface ProjectItemProps {
    id: string;
    name: string;
}
function ProjectItem({ id, name }: ProjectItemProps) {
    const isActive = useProjectStore((s) => s.activeId === id);

    const checkedChanged = useCallback(
        (checked: boolean) => {
            useSocketStore.getState().emit("client:project:activation:toggle", id, checked);
        },
        [id],
    );

    return (
        <Item variant={"outline"} className="h-fit">
            <ItemContent className="w-full overflow-hidden">
                <ItemTitle>
                    <Switch size="sm" checked={isActive} onCheckedChange={checkedChanged} />
                    {name}
                </ItemTitle>
                <ItemDescription className="truncate line-clamp-none">{id}</ItemDescription>
            </ItemContent>
            <ItemActions>
                <div className="flex items-center">
                    <ProjectMoreButton id={id} />
                </div>
            </ItemActions>
        </Item>
    );
}
