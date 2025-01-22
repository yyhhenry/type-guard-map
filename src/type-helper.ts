import { err, execFn, fin, type Result, wrapFn } from "@yyhhenry/rust-result";
import { type ErrBuilder, leafExpect } from "./err-builder.ts";
import { leafErr } from "../mod.ts";
import type { MergeProps } from "./assert-type.ts";
/**
 * The `TypeHelper` interface is used to define type guards and parsers for a specific type.
 */
export interface TypeHelper<T> {
  /**
   * Get type helper for (T | U).
   */
  or<U>(other: TypeHelper<U>): TypeHelper<T | U>;
  /**
   * Get type helper for (T & U).
   * If you want to merge the properties of T and U, use `merge()` instead.
   */
  and<U>(other: TypeHelper<U>): TypeHelper<T & U>;
  /**
   * Same as `and()`, but merges the properties of T and U.
   * For example, `{ a: number } & { b: string }` -> `{ a: number; b: string }`.
   */
  merge<U>(other: TypeHelper<U>): TypeHelper<MergeProps<T & U>>;
  /**
   * Get type helper for (T | undefined). Used with `struct()` for optional fields.
   *
   * Be aware that `undefined` is not a valid value in JSON and some other formats.
   * For type `T | null`, use `orNull()` instead.
   */
  opt(): TypeHelper<T | undefined>;
  /**
   * Get type helper for (T | null). Used with JSON and some other formats.
   *
   * For type `T | undefined` and optional fields in `struct()`, use `opt()` instead.
   */
  orNull(): TypeHelper<T | null>;
  /**
   * Get type helper for T[].
   */
  arr(): TypeHelper<T[]>;
  /**
   * Get type helper for Record<string, T>.
   */
  rec(): TypeHelper<Record<string, T>>;
  /**
   * Get a helper with a custom condition.
   */
  cond(f: (v: T) => Result<void, ErrBuilder>): TypeHelper<T>;

  /**
   * Validates the value and returns itself if the value is valid.
   * Otherwise, returns an error message (in the form of an `ErrBuilder` object).
   * Do not use this method outside an implementation of `TypeHelper`.
   */
  validateBase(v: unknown): Result<T, ErrBuilder>;

  /**
   * Validates the value and returns itself if the value is valid.
   * Otherwise, returns an error.
   */
  validate(v: unknown): Result<T>;
  /**
   * Type guard function that checks if the value is valid.
   */
  guard(v: unknown, onErr?: (e: Error) => unknown): v is T;
  /**
   * Parses a string and returns the parsed value if it is valid.
   * Otherwise, returns an error.
   */
  parse(text: string): Result<T>;
  /**
   * Parses a string and returns the parsed value if it is valid.
   * Otherwise, returns a default value.
   */
  parseWithDefault(text: string, defaultValue: T): T;
  /**
   * Clones an object of type T.
   *
   * `structuredClone()` is not compatible with Vue Proxy objects.
   * So internally, it uses `JSON.parse(JSON.stringify(obj))`,
   * but we will check the type of the result to ensure it is correct.
   *
   * In most cases you can just `unwrap()` the result.
   * But you may need to handle the error,
   * if Date objects or other similar built-in objects are involved.
   */
  clone(obj: T): Result<T>;
}
/**
 * Infers the type of a `TypeHelper`.
 *
 * @example
 * ```ts
 * const DString = atomic("string");
 * type StringType = InferType<typeof DString>; // string
 * ```
 */
export type InferType<Helper extends TypeHelper<unknown>> = Helper extends
  TypeHelper<infer T> ? T : never;

/**
 * A helper class that implements the `TypeHelper` interface.
 */
class TypeHelperImpl<T> implements TypeHelper<T> {
  constructor(
    private innerGuard: (v: unknown) => Result<void, ErrBuilder>,
  ) {}
  or<U>(other: TypeHelper<U>): TypeHelper<T | U> {
    return createHelper((v) => {
      const resT = this.innerGuard(v);
      if (resT.isOk()) {
        return fin();
      }
      const resU = other.validateBase(v);
      if (resU.isOk()) {
        return fin();
      }
      return leafErr(
        `(${resT.e.toError().message}) and (${resU.e.toError().message})`,
      );
    });
  }
  and<U>(other: TypeHelper<U>): TypeHelper<T & U> {
    return createHelper((v) => {
      const resT = this.innerGuard(v);
      if (resT.isErr()) {
        return resT;
      }
      const resU = other.validateBase(v);
      if (resU.isErr()) {
        return err(resU.e);
      }
      return fin();
    });
  }
  merge<U>(other: TypeHelper<U>): TypeHelper<MergeProps<T & U>> {
    return createHelper((v) => {
      const resT = this.innerGuard(v);
      if (resT.isErr()) {
        return resT;
      }
      const resU = other.validateBase(v);
      if (resU.isErr()) {
        return err(resU.e);
      }
      return fin();
    });
  }
  opt(): TypeHelper<T | undefined> {
    return createHelper((v) => {
      if (v === undefined) {
        return fin();
      }
      return this.innerGuard(v);
    });
  }
  orNull(): TypeHelper<T | null> {
    return createHelper((v) => {
      if (v === null) {
        return fin();
      }
      return this.innerGuard(v);
    });
  }
  arr(): TypeHelper<T[]> {
    return createHelper((v) => {
      if (!Array.isArray(v)) {
        return leafErr("Expected array");
      }
      for (const [id, item] of v.entries()) {
        const res = this.innerGuard(item);
        if (res.isErr()) {
          return res.mapErr((e) => e.errIn(id));
        }
      }
      return fin();
    });
  }
  rec(): TypeHelper<Record<string, T>> {
    return createHelper((v) => {
      if (typeof v !== "object" || v === null) {
        return leafErr("Expected object");
      }
      for (const [key, item] of Object.entries(v)) {
        const res = this.innerGuard(item);
        if (res.isErr()) {
          return res.mapErr((e) => e.errIn(key));
        }
      }
      return fin();
    });
  }
  cond(f: (v: T) => Result<void, ErrBuilder>): TypeHelper<T> {
    return createHelper((v) => {
      return this.validateBase(v).andThen(f);
    });
  }
  validateBase(v: unknown): Result<T, ErrBuilder> {
    // Safely cast to T.
    return this.innerGuard(v).map(() => v as T);
  }
  guard(v: unknown, onErr?: (e: Error) => unknown): v is T {
    const result = this.validateBase(v);
    if (result.isOk()) {
      return true;
    }
    onErr?.(result.e.toError());
    return false;
  }
  validate(v: unknown): Result<T, Error> {
    return this.validateBase(v).mapErr((e) => e.toError());
  }
  parse(text: string): Result<T, Error> {
    return wrapFn(JSON.parse)(text).andThen((v) => this.validate(v));
  }
  parseWithDefault(text: string, defaultValue: T): T {
    return this.parse(text).unwrapOr(defaultValue);
  }
  clone(obj: T): Result<T> {
    return execFn(() => JSON.parse(JSON.stringify(obj))).andThen((v) =>
      this.validate(v)
    );
  }
}
/**
 * Creates a `TypeHelper` object from a type guard function returning a `Result` object.
 */
