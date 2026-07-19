import { ColumnsSection } from "@/components/dialogs/projects/add/contents/columns";
import { DataSourceSection } from "@/components/dialogs/projects/add/contents/data-source";
import { FinalSection } from "@/components/dialogs/projects/add/contents/final";
import { InputProcessSection } from "@/components/dialogs/projects/add/contents/input-process";
import { InputSchemaSection } from "@/components/dialogs/projects/add/contents/input-schema";
import { ProcessSection } from "@/components/dialogs/projects/add/contents/process";
import { ProjectDetailsSection } from "@/components/dialogs/projects/add/contents/project-details";
import { SummarySection } from "@/components/dialogs/projects/add/contents/summary";
import { AssignUsersSection } from "@/components/dialogs/projects/add/contents/users";

export const STEP_LIST = [
    {
        id: "1",
        title: "Enter Project Details",
        content: <ProjectDetailsSection />,
    },
    {
        id: "2",
        title: "Connect Data Source",
        content: <DataSourceSection />,
    },
    {
        id: "3",
        title: "Map & Verify Columns",
        content: <ColumnsSection />,
    },
    {
        id: "4",
        title: "Define Input Schema",
        content: <InputSchemaSection />,
        isOptional: true,
    },
    {
        id: "5",
        title: "Configure Input Processing",
        content: <InputProcessSection />,
        isOptional: true,
    },
    {
        id: "6",
        title: "Assign Operators & Users",
        content: <AssignUsersSection />,
    },
    {
        id: "7",
        title: "Review Summary",
        content: <SummarySection />,
        nextButton: "Process",
    },
    {
        id: "8",
        title: "Processing Data",
        content: <ProcessSection />,
        nextButton: 1,
        prevButton: 1,
    },
    {
        id: "9",
        title: "",
        content: <FinalSection />,
        nextButton: 0,
        prevButton: 1,
    },
];

export const MAX_STEP_INDEX = STEP_LIST.length - 1;
