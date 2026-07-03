import type { User } from "~/types/user";

export function getUserRole(authorizeLevel: User["authorizeLevel"]) {
    switch (authorizeLevel) {
        case 0:
            return "Viewer";
        case 1:
            return "Operator";
        case 2:
            return "Supervisor";
        case 3:
            return "Project Administrator";
    }
}
