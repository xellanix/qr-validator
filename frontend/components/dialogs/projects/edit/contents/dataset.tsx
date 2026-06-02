import type { DataContentType } from "~/types/dataset";
import type { EditedProject } from "@/types/project";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useProjectStore } from "@/stores/project.store";
import {
    FrameContainer,
    FrameDescription,
    FrameHeader,
} from "@/components/dialogs/projects/edit/frame";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/item";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

export function DatasetPage() {
    return (
        <FrameContainer>
            <FrameHeader>
                <FrameDescription>
                    Dataset source configuration, including the dataset path and columns
                    identifiers.
                </FrameDescription>
            </FrameHeader>

            <ItemGroup className="*:not-first:rounded-t-none *:not-first:border-t-0 *:not-last:rounded-b-none gap-0!">
                <Item variant={"outline"}>
                    <ItemContent>
                        <ItemTitle>Dataset Path</ItemTitle>
                        <ItemDescription className="line-clamp-none">
                            The file system or storage directory path where the source CSV dataset
                            is located.
                        </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                        <StringInputAction keyname="datasetPath" />
                    </ItemActions>
                </Item>
            </ItemGroup>

            <ItemGroup className="*:not-first:rounded-t-none *:not-first:border-t-0 *:not-last:rounded-b-none gap-0!">
                <Item variant={"outline"}>
                    <ItemContent>
                        <ItemTitle>Dataset Columns</ItemTitle>
                        <ItemDescription className="line-clamp-none">
                            The list of original dataset columns and their assigned data types
                            (Text/Image) used for content validation.
                        </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                        <ManageColumnsAction />
                    </ItemActions>
                </Item>
            </ItemGroup>

            <ItemGroup className="*:not-first:rounded-t-none *:not-first:border-t-0 *:not-last:rounded-b-none gap-0!">
                <Item variant={"outline"}>
                    <ItemContent>
                        <ItemTitle>Dataset Key</ItemTitle>
                        <ItemDescription className="line-clamp-none">
                            The primary column name used as a unique identifier for input data
                            matching.
                        </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                        <DatasetKeyAction />
                    </ItemActions>
                </Item>
                <Item variant={"outline"}>
                    <ItemContent>
                        <ItemTitle>Dataset Key Label</ItemTitle>
                        <ItemDescription className="line-clamp-none">
                            The custom display text used to represent the Dataset Key across the
                            user interface.
                        </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                        <StringInputAction keyname="datasetKeyLabel" />
                    </ItemActions>
                </Item>
            </ItemGroup>
        </FrameContainer>
    );
}

export function DatasetColumnsPage() {
    return (
        <FrameContainer>
            <FrameHeader>
                <FrameDescription>
                    The list of original dataset columns and their assigned data types (Text/Image)
                    used for content validation.
                </FrameDescription>
            </FrameHeader>

            <DatasetColumns />
            <AddColumnsAction />
        </FrameContainer>
    );
}

