import { Step1 } from "@/components/dialogs/projects/add/contents/step-1";
import { Step2 } from "@/components/dialogs/projects/add/contents/step-2";
import { Step3 } from "@/components/dialogs/projects/add/contents/step-3";
import { Step4 } from "@/components/dialogs/projects/add/contents/step-4";
import { Step5 } from "@/components/dialogs/projects/add/contents/step-5";
import { Step6 } from "@/components/dialogs/projects/add/contents/step-6";
import { Step7 } from "@/components/dialogs/projects/add/contents/step-7";

export const STEP_LIST = [
    {
        id: "1",
        title: "Enter Project Details",
        content: <Step1 />,
    },
    {
        id: "2",
        title: "Connect Data Source",
        content: <Step2 />,
    },
    {
        id: "3",
        title: "Map & Verify Columns",
        content: <Step3 />,
    },
    {
        id: "4",
        title: "Define Input Schema",
        content: <Step4 />,
        isOptional: true,
    },
    {
        id: "5",
        title: "Review Summary",
        content: <Step5 />,
        nextButton: "Process",
    },
    {
        id: "6",
        title: "Processing Data",
        content: <Step6 />,
        nextButton: 1,
        prevButton: 1,
    },
    {
        id: "7",
        title: "",
        content: <Step7 />,
        nextButton: 0,
        prevButton: 1,
    },
];

export const MAX_STEP_INDEX = STEP_LIST.length - 1;
