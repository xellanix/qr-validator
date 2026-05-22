import { IS_PROD, SERVER_PORT } from "$/const";

declare const VERSION: string;

console.log("┌────────────────────────────────┐");
console.log("│ Xellanix PreMark               │");
{
    const len = 22 - VERSION.length;
    console.log(`│ Version ${VERSION}${len > 0 ? " ".repeat(len) : ""} │`);
}
console.log("├────────────────────────────────┤");
console.log(`│ Server: http://localhost:${SERVER_PORT} │`);
console.log(`│ Mode  : ${IS_PROD ? "production " : "development"}            │`);
console.log("└────────────────────────────────┘");
