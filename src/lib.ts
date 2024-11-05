import _ from 'lodash';

/**
 * Type guard of T.
 */
export type TypeGuard<T> = (v: unknown) => v is T;

/**
 * Type guard of object (non-null).
 */
export function isNonNullableObject(v: unknown): v is object {
    return typeof v === 'object' && v !== null;
}
/**
 * Any function type (without `any` type to make eslint happy).
 */
export type AnyFn = (...args: never[]) => unknown;
/**
 * Type guard of function.
 */
export function isAnyFn(v: unknown): v is AnyFn {
    return typeof v === 'function';
}
/**
 * Describes any object (but may be T).
 *
 * When writing type guards, first limit the type to PartialUnknown<T>,
 * which can help you check the correctness of property input.
 * Also, this make IDE code hints and renaming tools work better.
 */
export type PartialUnknown<T> = {
    [P in keyof T]?: unknown;
};
/**
 * Check if the value is any object. Then you can use `v[key]` with intellisense.
 */
export function isPartialUnknown<T>(v: unknown): v is PartialUnknown<T> {
    return isNonNullableObject(v);
}

/**
 * String that represents atomic types.
 */
export type AtomicTypeName =
    | 'string'
    | 'number'
    | 'bigint'
    | 'boolean'
    | 'symbol'
    | 'undefined';

/**
 * Name of atomic types.
 */
export type NameOfAtomicType<T> = T extends string
    ? 'string'
    : T extends number
      ? 'number'
      : T extends bigint
        ? 'bigint'
        : T extends boolean
          ? 'boolean'
          : T extends symbol
            ? 'symbol'
            : T extends undefined
              ? 'undefined'
              : never;

/**
 * Atomic type of the name.
 */
export type AtomicTypeOfName<Name extends AtomicTypeName> = {
    string: string;
    number: number;
    bigint: bigint;
    boolean: boolean;
    symbol: symbol;
    undefined: undefined;
}[Name];
/**
 * Check if the value is specific atomic type.
 */
export function checkAtomicType<Name extends AtomicTypeName>(
    v: unknown,
    name: Name,
): v is AtomicTypeOfName<Name> {
    return typeof v === name;
}

/**
 * Describes the type guard of T in map form.
 *
 * Do not pass extra properties to the object, otherwise it will cause a type error.
 */
export type TypeGuardMap<T> =
    | NameOfAtomicType<T>
    | TypeGuard<T>
    | (T extends object
          ? {
                [P in keyof T]: TypeGuardMap<T[P]>;
            }
          : never);

/**
 * Check if the value is T with the guard map.
 *
 * Do not pass extra properties to the object, otherwise it will cause a type error.
 */
export function checkWithMap<T>(v: unknown, guardMap: TypeGuardMap<T>): v is T {
    if (typeof guardMap === 'string') {
        return checkAtomicType(v, guardMap);
    }
    if (isAnyFn(guardMap)) {
        return guardMap(v);
    }
    if (!isPartialUnknown<T>(v)) {
        return false;
    }
    for (const key in guardMap) {
        if (!(key in v)) {
            return false;
        }
        // assume key is keyof T, otherwise it is the user's fault.
        if (!checkWithMap(v[key as keyof T], guardMap[key])) {
            return false;
        }
    }
    return true;
}
/**
 * Convert the guard map to a normal type guard.
 *
 * Do not pass extra properties to the object, otherwise it will cause a type error.
 */
export function asTypeGuard<Name extends AtomicTypeName>(
    name: Name,
): TypeGuard<AtomicTypeOfName<Name>>;
export function asTypeGuard<T>(guardMap: TypeGuardMap<T>): TypeGuard<T>;
export function asTypeGuard<T>(guardMap: TypeGuardMap<T>): TypeGuard<T> {
    return (v: unknown): v is T => checkWithMap(v, guardMap);
}

/**
 * Check if the value is T[] with the guard map of T.
 */

export function isArrayOf<Name extends AtomicTypeName>(
    name: Name,
): TypeGuard<AtomicTypeOfName<Name>[]>;
export function isArrayOf<T>(guardMap: TypeGuardMap<T>): TypeGuard<T[]>;
export function isArrayOf<T>(guardMap: TypeGuardMap<T>): TypeGuard<T[]> {
    const guard = asTypeGuard(guardMap);
    return (v: unknown) => Array.isArray(v) && v.every(guard);
}
/**
 * Check if the value is { [key: string]: T } with the guard map of T.
 */
