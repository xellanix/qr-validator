import { useEffect, useRef } from "react";
import { useProjectStore } from "@/stores/project.store";
import { Input } from "@/components/ui/input";
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";

export function ProjectDetailsSection() {
    return (
        <ItemGroup className="*:not-first:rounded-t-none *:not-first:border-t-0 *:not-last:rounded-b-none gap-0">
            <Item variant={"outline"}>
                <ItemContent>
                    <ItemTitle>Project Name</ItemTitle>
                </ItemContent>
                <ItemActions>
                    <ProjectNameAction />
                </ItemActions>
            </Item>
        </ItemGroup>
    );
}

function ProjectNameAction() {
    const name = useProjectStore((s) => s.newProject?.data?.name ?? "");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const { registerNextHandler, removeNextHandler } = useProjectStore.getState();

        const handler = registerNextHandler(() => {
            const el = inputRef.current;
            if (!el) return "Input element not found. Try reloading the page.";

            const newName = el.value.trim();
            if (!newName) {
                const err = "Please enter a project name.";
                el.setCustomValidity(err);
                el.reportValidity();
                return err;
            } else {
                el.setCustomValidity("");
            }

            useProjectStore.setState((s) => {
                const prev = s.newProject;
                if (!prev?.data) return s;

                return { newProject: { ...prev, data: { ...prev.data, name: newName } } };
            });

            return "";
        });

        return () => removeNextHandler(handler);
    }, []);

    return <Input ref={inputRef} defaultValue={name} required className="h-8" />;
}
