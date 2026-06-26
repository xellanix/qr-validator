import type { DefaultEventsMap, Server, Socket } from "socket.io";
import type { User } from "~/types/user";
import type { Result } from "@/types";

export type SocketCallback<T> = (result: Result<T>) => void;

export type SocketData = {
    user: User | undefined;
    userHash:
        | {
              bytes: Uint8Array;
              base64: string;
          }
        | undefined;
};

export type FinalServer = Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;
export type FinalSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;
