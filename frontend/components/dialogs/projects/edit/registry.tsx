import type { NavigationLookup } from "@/components/dialogs/projects/shared";
import { BinaryCodeIcon, DatabaseIcon, InformationCircleIcon } from "@hugeicons/core-free-icons";
import {
    DatasetColumnsPage,
    DatasetPage,
} from "@/components/dialogs/projects/edit/contents/dataset";
import { GeneralPage } from "@/components/dialogs/projects/edit/contents/general";
import { InputPage, InputSchemaPage } from "@/components/dialogs/projects/edit/contents/input";

export const NAVIGATION_LOOKUP: NavigationLookup = {
    "1": {
        id: "1",
        title: "General",
        icon: InformationCircleIcon,
        content: <GeneralPage />,
    },
    "2": {
        id: "2",
        title: "Dataset",
        icon: DatabaseIcon,
        content: <DatasetPage />,
        children: {
            "1": {
                id: "2.1",
                title: "Columns",
                content: <DatasetColumnsPage />,
            },
        },
    },
    "3": {
        id: "3",
        title: "Input",
        icon: BinaryCodeIcon,
        content: <InputPage />,
        children: {
            "1": {
                id: "3.1",
                title: "Schema",
                content: <InputSchemaPage />,
            },
        },
    },
};
export const NAVIGATION_LIST = Object.values(NAVIGATION_LOOKUP);
