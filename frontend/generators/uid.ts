export class UniqueIdGenerator {
    private static counter = 0;
    private static prefix = `${Date.now()}_`;

    public static next(): string {
        return `${this.prefix}${this.counter++}`;
    }

    public static nextNumeric(): number {
        return this.counter++;
    }
}
