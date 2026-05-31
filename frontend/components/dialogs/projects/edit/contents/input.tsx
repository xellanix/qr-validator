import type { UniqueIdentifier } from "@dnd-kit/core";
import type { SchemaObjectSortable } from "@/types/project";
import { arrayMove } from "@dnd-kit/sortable";
import {
    ArrowUpRight01Icon,
    Cancel01Icon,
    DragDropVerticalIcon,
    Idea01Icon,
    InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Fragment, useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { validate } from "@/lib/validation";
import { useProjectStore } from "@/stores/project.store";
import {
    FrameContainer,
    FrameDescription,
    FrameHeader,
} from "@/components/dialogs/projects/edit/frame";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import {
    Sortable,
    SortableContent,
    SortableItem,
    SortableItemHandle,
    SortableOverlay,
} from "@/components/ui/sortable";
import { Switch } from "@/components/ui/switch";
import { UniqueIdGenerator } from "@/generators/uid";
import { INPUT_SCHEMAS } from "@/registry/input-schema";

export function InputPage() {
    return (
        <FrameContainer>
            <FrameHeader>
                <FrameDescription>This page is</FrameDescription>
            </FrameHeader>

            <ItemGroup className="*:not-first:rounded-t-none *:not-first:border-t-0 *:not-last:rounded-b-none gap-0!">
                <Item variant={"outline"}>
                    <ItemContent>
                        <ItemTitle>Encrypted Input</ItemTitle>
                        <ItemDescription className="line-clamp-none">
                            A conditional flag that indicates whether the end-user input data is
                            encrypted.
                        </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                        <EncryptInputAction />
                    </ItemActions>
                </Item>
            </ItemGroup>

            <ItemGroup className="*:not-first:rounded-t-none *:not-first:border-t-0 *:not-last:rounded-b-none gap-0!">
                <Item variant={"outline"}>
                    <ItemContent>
                        <ItemTitle>Input Schema</ItemTitle>
                        <ItemDescription className="line-clamp-none">
                            The structural schema used for the initial layer of data validation
                            before dataset-level checks are applied.
                        </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                        <InputSchemaAction />
                    </ItemActions>
                </Item>
                <Alert>
                    <HugeiconsIcon icon={Idea01Icon} strokeWidth={1.75} />
                    <AlertDescription className="text-wrap">
                        If the input data is encrypted, it will be decrypted first before being
                        validated.
                    </AlertDescription>
                </Alert>
            </ItemGroup>
        </FrameContainer>
    );
}

export function InputSchemaPage() {
    return (
        <FrameContainer>
            <FrameHeader>
                <FrameDescription>
                    The structural schema used for the initial layer of data validation before
                    dataset-level checks are applied.
                </FrameDescription>
                <Alert>
                    <HugeiconsIcon icon={Idea01Icon} strokeWidth={1.75} />
                    <AlertDescription className="text-wrap">
                        If the input data is encrypted, it will be decrypted first before being
                        validated.
                    </AlertDescription>
                </Alert>
            </FrameHeader>

            <ItemGroup className="*:not-first:rounded-t-none *:not-first:border-t-0 *:not-last:rounded-b-none gap-0!">
                <Item variant={"outline"}>
                    <ItemContent>
                        <ItemTitle>Input Test</ItemTitle>
                        <ItemDescription className="line-clamp-none">
                            The decrypted (or raw) input data test.
                        </ItemDescription>
                    </ItemContent>
                    <InputTestAction />
                </Item>
            </ItemGroup>

            <ItemGroup className="*:not-first-of-type:rounded-t-none *:not-first-of-type:border-t-0 *:not-last-of-type:rounded-b-none gap-0!">
                <Alert>
                    <HugeiconsIcon icon={Idea01Icon} strokeWidth={1.75} />
                    <AlertDescription className="text-wrap">
                        Schemas are built using method chaining, so the sequence of your methods
                        determines the final schema structure. Ensure your methods are chained in
                        the correct logical order.
                    </AlertDescription>
                </Alert>
                <Item variant={"outline"}>
                    <ItemContent>
                        <ItemTitle>Schemas</ItemTitle>
                    </ItemContent>
                    <SchemaAction />
                </Item>
                <ActiveSchemasFlow />
                <SchemaList />
            </ItemGroup>
        </FrameContainer>
    );
}

function EncryptInputAction() {
    return <Switch defaultChecked={true} disabled={true} />;
}

function InputSchemaAction() {
    return (
        <Button
            variant={"outline"}
            size="sm"
            onClick={() => useProjectStore.getState().setActivePage("3.1")}
        >
            Manage
        </Button>
    );
}

function InputTestAction() {
    const inputRef = useRef<HTMLInputElement>(null);
    const tryValidate = () => {
        const value = inputRef.current?.value;
        const schema = useProjectStore.getState().edit.data?.schema;
        if (!value || !schema) {
            toast.error("Failed: Input data test or schema is empty.");
            return;
        }

        const res = validate(value, schema);
        if (res.success) {
            toast.success("Passed: The input data test is successfully validated.");
        } else {
            toast.error(
                "Failed: The input data test is not valid. Error: " + res.error.issues[0].message,
                {
                    duration: 10000,
                },
            );
        }
    };

    return (
        <ItemActions>
            <ButtonGroup>
                <Input ref={inputRef} type="text" placeholder="Input test" className="h-8" />
                <Button variant={"outline"} size={"icon-sm"} onClick={tryValidate}>
                    <HugeiconsIcon icon={ArrowUpRight01Icon} />
                </Button>
            </ButtonGroup>
        </ItemActions>
    );
}

function SchemaAction() {
    const addSchema = useCallback(
        (type: string) => () => {
            const newValue = { type, value: "", sortId: UniqueIdGenerator.nextNumeric() };
            useProjectStore.getState().updateEditSchema((prev) => [...prev, newValue]);
        },
        [],
    );

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant={"outline"} size={"sm"}>
                    Add Schema
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-36" side="bottom" align="end">
                <DropdownMenuLabel>Validations</DropdownMenuLabel>
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="gap-2">Length</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={addSchema("min")}>Minimum</DropdownMenuItem>
                        <DropdownMenuItem onClick={addSchema("max")}>Maximum</DropdownMenuItem>
                        <DropdownMenuItem onClick={addSchema("length")}>Exact</DropdownMenuItem>
                    </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="gap-2">Pattern</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={addSchema("regex")}>
                            Regular Expression
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={addSchema("startsWith")}>
                            Starts With
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={addSchema("endsWith")}>
                            Ends With
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={addSchema("includes")}>
                            Includes
                        </DropdownMenuItem>
                    </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="gap-2">
                        Capitalization
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={addSchema("lowercase")}>
                            Lowercase
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={addSchema("toUpperCase")}>
                            Uppercase
                        </DropdownMenuItem>
                    </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Transformers</DropdownMenuLabel>
                <DropdownMenuItem onClick={addSchema("trim")}>Trim Spaces</DropdownMenuItem>
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="gap-2">
                        Capitalization
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={addSchema("toLowerCase")}>
                            To Lowercase
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={addSchema("toUpperCase")}>
                            To Uppercase
                        </DropdownMenuItem>
                    </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem onClick={addSchema("normalize")}>
                    Normalize Unicode
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function ActiveSchemasFlow() {
    const schemaObjects = useProjectStore((s) => s.edit.data?.schemaObjects);

    const breadcrumbs = useMemo(() => {
        const res = [];
        for (const schema of schemaObjects || []) {
            if (!(schema.type in INPUT_SCHEMAS)) continue;

            const flow = INPUT_SCHEMAS[schema.type as keyof typeof INPUT_SCHEMAS].flowBuilder(
                schema.value,
            );
            if (!flow) continue;

            res.push(flow);
        }

        return res;
    }, [schemaObjects]);

    if (breadcrumbs.length === 0)
        return (
            <Alert>
                <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={1.75} />
                <AlertDescription className="text-wrap">No active input schemas.</AlertDescription>
            </Alert>
        );

    return (
        <Item variant={"outline"}>
            <ItemContent>
                <Breadcrumb>
                    <BreadcrumbList className="sm:gap-1.5 md:gap-2.5">
                        <BreadcrumbItem>Input</BreadcrumbItem>
                        <BreadcrumbSeparator />
                        {breadcrumbs.map((flow, index) => (
                            <Fragment key={`${flow}${index}`}>
                                <BreadcrumbItem className="text-brand">{flow}</BreadcrumbItem>
                                <BreadcrumbSeparator />
                            </Fragment>
                        ))}
                        <BreadcrumbItem>Output (is valid + transformed)</BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
            </ItemContent>
        </Item>
    );
}

function SchemaList() {
    const schemaObjects = useProjectStore((s) => s.edit.data?.schemaObjects || []);

    const onMoved = useCallback((ev: { activeIndex: number; overIndex: number }) => {
        useProjectStore
            .getState()
            .updateEditSchema((prev) => arrayMove(prev, ev.activeIndex, ev.overIndex));
    }, []);

    const overlay = useCallback(
        (activeItem: { value: UniqueIdentifier }) => {
            const schema = schemaObjects.find((s) => s.sortId === activeItem.value);
            if (!schema) return null;

            return <SchemaItem schema={schema} />;
        },
        [schemaObjects],
    );

    if (schemaObjects.length === 0) return null;

    return (
        <Sortable value={schemaObjects} onMove={onMoved} getItemValue={(i) => i.sortId}>
            <SortableContent className="*:rounded-t-none *:border-t-0 *:not-last-of-type:rounded-b-none gap-0!">
                {schemaObjects.map((schema) => (
                    <SchemaItem key={schema.sortId} schema={schema} />
                ))}
            </SortableContent>
            <SortableOverlay>{overlay}</SortableOverlay>
        </Sortable>
    );
}

function SchemaItem({ schema }: { schema: SchemaObjectSortable }) {
    const metadata = INPUT_SCHEMAS[schema.type as keyof typeof INPUT_SCHEMAS];

    const timerId = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latestValueRef = useRef<string | undefined | null>(null);

    const commitValueToStore = () => {
        if (timerId.current) {
            clearTimeout(timerId.current);
            timerId.current = null;
        }

        if (latestValueRef.current === null) return;

        const value = latestValueRef.current;
        useProjectStore
            .getState()
            .updateEditSchema((prev) =>
                prev.map((s) => (s.sortId === schema.sortId ? { ...s, value } : s)),
            );

        latestValueRef.current = null;
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        event.preventDefault();
        const value = event.target.value.trim();
        latestValueRef.current = value;

        if (timerId.current) clearTimeout(timerId.current);
        timerId.current = setTimeout(commitValueToStore, 300);
    };

    const removeSchema = () => {
        useProjectStore
            .getState()
            .updateEditSchema((prev) => prev.filter((s) => s.sortId !== schema.sortId));
    };

    useEffect(() => {
        return () => {
            if (timerId.current) clearTimeout(timerId.current);
        };
    }, []);

    if (!metadata) return null;

    return (
        <SortableItem value={schema.sortId} asChild>
            <Item variant={"outline"} className="pl-0">
                <ItemContent className="flex-row gap-2">
                    <SortableItemHandle asChild>
                        <Button variant={"ghost"} size={"icon-xs"} tabIndex={-1} className="ml-2">
                            <HugeiconsIcon
                                icon={DragDropVerticalIcon}
                                strokeWidth={2}
                                className="fill-current"
                            />
                        </Button>
                    </SortableItemHandle>
                    <ItemTitle>{metadata.label}</ItemTitle>
                </ItemContent>
                <ItemActions>
                    {metadata.hasValue && (
                        <>
                            <Input
                                className="w-36 h-8"
                                defaultValue={schema.value}
                                placeholder={metadata.label}
                                onChange={handleChange}
                                onBlur={commitValueToStore}
                            />
                            <Separator orientation="vertical" className="h-4 my-auto" />
                        </>
                    )}
                    <Button variant={"outline"} size={"icon-sm"} onClick={removeSchema}>
                        <HugeiconsIcon icon={Cancel01Icon} />
                    </Button>
                </ItemActions>
            </Item>
        </SortableItem>
    );
}
