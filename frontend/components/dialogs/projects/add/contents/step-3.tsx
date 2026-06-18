import type { DataContentType } from "~/types/dataset";
import { Cancel01Icon, Idea01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef } from "react";
import { useProjectStore } from "@/stores/project.store";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

export function Step3() {
    const fromDropdown = useProjectStore((s) => !Number.isNaN(s.newProject?.data?.datasetId));

    return (
        <fieldset
            disabled={fromDropdown}
            className="flex flex-col size-full overflow-auto gap-4 m-0! p-0! px-6! border-none!"
        >
            <ItemGroup className="*:not-first:rounded-t-none *:not-first:border-t-0 *:not-last:rounded-b-none gap-0!">
                <Alert>
                    <HugeiconsIcon icon={Idea01Icon} strokeWidth={1.75} />
                    <AlertDescription className="text-wrap">
                        {fromDropdown
                            ? "This information is pre-filled based on your previous selection. Please review it and click Next to continue. If something looks wrong, go back to change your selection."
                            : "Please fill out or verify the required fields below for your uploaded dataset."}
                    </AlertDescription>
                </Alert>
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
                        <AddColumnsAction />
                    </ItemActions>
                </Item>
                <DatasetColumns />
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
                        <DatasetKeyLabelAction />
                    </ItemActions>
                </Item>
            </ItemGroup>
        </fieldset>
    );
}

function AddColumnsAction() {
    const addColumn = () => {
        useProjectStore.setState((s) => {
            const prev = s.newProject;
            const data = prev?.data;
            if (!data) return s;

            const columnKeys = data.columnKeys;
            const columns = { ...data.columns };
            const newColumn = `Column Name ${columnKeys.length + 1}`;
            columns[newColumn] = "text";
            columnKeys.push(newColumn);

            return { newProject: { ...prev, data: { ...data, columnKeys, columns } } };
        });
    };

    return (
        <Button variant={"outline"} onClick={addColumn}>
            Add Column
        </Button>
    );
}

function DatasetColumns() {
    const columns = useProjectStore((s) => s.newProject?.data?.columns);

    return (
        <>
            {Object.entries(columns || {}).map(([key, value], i) => (
                <Item key={key} variant={"outline"}>
                    <ItemContent>
                        <ItemTitle>Column {i + 1}</ItemTitle>
                    </ItemContent>
                    <ColumnItemAction name={key} type={value} />
                </Item>
            ))}
        </>
    );
}

function ColumnItemAction({ name, type }: { name: string; type: string }) {
    const isPrimary = useProjectStore((s) => s.newProject?.data?.key === name);

    const nameChanged = (v: string) => {
        useProjectStore.setState((s) => {
            const prev = s.newProject;
            const data = prev?.data;
            if (!data) return s;

            const datasetKey = data.key === name ? v : data.key;
            const columns: DataContentType = {};
            const columnKeys: string[] = [];

            const obj = data.columns;
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
                newProject: { ...prev, data: { ...data, key: datasetKey, columnKeys, columns } },
            };
        });
    };

    const typeChanged = (v: string) => {
        useProjectStore.setState((s) => {
            const prev = s.newProject;
            const data = prev?.data;
            if (!data) return s;

            const columns = {
                ...data.columns,
                [name]: v as DataContentType[keyof DataContentType],
            };

            return { newProject: { ...prev, data: { ...data, columns } } };
        });
    };

    const removeColumn = () => {
        useProjectStore.setState((s) => {
            const prev = s.newProject;
            const data = prev?.data;
            if (!data) return s;

            const columns: DataContentType = {};
            const columnKeys: string[] = [];

            const obj = data.columns;
            for (const key in obj) {
                if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;

                if (key !== name) {
                    columns[key] = obj[key];
                    columnKeys.push(key);
                }
            }

            return { newProject: { ...prev, data: { ...data, columnKeys, columns } } };
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

function DatasetKeyAction() {
    const columnKeys = useProjectStore((s) => s.newProject?.data?.columnKeys || []);
    const primaryColumn = useProjectStore((s) => s.newProject?.data?.key || "");

    const primaryChanged = (v: string) => {
        useProjectStore.setState((s) => {
            const prev = s.newProject;
            if (!prev?.data) return s;

            return { newProject: { ...prev, data: { ...prev.data, key: v } } };
        });
    };

    useEffect(() => {
        const { registerNextHandler, removeNextHandler } = useProjectStore.getState();

        const handler = registerNextHandler((prev) => {
            if (!prev?.key) return "Please select a primary column.";
            return "";
        });

        return () => removeNextHandler(handler);
    }, []);

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

function DatasetKeyLabelAction() {
    const str = useProjectStore((s) => s.newProject?.data?.keyLabel);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const { registerNextHandler, removeNextHandler } = useProjectStore.getState();

        const handler = registerNextHandler(() => {
            const el = inputRef.current;
            if (!el) return "Input element not found. Try reloading the page.";

            const v = el.value.trim();
            if (!v) {
                const err = "Please enter a key label.";
                el.setCustomValidity(err);
                el.reportValidity();
                return err;
            } else {
                el.setCustomValidity("");
            }

            useProjectStore.setState((s) => {
                const prev = s.newProject;
                if (!prev?.data) return s;

                return { newProject: { ...prev, data: { ...prev.data, keyLabel: v } } };
            });

            return "";
        });

        return () => removeNextHandler(handler);
    }, []);

    return <Input ref={inputRef} defaultValue={str} required className="w-32 h-8" />;
}
