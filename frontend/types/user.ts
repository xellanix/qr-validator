export interface User {
    hash?: string;
    name: string;
    authorizeLevel: 0 | 1 | 2 | 3;
}
