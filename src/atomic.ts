import { fin } from "@yyhhenry/rust-result";
import { leafExpect } from "./err-builder.ts";
import { createHelper, type TypeHelper } from "./type-helper.ts";

type AtomicTypeMap = {
  string: string;
  number: number;
  boolean: boolean;
  undefined: undefined;
};
function atomic<Name extends keyof AtomicTypeMap>(
  name: Name,
): TypeHelper<AtomicTypeMap[Name]> {
  return createHelper((v) => {
    const typeName = typeof v;
    if (typeName === name) {
      return fin();
    }
    return leafExpect(name, v);
  });
}

// Constants for atomic types.
/**
 * A `TypeHelper` object for the `string` type.
 */
export const DString: TypeHelper<string> = atomic("string");
/**
 * A `TypeHelper` object for the `number` type.
 */
export const DNumber: TypeHelper<number> = atomic("number");
/**
 * A `TypeHelper` object for the `boolean` type.
 */
export const DBoolean: TypeHelper<boolean> = atomic("boolean");
/**
 * A `TypeHelper` object for the `undefined` type.
 */
export const DUndefined: TypeHelper<undefined> = atomic("undefined");

/**
 * Literal types.
 */
export type LiteralType = string | number | boolean | null | undefined;
/**
 * Creates a type helper that checks if a value matches one of the provided literal types.
 * @param args - The literal values.
 * @example
 * ```ts
 * const DRole = literal("user", "assistant", "system");
 * type Role = InferType<typeof DRole>; // "user" | "assistant" | "system"
 * ```
 */
export function literal<T extends LiteralType[]>(
  ...args: T
): TypeHelper<T[number]> {
  const valuesStr = args.map((v) => JSON.stringify(v)).join(", ");
  return createHelper((v) => {
    for (const arg of args) {
      if (v === arg) {
        return fin();
      }
    }
    return leafExpect(`one of ${valuesStr}`, v);
  });
}