export function createHelper<T>(
  guard: (v: unknown) => Result<void, ErrBuilder>,
): TypeHelper<T> {
  return new TypeHelperImpl(guard);
}

type PartialUnknown<T> = {
  [P in keyof T]?: unknown;
};

function isPartialUnknown<T>(v: unknown): v is PartialUnknown<T> {
  return typeof v === "object" && v !== null;
}

/**
 * Extracts optional fields produced by `TypeHelper.opt()` and `struct()`.
 * For example, `{ a: number; b: string | undefined; c: string | undefined; }`
 *          -> `"b" | "c"`.
 *
 * Since TypeHelper.opt() returns `T | undefined`,
 * we need to turn them into actual optional fields.
 */
export type ExtractOptFields<T> = {
  [K in keyof T]: undefined extends T[K] ? K : never;
}[keyof T];

/**
 * Extracts optional fields produced by `TypeHelper.opt()` and `struct()`.
 * For example, `{ a: number; b: string | undefined; }`
 *           -> `{ a: number; b?: string | undefined; }`.
 *
 * Since TypeHelper.opt() returns `T | undefined`,
 * we need to turn them into actual optional fields.
 */
export type HandleOptFields<T> = ExtractOptFields<T> extends never ? T
  : Exclude<keyof T, ExtractOptFields<T>> extends never ? {
      [K in ExtractOptFields<T>]?: T[K];
    }
  : MergeProps<
    & {
      [K in ExtractOptFields<T>]?: T[K];
    }
    & {
      [K in Exclude<keyof T, ExtractOptFields<T>>]: T[K];
    }
  >;

/**
 * Creates a `TypeHelper` object for a struct type.
 * @param fields - A Record of field names to type helpers.
 * @example
 * ```ts
 * const DPerson = struct({
 *   name: DString,
 *   age: DNumber,
 * });
 * type Person = InferType<typeof DPerson>; // { name: string; age: number; }
 *
 * // With optional fields, you need to define the type explicitly,
 * // since { name?: string; } is not the same as { name: string | undefined; }.
 * interface MayWithName {
 *   name?: string;
 * }
 * const DMayWithName: TypeHelper<MayWithName> = struct({ name: optional(DString) });
 * ```
 */
export function struct<T extends Record<string, TypeHelper<unknown>>>(
  fields: T,
): TypeHelper<HandleOptFields<{ [K in keyof T]: InferType<T[K]> }>> {
  return createHelper((v) => {
    if (!isPartialUnknown<Record<keyof T, unknown>>(v)) {
      return leafExpect("struct", v);
    }
    for (const [key, helper] of Object.entries(fields)) {
      const value = v[key];
      const result = helper.validateBase(value);
      if (result.isErr()) {
        result.e.errIn(key);
        return err(result.e);
      }
    }
    return fin();
  });
}

/**
 * Creates a `TypeHelper` object for a tuple type.
 * @param helpers - An array of type helpers for the tuple elements.
 * @example
 * ```ts
 * const DPair = tuple(DString, DNumber);
 * type Pair = InferType<typeof DPair>; // [string, number]
 * ```
 */
export function tuple<T extends TypeHelper<unknown>[]>(
  ...helpers: T
): TypeHelper<{ [K in keyof T]: InferType<T[K]> }> {
  return createHelper((v) => {
    if (!Array.isArray(v)) {
      return leafExpect("tuple", v);
    }
    if (v.length !== helpers.length) {
      return leafErr(`tuple length ${helpers.length}, got ${v.length}`);
    }
    for (let i = 0; i < helpers.length; i++) {
      const result = helpers[i].validateBase(v[i]);
      if (result.isErr()) {
        result.e.errIn(i);
        return err(result.e);
      }
    }
    return fin();
  });
}
