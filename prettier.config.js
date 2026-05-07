/** @type {import('prettier').Config & import('prettier-plugin-tailwindcss').PluginOptions} */
export default {
    plugins: ["prettier-plugin-tailwindcss", "@ianvs/prettier-plugin-sort-imports"],
    tabWidth: 4,
    useTabs: false,
    trailingComma: "all",
    printWidth: 100,
    importOrder: [
        "<TYPES>^(node:)",
        "<TYPES>^(?!(@/|\\$/|[.]).*$).*$",
        "<TYPES>^\\$/(.*)?$",
        "<TYPES>^@/(.*)?$",
        "<TYPES>^[.]",
        "<TYPES>",
        "<BUILTIN_MODULES>", "<THIRD_PARTY_MODULES>",
        "^(?!(@/|\\$/|[.]).*$).*$",
        "^\\$/(?!sockets\/)(.*)?$",
        "^\\$/sockets/(.*)?$",
        "^@/types/(.*)?$",
        "^@/lib/(.*)?$",
        "^@/stores/(.*)?$",
        "^@/hooks/(.*)?$",
        "^@/styles/(.*)?$",
        "^@/data/(.*)?$",
        "^@/components/(.*)?$",
        "^@/(.*)?$",
        "^[.]"
    ],
    importOrderParserPlugins: ['typescript', 'jsx', 'decorators-legacy'],
    importOrderTypeScriptVersion: '6.0.2',
    importOrderCaseSensitive: true
};
