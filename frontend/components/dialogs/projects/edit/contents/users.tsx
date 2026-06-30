import type { User } from "~/types/user";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useProjectStore } from "@/stores/project.store";
import { useUserStore } from "@/stores/user.store";
import {
    FrameContainer,
    FrameDescription,
    FrameHeader,
} from "@/components/dialogs/projects/shared/frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
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

export function AssignedUsersPage() {
    return (
        <FrameContainer>
            <FrameHeader>
                <FrameDescription>
                    The list of users with access to the project and their assigned levels of
                    authorization to perform actions.
                </FrameDescription>
            </FrameHeader>

            <AssignedUsers />
            <AddUsersAction />
        </FrameContainer>
    );
}

function AssignedUsers() {
    const users = useProjectStore((s) => s.edit.data?.users);

    return (
        <ItemGroup className="*:not-first:rounded-t-none *:not-first:border-t-0 *:not-last:rounded-b-none gap-0!">
            <Administrator />

            {users?.map(({ name, authorizeLevel }, i) => (
                <AssignedUsersItem
                    key={`(${name}, ${authorizeLevel})[${i}]`}
                    name={name}
                    authorizeLevel={authorizeLevel}
                    index={i}
                />
            ))}
        </ItemGroup>
    );
}

function Administrator() {
    const username = useUserStore((s) => s.user?.name ?? "Unknown");

    return (
        <Item variant={"outline"}>
            <ItemContent>
                <ItemTitle>{username}</ItemTitle>
            </ItemContent>
            <ItemActions className="font-mono">Project Administrator</ItemActions>
        </Item>
    );
}

const setUsers = (prev: (prev: User[]) => User[]) => {
    useProjectStore.setState((s) => {
        const edit = s.edit;
        const data = edit.data;
        if (!data) return s;

        const users = prev(data.users);
        return { edit: { ...edit, data: { ...data, users } } };
    });
};

function AssignedUsersItem({ name, authorizeLevel, index }: User & { index: number }) {
    const nameChanged = (v: string) => {
        setUsers((users) => users.map((u, i) => (i === index ? { ...u, name: v } : u)));
    };

    const roleChanged = (v: string) => {
        setUsers((users) =>
            users.map((u, i) =>
                i === index ? { ...u, authorizeLevel: Number(v) as User["authorizeLevel"] } : u,
            ),
        );
    };

    const removeUser = () => {
        setUsers((users) => users.filter((_, i) => i !== index));
    };

    return (
        <Item variant={"outline"}>
            <ItemContent>
                <ItemTitle className="w-full overflow-visible">
                    <Input
                        className="w-3/4 h-8"
                        placeholder="Name"
                        defaultValue={name}
                        onBlur={(e) => nameChanged(e.target.value)}
                    />
                </ItemTitle>
            </ItemContent>
            <ItemActions>
                <Select value={authorizeLevel?.toString()} onValueChange={roleChanged}>
                    <SelectTrigger size="sm" className="w-32">
                        <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectLabel>Role</SelectLabel>
                            <SelectItem value="0">Viewer</SelectItem>
                            <SelectItem value="1">Operator</SelectItem>
                            <SelectItem value="2">Supervisor</SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>
                <Separator orientation="vertical" className="h-4 my-auto" />
                <Button variant={"outline"} size={"icon-sm"} onClick={removeUser}>
                    <HugeiconsIcon icon={Cancel01Icon} />
                </Button>
            </ItemActions>
        </Item>
    );
}

function AddUsersAction() {
    const addUser = () => {
        setUsers((users) => [...users, { name: "", authorizeLevel: 0 }]);
    };

    return (
        <Button variant={"outline"} onClick={addUser}>
            Add User
        </Button>
    );
}
