/* eslint-disable @typescript-eslint/no-explicit-any */
export type CamelToSnakeCase<S extends string> = S extends `${infer T}${infer U}`
    ? U extends Uncapitalize<U>
        ? `${Lowercase<T>}${CamelToSnakeCase<U>}`
        : `${Lowercase<T>}_${CamelToSnakeCase<Uncapitalize<U>>}`
    : S;

export type ConvertKeysToSnakeCase<T> = {
    [K in keyof T as CamelToSnakeCase<Extract<K, string>>]: T[K];
};

export type SnakeCaseKeys<T> =
    T extends Array<any>
        ? CamelToSnakeCaseArray<T>
        : T extends Record<string, any>
          ? { [K in keyof T as CamelToSnakeCase<K & string>]: SnakeCaseKeys<T[K]> }
          : T;

export type CamelToSnakeCaseArray<T extends Array<any>> = Array<SnakeCaseKeys<T[number]>>;
