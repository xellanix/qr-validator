import { memo } from "react";

export const TextFormat = memo(function TextFormat({ value }: { value: string }) {
    return (
        <p className="w-full rounded-md bg-gray-100 p-3 text-sm wrap-break-word text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {value}
        </p>
    );
});