export function isRecordOf<Name extends AtomicTypeName>(
    name: Name,
): TypeGuard<{ [key: string]: AtomicTypeOfName<Name> }>;
export function isRecordOf<T>(
    guardMap: TypeGuardMap<T>,
): TypeGuard<{ [key: string]: T }>;
export function isRecordOf<T>(
    guardMap: TypeGuardMap<T>,
): TypeGuard<{ [key: string]: T }> {
    const guard = asTypeGuard(guardMap);
    return (v: unknown): v is { [key: string]: T } =>
        isNonNullableObject(v) && Object.values(v).every(guard);
}

/**
 * Check if the value is T | undefined with the guard map of T.
 */
export function isOptional<Name extends AtomicTypeName>(
    name: Name,
): TypeGuard<AtomicTypeOfName<Name> | undefined>;
export function isOptional<T>(
    guardMap: TypeGuardMap<T>,
): TypeGuard<T | undefined>;
export function isOptional<T>(
    guardMap: TypeGuardMap<T>,
): TypeGuard<T | undefined> {
    const guard = asTypeGuard(guardMap);
    return (v: unknown): v is T | undefined => v === undefined || guard(v);
}
/**
 * Check if the value is one of the literals (string, number, boolean) with the guard map of T.
 */
export function isLiteral<T extends string | number | boolean>(
    ...literals: T[]
): TypeGuard<T> {
    const set = new Set(literals);
    return (v: unknown): v is T => set.has(v as T);
}

/**
 * Describes a list of type guards in order as a tuple.
 */
export type TupleTypeGuard<T extends unknown[]> = T extends [
    infer First,
    ...infer Rest,
]
    ? [TypeGuardMap<First>, ...TupleTypeGuard<Rest>]
    : [];

/**
 * Check if the value is [T1, T2, ...] with the guard map of T1, T2, ...
 *
 * Generic type `T` should not be omitted for type inference.
 */
export function isTuple<T extends unknown[]>(
    ...guards: TupleTypeGuard<T>
): TypeGuard<T> {
    return (v: unknown): v is T =>
        Array.isArray(v) &&
        v.length >= guards.length &&
        guards.every((map, i) => checkWithMap(v[i], map));
}

/**
 * Check if the value is (T1 | T2 | ...) with the guard map of T1, T2, ...
 *
 * Generic type `T` cannot be omitted if there is some AtomicTypeName in the arguments.
 */
export function isUnion<T1, T2>(
    map1: TypeGuardMap<T1>,
    map2: TypeGuardMap<T2>,
): TypeGuard<T1 | T2>;
export function isUnion<T1, T2, T3>(
    map1: TypeGuardMap<T1>,
    map2: TypeGuardMap<T2>,
    map3: TypeGuardMap<T3>,
): TypeGuard<T1 | T2 | T3>;
export function isUnion<T1, T2, T3, T4>(
    map1: TypeGuardMap<T1>,
    map2: TypeGuardMap<T2>,
    map3: TypeGuardMap<T3>,
    map4: TypeGuardMap<T4>,
): TypeGuard<T1 | T2 | T3 | T4>;
export function isUnion<T extends unknown[]>(
    ...guards: TypeGuardMap<T[number]>[]
): TypeGuard<T[number]> {
    return (v: unknown): v is T[number] =>
        guards.some((map) => checkWithMap(v, map));
}

/**
 * Build a type-safe parser with the guard map of T.
 */
export function asParser<T>(
    guardMap: TypeGuardMap<T>,
    defaultValue?: T,
): (json: string) => T {
    const guard = asTypeGuard(guardMap);
    return (json: string) => {
        try {
            const obj = JSON.parse(json);
            if (!guard(obj)) {
                throw new Error('Invalid JSON');
            }
            return obj;
        } catch (e) {
            if (defaultValue !== undefined) {
                return _.cloneDeep(defaultValue);
            }
            throw e;
        }
    };
}
