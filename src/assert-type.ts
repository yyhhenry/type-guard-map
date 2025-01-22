/**
 * Merges the properties of the type `T` into a single object type.
 * Mostly used with `&` operator.
 * For example, `{ a: number } & { b: string }` -> `{ a: number; b: string }`.
 */
export type MergeProps<T> = { [K in keyof T]: T[K] };

/**
 * Asserts that the type `A` is equal to the type `B`.
 */
export type TypeEq<A, B> = (<T>() => T extends A ? 1 : 2) extends
  <T>() => T extends B ? 1 : 2 ? true : false;

/**
 * Asserts that the type `A` is true. Used with `TypeEq`.
 *
 * @example
 * ```ts
 * type SomeType1 = (1 | 2) | 3;
 * type SomeType2 = 1 | (2 | 3);
 *
 * assertType<TypeEq<SomeType1, SomeType2>>();
 * ```
 */
export function assertType<T extends true>(_t?: T) {}