function DatasetKeyAction() {
    const columnKeys = useProjectStore((s) => s.edit.data?.columnKeys || []);
    const primaryColumn = useProjectStore((s) => s.edit.data?.datasetKey || columnKeys[0] || "");

    const primaryChanged = (v: string) => {
        useProjectStore.setState((s) => {
            if (!s.edit.data) return s;

            return { edit: { ...s.edit, data: { ...s.edit.data, datasetKey: v } } };
        });
    };

    return (
        <Select value={primaryColumn} onValueChange={primaryChanged}>
            <SelectTrigger size="sm" className="max-w-42">
                <SelectValue placeholder="Primary column" />
            </SelectTrigger>
            <SelectContent>
                <SelectGroup>
                    <SelectLabel>Columns</SelectLabel>
                    {columnKeys.map((columnKey) => (
                        <SelectItem key={columnKey} value={columnKey}>
                            {columnKey}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    );
}

function StringInputAction({ keyname }: { keyname: keyof EditedProject }) {
    const str = useProjectStore((s) => s.edit.data?.[keyname]);
    const setName = (v: string) => {
        useProjectStore.setState((s) => {
            if (!s.edit.data) return s;

            return {
                edit: {
                    ...s.edit,
                    data: {
                        ...s.edit.data,
                        [keyname]: v || s.edit.data[keyname] || "",
                    },
                },
            };
        });
    };

    if (typeof str !== "string") return null;

    return <Input value={str} onChange={(e) => setName(e.target.value)} className="w-32 h-8" />;
}

function ManageColumnsAction() {
    return (
        <Button
            variant={"outline"}
            size="sm"
            onClick={() => useProjectStore.getState().setActivePage("2.1")}
        >
            Manage
        </Button>
    );
}

function AddColumnsAction() {
    const addColumn = () => {
        useProjectStore.setState((s) => {
            if (!s.edit.data) return s;

            const columnKeys = s.edit.data.columnKeys;
            const columns = { ...s.edit.data.columns };
            const newColumn = `Column Name ${columnKeys.length + 1}`;
            columns[newColumn] = "text";
            columnKeys.push(newColumn);

            return { edit: { ...s.edit, data: { ...s.edit.data, columnKeys, columns } } };
        });
    };

    return (
        <Button variant={"outline"} onClick={addColumn}>
            Add Column
        </Button>
    );
}

function DatasetColumns() {
    const columns = useProjectStore((s) => s.edit.data?.columns);

    return (
        <ItemGroup className="*:not-first:rounded-t-none *:not-first:border-t-0 *:not-last:rounded-b-none gap-0!">
            {Object.entries(columns || {}).map(([key, value], i) => (
                <Item key={key} variant={"outline"}>
                    <ItemContent>
                        <ItemTitle>Column {i + 1}</ItemTitle>
                    </ItemContent>
                    <ColumnItemAction name={key} type={value} />
                </Item>
            ))}
        </ItemGroup>
    );
}

function ColumnItemAction({ name, type }: { name: string; type: string }) {
    const isPrimary = useProjectStore((s) => s.edit.data?.datasetKey === name);

    const nameChanged = (v: string) => {
        useProjectStore.setState((s) => {
            if (!s.edit.data) return s;

            const datasetKey = s.edit.data.datasetKey === name ? v : s.edit.data.datasetKey;
            const columns: DataContentType = {};
            const columnKeys: string[] = [];

            const obj = s.edit.data.columns;
            for (const key in obj) {
                if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;

                if (key === name) {
                    columns[v] = obj[name];
                    columnKeys.push(v);
                } else {
                    columns[key] = obj[key];
                    columnKeys.push(key);
                }
            }

            return {
                edit: { ...s.edit, data: { ...s.edit.data, datasetKey, columnKeys, columns } },
            };
        });
    };

    const typeChanged = (v: string) => {
        useProjectStore.setState((s) => {
            if (!s.edit.data) return s;

            const columns = {
                ...s.edit.data.columns,
                [name]: v as DataContentType[keyof DataContentType],
            };

            return { edit: { ...s.edit, data: { ...s.edit.data, columns } } };
        });
    };

    const removeColumn = () => {
        useProjectStore.setState((s) => {
            if (!s.edit.data) return s;

            const columns: DataContentType = {};
            const columnKeys: string[] = [];

            const obj = s.edit.data.columns;
            for (const key in obj) {
                if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;

                if (key !== name) {
                    columns[key] = obj[key];
                    columnKeys.push(key);
                }
            }

            return {
                edit: { ...s.edit, data: { ...s.edit.data, columnKeys, columns } },
            };
        });
    };

    return (
        <ItemActions>
            <ButtonGroup>
                <Input
                    className="w-36 h-8"
                    placeholder="Column name"
                    defaultValue={name}
                    onBlur={(e) => nameChanged(e.target.value)}
                />
                <Select value={type} onValueChange={typeChanged}>
                    <SelectTrigger size="sm" className="w-24">
                        <SelectValue placeholder="Show as" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectLabel>Show As</SelectLabel>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="image">Image</SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </ButtonGroup>
            <Separator orientation="vertical" className="h-4 my-auto" />
            <Button
                variant={"outline"}
                size={"icon-sm"}
                onClick={removeColumn}
                disabled={isPrimary}
            >
                <HugeiconsIcon icon={Cancel01Icon} />
            </Button>
        </ItemActions>
    );
}
