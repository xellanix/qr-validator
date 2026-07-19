import { useProjectStore } from "@/stores/project.store";
import { Input } from "@/components/ui/input";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/item";
import { Switch } from "@/components/ui/switch";

export function InputProcessSection() {
    return (
        <>
            <ItemGroup className="*:not-first:rounded-t-none *:not-first:border-t-0 *:not-last:rounded-b-none gap-0!">
                <Item variant={"outline"}>
                    <ItemContent>
                        <ItemTitle>Allow Duplicate Valid Inputs</ItemTitle>
                        <ItemDescription className="line-clamp-none">
                            Allows the system to record multiple identical valid data. When
                            disabled, duplicate valid requests are automatically skipped.
                        </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                        <AllowDuplicateValidAction />
                    </ItemActions>
                </Item>
                <MaxValidDuplicateItem />
            </ItemGroup>

            <ItemGroup className="*:not-first:rounded-t-none *:not-first:border-t-0 *:not-last:rounded-b-none gap-0!">
                <Item variant={"outline"}>
                    <ItemContent>
                        <ItemTitle>Continuous Scanning</ItemTitle>
                        <ItemDescription className="line-clamp-none">
                            Automatically resumes the scanner after validation. If off, manual
                            restart is required.
                        </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                        <ContinuousScanningAction />
                    </ItemActions>
                </Item>
            </ItemGroup>
        </>
    );
}

function AllowDuplicateValidAction() {
    const allowDuplicateValid = useProjectStore(
        (s) => s.newProject?.data?.allowDuplicateValid || false,
    );

    const checkChanged = (v: boolean) => {
        useProjectStore.setState((s) => {
            if (!s.newProject?.data) return s;

            // This is a toggle rule.
            // If allowDuplicateValid is true, then isContinuousScanning is false.
            // If allowDuplicateValid is false, then isContinuousScanning is back to the previous value,
            // which is false (because allowDuplicateValid is true before).
            // So, whatever the allowDuplicateValid value is, we set isContinuousScanning to false.
            const isContinuousScanning = false;
            return {
                newProject: {
                    ...s.newProject,
                    data: { ...s.newProject.data, allowDuplicateValid: v, isContinuousScanning },
                },
            };
        });
    };

    return <Switch checked={allowDuplicateValid} onCheckedChange={checkChanged} />;
}

function MaxValidDuplicateItem() {
    const allowDuplicateValid = useProjectStore(
        (s) => s.newProject?.data?.allowDuplicateValid || false,
    );

    if (!allowDuplicateValid) return null;

    return (
        <Item variant={"outline"}>
            <ItemContent>
                <ItemTitle>Maximum Valid Duplicates</ItemTitle>
                <ItemDescription className="line-clamp-none">
                    Sets the maximum number of identical valid inputs allowed before skipping
                    duplicates. Minimum value is 2.
                </ItemDescription>
            </ItemContent>
            <ItemActions>
                <MaxValidDuplicateAction />
            </ItemActions>
        </Item>
    );
}

function MaxValidDuplicateAction() {
    const maxValidDuplicate = useProjectStore((s) =>
        Math.max(2, s.newProject?.data?.maxValidDuplicate || 2),
    );

    const inputChanged = (v: string) => {
        useProjectStore.setState((s) => {
            if (!s.newProject?.data) return s;

            return {
                newProject: {
                    ...s.newProject,
                    data: { ...s.newProject.data, maxValidDuplicate: parseInt(v) },
                },
            };
        });
    };

    return (
        <Input
            type="number"
            onChange={(e) => inputChanged(e.target.value)}
            value={maxValidDuplicate}
            min={2}
            className="w-24 h-8"
        />
    );
}

function ContinuousScanningAction() {
    const allowDuplicateValid = useProjectStore(
        (s) => s.newProject?.data?.allowDuplicateValid || false,
    );
    const continuousScanning = useProjectStore(
        (s) => s.newProject?.data?.isContinuousScanning ?? true,
    );

    const checkChanged = (v: boolean) => {
        useProjectStore.setState((s) => {
            if (!s.newProject?.data) return s;

            const isContinuousScanning = s.newProject.data.allowDuplicateValid ? false : v;
            return {
                newProject: {
                    ...s.newProject,
                    data: { ...s.newProject.data, isContinuousScanning },
                },
            };
        });
    };

    return (
        <Switch
            checked={continuousScanning}
            onCheckedChange={checkChanged}
            disabled={allowDuplicateValid}
        />
    );
}
