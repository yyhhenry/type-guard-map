import { err, fin, type Result, wrapFn } from "@yyhhenry/rust-result";

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

export class ErrBuilder {
    stackRev: (string | number)[];
    message: string;
    constructor(message: string) {
        this.stackRev = [];
        this.message = message;
    }
    errIn(key: string | number) {
        this.stackRev.push(key);
    }
    toError(): SyntaxError {
        return new SyntaxError(this.asFullMessage());
    }
    asFullMessage(): string {
        if (this.stackRev.length === 0) {
            return this.message;
        }
        return `in ${this.stackRev.reverse().join(".")}: ${this.message}`;
    }
}
export function leafErr<T>(message: string): Result<T, ErrBuilder> {
    return err(new ErrBuilder(message));
}
export function leafExpect<T>(
    expectStr: string,
    v: unknown,
): Result<T, ErrBuilder> {
    return leafErr(`Expected ${expectStr}, got ${JSON.stringify(v)}`);
}

export const parseJson: (text: string) => Result<unknown, Error> = wrapFn(
    JSON.parse,
);
export const isTypeHelperSymbol = Symbol("isTypeHelper");
export interface TypeHelper<T> {
    readonly [isTypeHelperSymbol]: true;
    validateBase(v: unknown): Result<T, ErrBuilder>;

    guard(v: unknown, onErr?: (e: Error) => unknown): v is T;
    validate(v: unknown): Result<T, Error>;
    parse(text: string): Result<T, Error>;
}
export type InferType<Helper extends TypeHelper<unknown>> = Helper extends
    TypeHelper<infer T> ? T : never;

class TypeHelperImpl<T> implements TypeHelper<T> {
    readonly [isTypeHelperSymbol] = true;
    constructor(
        private innerGuard: (v: unknown) => Result<void, ErrBuilder>,
    ) {}
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
        return parseJson(text).andThen((v) => this.validate(v));
    }
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

export function atomic<Name extends AtomicTypeName>(
    name: Name,
): TypeHelper<AtomicTypeOfName<Name>> {
    return new TypeHelperImpl((v) => {
        const typeName = typeof v;
        if (typeName === name) {
            return fin();
        }
        return leafExpect(name, v);
    });
}

export const DString = atomic("string");
export const DNumber = atomic("number");
export const DBigInt = atomic("bigint");
export const DBoolean = atomic("boolean");
export const DSymbol = atomic("symbol");
export const DUndefined = atomic("undefined");

export type LiteralType = string | number | boolean | null | undefined;
export function literal<T extends LiteralType[]>(
    ...args: T
): TypeHelper<T[number]> {
    const valuesStr = args.map((v) => JSON.stringify(v)).join(", ");
    return new TypeHelperImpl((v) => {
        for (const arg of args) {
            if (v === arg) {
                return fin();
            }
        }
        return leafExpect(`one of ${valuesStr}`, v);
    });
}

export type NullableToOptional<T> =
    & {
        [K in keyof T as undefined extends T[K] ? K : never]?: Exclude<
            T[K],
            undefined
        >;
    }
    & { [K in keyof T as undefined extends T[K] ? never : K]: T[K] };
export type StructTypeFromMap<T extends Record<string, TypeHelper<unknown>>> =
    NullableToOptional<{ [K in keyof T]: InferType<T[K]> }>;

export function struct<T extends Record<string, TypeHelper<unknown>>>(
    fields: T,
): TypeHelper<StructTypeFromMap<T>> {
    return new TypeHelperImpl((v) => {
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

export function array<T>(helper: TypeHelper<T>): TypeHelper<T[]> {
    return new TypeHelperImpl((v) => {
        if (!Array.isArray(v)) {
            return leafExpect("array", v);
        }
        for (let i = 0; i < v.length; i++) {
            const result = helper.validateBase(v[i]);
            if (result.isErr()) {
                result.e.errIn(i);
                return err(result.e);
            }
        }
        return fin();
    });
}

export function optional<T>(helper: TypeHelper<T>): TypeHelper<T | undefined> {
    return new TypeHelperImpl((v) => {
        if (v === undefined) {
            return fin();
        }
        return helper.validateBase(v).map(() => {});
    });
}

export function tuple<T extends TypeHelper<unknown>[]>(
    ...helpers: T
): TypeHelper<{ [K in keyof T]: InferType<T[K]> }> {
    return new TypeHelperImpl((v) => {
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

export function union<T extends TypeHelper<unknown>[]>(
    ...helpers: T
): TypeHelper<InferType<T[number]>> {
    return new TypeHelperImpl((v) => {
        const errors: string[] = [];
        for (const helper of helpers) {
            const result = helper.validateBase(v);
            if (result.isOk()) {
                return fin();
            }
            errors.push(`(${result.e.asFullMessage()})`);
        }
        return leafErr(errors.join(" and "));
    });
}

export function withCondition<T>(
    helper: TypeHelper<T>,
    condition: (v: T) => Result<void, ErrBuilder>,
): TypeHelper<T> {
    return new TypeHelperImpl((v) => {
        return helper.validateBase(v).andThen((v) => condition(v));
    });
}
