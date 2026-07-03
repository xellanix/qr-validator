/* eslint-disable @typescript-eslint/no-unused-vars */
import type { ZodString, ZodType } from "zod";

type InputSchema = {
    label: string;
    hasValue: boolean;
    builder: (prev: ZodType<string>, v?: string) => ZodType<string>;
    flowBuilder: (v?: string) => string | undefined;
};

const strToInt = (str?: string) => {
    if (str) {
        const num = parseInt(str, 10);
        if (!isNaN(num)) {
            return num;
        }
    }
    return undefined;
};

export const INPUT_SCHEMAS = {
    min: {
        label: "Minimum Length",
        hasValue: true,
        builder: (prev: ZodType<string>, v?: string) => {
            const num = strToInt(v);
            return num !== undefined ? (prev as ZodString).min(num) : prev;
        },
        flowBuilder: (v?: string) => {
            const num = strToInt(v);
            return num !== undefined ? `min(${num})` : undefined;
        },
    },
    max: {
        label: "Maximum Length",
        hasValue: true,
        builder: (prev: ZodType<string>, v?: string) => {
            const num = strToInt(v);
            return num !== undefined ? (prev as ZodString).max(num) : prev;
        },
        flowBuilder: (v?: string) => {
            const num = strToInt(v);
            return num !== undefined ? `max(${num})` : undefined;
        },
    },
    length: {
        label: "Exact Length",
        hasValue: true,
        builder: (prev: ZodType<string>, v?: string) => {
            const num = strToInt(v);
            return num !== undefined ? (prev as ZodString).length(num) : prev;
        },
        flowBuilder: (v?: string) => {
            const num = strToInt(v);
            return num !== undefined ? `length(${num})` : undefined;
        },
    },
    regex: {
        label: "Regular Expression",
        hasValue: true,
        builder: (prev: ZodType<string>, v?: string) => {
            return v ? (prev as ZodString).regex(new RegExp(v)) : prev;
        },
        flowBuilder: (v?: string) => {
            return v ? `regex(${new RegExp(v)})` : undefined;
        },
    },
    startsWith: {
        label: "Starts With",
        hasValue: true,
        builder: (prev: ZodType<string>, v?: string) => {
            return v ? (prev as ZodString).startsWith(v) : prev;
        },
        flowBuilder: (v?: string) => {
            return v ? `startsWith("${v}")` : undefined;
        },
    },
    endsWith: {
        label: "Ends With",
        hasValue: true,
        builder: (prev: ZodType<string>, v?: string) => {
            return v ? (prev as ZodString).endsWith(v) : prev;
        },
        flowBuilder: (v?: string) => {
            return v ? `endsWith("${v}")` : undefined;
        },
    },
    includes: {
        label: "Includes",
        hasValue: true,
        builder: (prev: ZodType<string>, v?: string) => {
            return v ? (prev as ZodString).includes(v) : prev;
        },
        flowBuilder: (v?: string) => {
            return v ? `includes("${v}")` : undefined;
        },
    },
    uppercase: {
        label: "Uppercase",
        hasValue: false,
        builder: (prev: ZodType<string>, _v?: string) => (prev as ZodString).uppercase(),
        flowBuilder: (_v?: string) => "uppercase()",
    },
    lowercase: {
        label: "Lowercase",
        hasValue: false,
        builder: (prev: ZodType<string>, _v?: string) => (prev as ZodString).lowercase(),
        flowBuilder: (_v?: string) => "lowercase()",
    },
    trim: {
        label: "Trim Spaces",
        hasValue: false,
        builder: (prev: ZodType<string>, _v?: string) => (prev as ZodString).trim(),
        flowBuilder: (_v?: string) => "trim()",
    },
    toUpperCase: {
        label: "To Uppercase",
        hasValue: false,
        builder: (prev: ZodType<string>, _v?: string) => (prev as ZodString).toUpperCase(),
        flowBuilder: (_v?: string) => "toUpperCase()",
    },
    toLowerCase: {
        label: "To Lowercase",
        hasValue: false,
        builder: (prev: ZodType<string>, _v?: string) => (prev as ZodString).toLowerCase(),
        flowBuilder: (_v?: string) => "toLowerCase()",
    },
    normalize: {
        label: "Normalize Unicode",
        hasValue: false,
        builder: (prev: ZodType<string>, _v?: string) => (prev as ZodString).normalize(),
        flowBuilder: (_v?: string) => "normalize()",
    },
} satisfies Record<string, InputSchema>;
