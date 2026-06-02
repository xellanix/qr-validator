import type { ZodType } from "zod";
import type { DatasetRowValue } from "~/types/dataset";
import { ZodError } from "zod";
import { useProjectStore } from "@/stores/project.store";

type ValidationResult =
    | { success: true; value: DatasetRowValue }
    | { success: false; error: ZodError };

export function validate(value: string, _schema?: ZodType<string>): ValidationResult {
    try {
        const schema = _schema ?? useProjectStore.getState().activeSchema();
        // Use Zod's .parse() method. If validation fails, it throws an error.
        const validatedData = schema.parse(value);

        // If validation is successful, return the typed data.
        return { success: true, value: validatedData };
    } catch (error) {
        // If JSON.parse fails or if Zod's .parse() throws, we catch the error.
        if (error instanceof ZodError) {
            // If it's a Zod validation error, return it in a structured way.
            return { success: false, error: error };
        } else if (error instanceof SyntaxError) {
            // Handle malformed JSON string
            return {
                success: false,
                error: new ZodError([
                    {
                        code: "custom",
                        path: ["json"],
                        message: "Invalid JSON format.",
                    },
                ]),
            };
        } else {
            // Handle other unexpected errors
            return {
                success: false,
                error: new ZodError([
                    {
                        code: "custom",
                        path: ["unknown"],
                        message: "An unexpected error occurred during validation.",
                    },
                ]),
            };
        }
    }
}
