// @deno-types="@types/lodash"
import _ from "lodash";

/**
 * Type guard of T.
 */
export type TypeGuard<T> = (
  v: unknown,
  onError?: (msg: string) => unknown,
) => v is T;

/**
 * Type guard of object (non-null).
 */
export function isNonNullableObject(v: unknown): v is object {
  return typeof v === "object" && v !== null;
}

/**
 * Any function type (without `any` type to make eslint happy).
 */
export type AnyFn = (...args: never[]) => unknown;

/**
 * Type guard of function.
 */
export function isAnyFn(v: unknown): v is AnyFn {
  return typeof v === "function";
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
  | "string"
  | "number"
  | "bigint"
  | "boolean"
  | "symbol"
  | "undefined";

/**
 * Name of atomic types.
 */
export type NameOfAtomicType<T> = T extends string ? "string"
  : T extends number ? "number"
  : T extends bigint ? "bigint"
  : T extends boolean ? "boolean"
  : T extends symbol ? "symbol"
  : T extends undefined ? "undefined"
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
  const typeName: string = typeof v;
  return typeName === name;
}

/**
 * Describes the type guard of T in map form.
 *
 * Do not pass extra properties to the object, otherwise it will cause a type error.
 */
export type TypeGuardMap<T> =
  | NameOfAtomicType<T>
  | TypeGuard<T>
  | (T extends object ? {
      [P in keyof T]: TypeGuardMap<T[P]>;
    }
    : never);

/**
 * Check if the value is T with the guard map.
 *
 * Do not pass extra properties to the object, otherwise it will cause a type error.
 */
export function checkWithMap<T>(
  v: unknown,
  guardMap: TypeGuardMap<T>,
  onError?: (msg: string) => unknown,
): v is T {
  if (typeof guardMap === "string") {
    const result = checkAtomicType(v, guardMap);
    if (!result) {
      onError?.(`Expected ${guardMap}, got ${typeof v}`);
    }
    return result;
  }
  if (isAnyFn(guardMap)) {
    let called = false;
    const err = (msg: string) => {
      if (!called) {
        onError?.(msg);
      }
      called = true;
    };
    const result = guardMap(v, err);
    if (!result) {
      err("Custom guard failed");
    }
    return result;
  }
  if (!isPartialUnknown<Record<string, unknown>>(v)) {
    onError?.("Expected object, got non-object");
    return false;
  }
  for (const key in guardMap) {
    const err = (msg: string) => {
      onError?.(`in ${key}: ${msg}`);
    };
    if (!checkWithMap(v[key], guardMap[key], err)) {
      return false;
    }
  }
  return true;
}
/**
 * Convert the guard map to a normal type guard.
 *
 * Guard map can be a string of atomic type name.
 */
export function asTypeGuard<Name extends AtomicTypeName>(
  name: Name,
): TypeGuard<AtomicTypeOfName<Name>>;
/**
 * Convert the guard map to a normal type guard.
 *
 * Do not pass extra properties to the object, otherwise it will cause a type error.
 */
export function asTypeGuard<T>(guardMap: TypeGuardMap<T>): TypeGuard<T>;
/**
 * Convert the guard map to a normal type guard.
 */
export function asTypeGuard<T>(guardMap: TypeGuardMap<T>): TypeGuard<T> {
  return (v: unknown, onError?: (msg: string) => unknown): v is T =>
    checkWithMap(v, guardMap, onError);
}

/**
 * Check if the value is T[] with AtomicTypeName.
 */
export function isArrayOf<Name extends AtomicTypeName>(
  name: Name,
): TypeGuard<AtomicTypeOfName<Name>[]>;
/**
 * Check if the value is T[] with the guard map of T.
 */
export function isArrayOf<T>(guardMap: TypeGuardMap<T>): TypeGuard<T[]>;
/**
 * Check if the value is T[] with the guard map of T.
 */
export function isArrayOf<T>(guardMap: TypeGuardMap<T>): TypeGuard<T[]> {
  const guard = asTypeGuard(guardMap);
  return (v: unknown, onError?: (msg: string) => unknown): v is T[] => {
    if (!Array.isArray(v)) {
      onError?.("Expected array, got non-array");
      return false;
    }
    for (const [id, item] of v.entries()) {
      const err = (msg: string) => {
        onError?.(`in [${id}]: ${msg}`);
      };
      if (!guard(item, err)) {
        return false;
      }
    }
    return true;
  };
}

/**
 * Check if the value is { [key: string]: AtomicTypeOfName<Name> } with AtomicTypeName.
 */
export function isRecordOf<Name extends AtomicTypeName>(
  name: Name,
): TypeGuard<{ [key: string]: AtomicTypeOfName<Name> }>;
/**
 * Check if the value is { [key: string]: T } with the guard map of T.
 */
export function isRecordOf<T>(
  guardMap: TypeGuardMap<T>,
): TypeGuard<{ [key: string]: T }>;
/**
 * Check if the value is { [key: string]: T } with the guard map of T.
 */
export function isRecordOf<T>(
  guardMap: TypeGuardMap<T>,
): TypeGuard<{ [key: string]: T }> {
  const guard = asTypeGuard(guardMap);
  return (
    v: unknown,
    onError?: (msg: string) => unknown,
  ): v is { [key: string]: T } => {
    if (!isPartialUnknown(v)) {
      onError?.("Expected object, got non-object");
      return false;
    }
    for (const [key, item] of Object.entries(v)) {
      const err = (msg: string) => {
        onError?.(`in ${key}: ${msg}`);
      };
      if (!guard(item, err)) {
        return false;
      }
    }
    return true;
  };
}

/**
 * Check if the value is (T | undefined) with AtomicTypeName.
 */
