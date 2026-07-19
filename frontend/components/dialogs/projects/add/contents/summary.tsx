import type { DataContentType } from "~/types/dataset";
import { useProjectStore } from "@/stores/project.store";
import { DatasetSourceLabel } from "@/components/dialogs/projects/add/contents/data-source";
import { ActiveSchemasFlow } from "@/components/dialogs/projects/add/contents/input-schema";
import { ReadOnlyAssignedUsers } from "@/components/dialogs/projects/add/contents/users";
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";

const camelToCapitalCase = (str: string) => {
    return str
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (match) => match.toUpperCase())
        .trim();
};

const mapper = (record: DataContentType) => {
    let str = "";
    let maxLength = 0;
    for (const key in record) {
        if (!Object.hasOwn(record, key)) continue;

        const element = record[key];
        if (str !== "") str += "\n";
        str += `${key}\t-> ${camelToCapitalCase(element)}`;

        if (key.length > maxLength) maxLength = key.length;
    }
    return [str, (maxLength + 1).toString(10)];
};

export function SummarySection() {
    const newProject = useProjectStore((s) => s.newProject);
    if (!newProject?.data) return null;

    const [columns, maxLength] = mapper(newProject.data.columns);
    return (
        <>
            <ItemGroup className="*:not-first:rounded-t-none *:not-first:border-t-0 *:not-last:rounded-b-none gap-0">
                <Item variant={"outline"}>
                    <ItemContent>
                        <ItemTitle>Project Name</ItemTitle>
                    </ItemContent>
                    <ItemActions className="font-mono">{newProject.data.name}</ItemActions>
                </Item>
            </ItemGroup>

            <ItemGroup className="*:not-first:rounded-t-none *:not-first:border-t-0 *:not-last:rounded-b-none gap-0">
                <Item variant={"outline"}>
                    <ItemContent>
                        <ItemTitle>Dataset</ItemTitle>
                    </ItemContent>
                    <ItemActions className="font-mono">
                        <DatasetSourceLabel />
                    </ItemActions>
                </Item>
                <Item variant={"outline"} className="items-start">
                    <ItemContent>
                        <ItemTitle>Dataset Columns</ItemTitle>
                    </ItemContent>
                    <ItemActions
                        className="whitespace-pre font-mono"
                        style={{ tabSize: maxLength, MozTabSize: maxLength }}
                    >
                        {columns}
                    </ItemActions>
                </Item>
                <Item variant={"outline"}>
                    <ItemContent>
                        <ItemTitle>Dataset Key</ItemTitle>
                    </ItemContent>
                    <ItemActions className="font-mono">{newProject.data.key}</ItemActions>
                </Item>
                <Item variant={"outline"}>
                    <ItemContent>
                        <ItemTitle>Dataset Key Label</ItemTitle>
                    </ItemContent>
                    <ItemActions className="font-mono">{newProject.data.keyLabel}</ItemActions>
                </Item>
            </ItemGroup>

            <ItemGroup className="*:not-first:rounded-t-none *:not-first:border-t-0 *:not-last:rounded-b-none gap-0">
                <Item variant={"outline"}>
                    <ItemContent>
                        <ItemTitle>Schema</ItemTitle>
                    </ItemContent>
                </Item>
                <ActiveSchemasFlow />
            </ItemGroup>

            <ItemGroup className="*:not-first:rounded-t-none *:not-first:border-t-0 *:not-last:rounded-b-none gap-0">
                <Item variant={"outline"}>
                    <ItemContent>
                        <ItemTitle>Duplicate Valid Inputs</ItemTitle>
                    </ItemContent>
                    <ItemActions className="font-mono">
                        {newProject.data.allowDuplicateValid ? "Allowed" : "Not Allowed"}
                    </ItemActions>
                </Item>
                <Item variant={"outline"}>
                    <ItemContent>
                        <ItemTitle>Maximum Valid Duplicates</ItemTitle>
                    </ItemContent>
                    <ItemActions className="font-mono">
                        {newProject.data.maxValidDuplicate}
                    </ItemActions>
                </Item>
                <Item variant={"outline"}>
                    <ItemContent>
                        <ItemTitle>Continuous Scanning</ItemTitle>
                    </ItemContent>
                    <ItemActions className="font-mono">
                        {newProject.data.isContinuousScanning ? "Enabled" : "Disabled"}
                    </ItemActions>
                </Item>
            </ItemGroup>

            <ItemGroup className="*:not-first:rounded-t-none *:not-first:border-t-0 *:not-last:rounded-b-none gap-0!">
                <Item variant={"outline"}>
                    <ItemContent>
                        <ItemTitle>Assigned Users</ItemTitle>
                    </ItemContent>
                </Item>
                <ReadOnlyAssignedUsers />
            </ItemGroup>
        </>
    );
}
