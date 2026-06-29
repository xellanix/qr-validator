import { useProjectStore } from "@/stores/project.store";
import {
    FrameContainer,
    FrameDescription,
    FrameHeader,
} from "@/components/dialogs/projects/shared/frame";
import { Input } from "@/components/ui/input";
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";

export function GeneralPage() {
    return (
        <FrameContainer>
            <FrameHeader>
                <FrameDescription>General information about the project.</FrameDescription>
            </FrameHeader>

            <ItemGroup className="*:not-first:rounded-t-none *:not-first:border-t-0 *:not-last:rounded-b-none gap-0">
                <Item variant={"outline"}>
                    <ItemContent>
                        <ItemTitle>Project ID</ItemTitle>
                    </ItemContent>
                    <ProjectID />
                </Item>
                <Item variant={"outline"}>
                    <ItemContent>
                        <ItemTitle>Project Name</ItemTitle>
                    </ItemContent>
                    <ItemActions>
                        <ProjectNameAction />
                    </ItemActions>
                </Item>
            </ItemGroup>
        </FrameContainer>
    );
}

function ProjectID() {
    const id = useProjectStore((s) => s.edit.projectId);
    return <ItemActions className="font-mono">{id}</ItemActions>;
}

function ProjectNameAction() {
    const name = useProjectStore((s) => s.edit.data?.name);
    const setName = (newName: string) => {
        useProjectStore.setState((s) => {
            if (!s.edit.data) return s;

            return {
                edit: {
                    ...s.edit,
                    data: {
                        ...s.edit.data,
                        name: newName || s.edit.data.name || "Untitled Project",
                    },
                },
            };
        });
    };

    return <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8" />;
}