export function isOptional<Name extends AtomicTypeName>(
  name: Name,
): TypeGuard<AtomicTypeOfName<Name> | undefined>;
/**
 * Check if the value is (T | undefined) with the guard map of T.
 */
export function isOptional<T>(
  guardMap: TypeGuardMap<T>,
): TypeGuard<T | undefined>;
/**
 * Check if the value is (T | undefined) with the guard map of T.
 */
export function isOptional<T>(
  guardMap: TypeGuardMap<T>,
): TypeGuard<T | undefined> {
  const guard = asTypeGuard(guardMap);
  return (
    v: unknown,
    onError?: (msg: string) => unknown,
  ): v is T | undefined => {
    return v === undefined || guard(v, onError);
  };
}

/**
 * Check if the value is one of the literals (string, number, boolean) with the guard map of T.
 */
export function isLiteral<T extends string | number | boolean>(
  ...literals: T[]
): TypeGuard<T> {
  const set = new Set(literals);
  return (v: unknown, onError?: (msg: string) => unknown): v is T => {
    if (!set.has(v as T)) {
      onError?.(`Expected one of ${literals.join(", ")}, got ${v}`);
      return false;
    }
    return true;
  };
}

/**
 * Describes a list of type guards in order as a tuple.
 */
export type TupleTypeGuard<T extends unknown[]> = T extends [
  infer First,
  ...infer Rest,
] ? [TypeGuardMap<First>, ...TupleTypeGuard<Rest>]
  : [];

/**
 * Check if the value is [T1, T2, ...] with the guard map of T1, T2, ...
 *
 * Generic type `T` should not be omitted for type inference.
 */
export function isTuple<T extends unknown[]>(
  ...guards: TupleTypeGuard<T>
): TypeGuard<T> {
  return (v: unknown, onError?: (msg: string) => unknown): v is T => {
    if (!Array.isArray(v)) {
      onError?.("Expected array, got non-array");
      return false;
    }
    if (v.length < guards.length) {
      onError?.("Too few items in tuple");
      return false;
    }
    for (const [id, guard] of guards.entries()) {
      const err = (msg: string) => {
        onError?.(`in [${id}]: ${msg}`);
      };
      if (!checkWithMap(v[id], guard, err)) {
        return false;
      }
    }
    return true;
  };
}

/**
 * Check if the value is (T1 | T2) with the guard map of T1, T2.
 *
 * Generic type `T` cannot be omitted if there is some AtomicTypeName in the arguments.
 */
export function isUnion<T1, T2>(
  map1: TypeGuardMap<T1>,
  map2: TypeGuardMap<T2>,
): TypeGuard<T1 | T2>;
/**
 * Check if the value is (T1 | T2 | T3) with the guard map of T1, T2, T3.
 *
 * Generic type `T` cannot be omitted if there is some AtomicTypeName in the arguments.
 */
export function isUnion<T1, T2, T3>(
  map1: TypeGuardMap<T1>,
  map2: TypeGuardMap<T2>,
  map3: TypeGuardMap<T3>,
): TypeGuard<T1 | T2 | T3>;
/**
 * Check if the value is (T1 | T2 | T3 | T4) with the guard map of T1, T2, T3, T4.
 *
 * Generic type `T` cannot be omitted if there is some AtomicTypeName in the arguments.
 */
export function isUnion<T1, T2, T3, T4>(
  map1: TypeGuardMap<T1>,
  map2: TypeGuardMap<T2>,
  map3: TypeGuardMap<T3>,
  map4: TypeGuardMap<T4>,
): TypeGuard<T1 | T2 | T3 | T4>;

/**
 * Check if the value is (T1 | T2 | ... | Tn) with the guard map of T1, T2, ..., Tn.
 *
 * Generic type `T` cannot be omitted if there is some AtomicTypeName in the arguments.
 */
export function isUnion<T extends unknown[]>(
  ...guards: TypeGuardMap<T[number]>[]
): TypeGuard<T[number]> {
  return (v: unknown, onError?: (msg: string) => unknown): v is T[number] => {
    const errors: string[] = [];
    for (const guard of guards) {
      const err = (msg: string) => {
        errors.push(msg);
      };
      if (checkWithMap(v, guard, err)) {
        return true;
      }
    }
    onError?.(`Should be one of variants: ${errors.join(", ")}`);
    return false;
  };
}

/**
 * Type guard with AtomicTypeName and condition.
 */
export function withCondition<Name extends AtomicTypeName>(
  name: Name,
  condition: (
    v: AtomicTypeOfName<Name>,
    onError?: (msg: string) => unknown,
  ) => boolean,
): TypeGuard<AtomicTypeOfName<Name>>;
/**
 * Type guard with the guard map of T and condition.
 */
export function withCondition<T1>(
  guardMap: TypeGuardMap<T1>,
  condition: (v: T1, onError?: (msg: string) => unknown) => boolean,
): TypeGuard<T1>;
/**
 * Type guard with the guard map of T and condition.
 */
export function withCondition<T1>(
  guardMap: TypeGuardMap<T1>,
  condition: (v: T1, onError?: (msg: string) => unknown) => boolean,
): TypeGuard<T1> {
  const guard = asTypeGuard(guardMap);
  return (v: unknown, onError?: (msg: string) => unknown): v is T1 => {
    if (!guard(v, onError)) {
      return false;
    }
    let called = false;
    const err = (msg: string) => {
      if (!called) {
        onError?.(msg);
      }
      called = true;
    };
    const result = condition(v, err);
    if (!result) {
      err("Condition failed");
    }
    return result;
  };
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
      const err = (msg: string) => {
        throw new Error(msg);
      };
      if (!guard(obj, err)) {
        throw new Error("Invalid JSON");
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
