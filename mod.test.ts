import { assertEquals, assertNotEquals } from "@std/assert";
import {
  asParser,
  asTypeGuard,
  checkAtomicType,
  isAnyFn,
  isArrayOf,
  isLiteral,
  isNonNullableObject,
  isOptional,
  isPartialUnknown,
  isRecordOf,
  isTuple,
  isUnion,
  withCondition,
} from "./mod.ts";

Deno.test("isNonNullableObject", () => {
  assertEquals(isNonNullableObject({}), true);
  assertEquals(isNonNullableObject([]), true); // Arrays are certainly objects.
  assertEquals(isNonNullableObject(0), false);
  assertEquals(isNonNullableObject(null), false);
});

Deno.test("isAnyFn", () => {
  function fn1() {}
  const fn2 = function (hello: string) {
    return hello;
  };
  const fn3 = () => {};
  const fn4 = new Function("a", "b", "return a + b");
  assertEquals(isAnyFn(fn1), true);
  assertEquals(isAnyFn(fn2), true);
  assertEquals(isAnyFn(fn3), true);
  assertEquals(isAnyFn(fn4), true);
  assertEquals(isAnyFn({}), false);
  assertEquals(isAnyFn([]), false);
  assertEquals(isAnyFn(0), false);
});

interface Foo {
  foo: string;
  bar: number;
  list: string[];
}
const foo: Foo = {
  foo: "hello",
  bar: 42,
  list: ["hello", "world"],
};
const notFoo = {
  name: "Peter",
  age: 42,
};
const somethingNull = null;
const notObject = 42;

Deno.test("isPartialUnknown", () => {
  assertEquals(isPartialUnknown<Foo>(foo), true);
  assertEquals(isPartialUnknown<Foo>(notFoo), true); // Still true, it just act like isNonNullableObject.
  assertEquals(isPartialUnknown<Foo>(somethingNull), false);
  assertEquals(isPartialUnknown<Foo>(notObject), false);

  const isFooManual = (v: unknown): v is Foo => {
    if (!isPartialUnknown<Foo>(v)) {
      return false;
    }
    // let typeName = typeof v.notExist; // This should cause a type error.
    return (
      typeof v.foo === "string" && // Intellisense should work here.
      typeof v.bar === "number" && // Renaming should include this line.
      isArrayOf("string")(v.list)
    );
  };
  assertEquals(isFooManual(foo), true);
  assertEquals(isFooManual(notFoo), false);
});

Deno.test("checkAtomicType", () => {
  assertEquals(checkAtomicType("hello", "string"), true);
  assertEquals(checkAtomicType(42, "number"), true);
  assertEquals(checkAtomicType(true, "boolean"), true);
  assertEquals(checkAtomicType(BigInt(10), "bigint"), true);
  assertEquals(checkAtomicType(Symbol("hello"), "symbol"), true);
  assertEquals(checkAtomicType(undefined, "undefined"), true);

  assertEquals(checkAtomicType("hello", "number"), false);
  assertEquals(checkAtomicType(42, "string"), false);
  assertEquals(checkAtomicType(true, "number"), false);
  assertEquals(checkAtomicType(BigInt(10), "boolean"), false);
  assertEquals(checkAtomicType(Symbol("hello"), "bigint"), false);
  assertEquals(checkAtomicType(undefined, "symbol"), false);

  const isCharManual = (v: unknown): v is string => {
    if (!checkAtomicType(v, "string")) {
      return false;
    }
    return v.length === 1; // TS should know that v is string here.
  };
  assertEquals(isCharManual("a"), true);
  assertEquals(isCharManual("ab"), false);
});

Deno.test("asTypeGuard", () => {
  // asTypeGuard should internally use checkWithMap, so we don't need to test checkWithMap.
  const isFoo = asTypeGuard<Foo>({
    foo: "string",
    bar: "number",
    list: isArrayOf("string"),
  });
  assertEquals(isFoo(foo), true);
  assertEquals(isFoo(notFoo), false);
  assertEquals(isFoo(somethingNull), false);
  assertEquals(isFoo(notObject), false);

  const fooWithEmptyList = {
    foo: "hello",
    bar: 42,
    list: [],
  };
  const fooWithExtra = {
    foo: "hello",
    bar: 42,
    list: ["hello", "world"],
    extra: "extra",
  };
  const fooWithSomethingWrongInList = {
    foo: "hello",
    bar: 42,
    list: [42],
  };
  assertEquals(isFoo(fooWithEmptyList), true);
  assertEquals(isFoo(fooWithExtra), true);
  assertEquals(isFoo(fooWithSomethingWrongInList), false);
});

Deno.test("isLiteral and isOptional", () => {
  const is42or0 = isLiteral(0, 42);
  assertEquals(is42or0(0), true);
  assertEquals(is42or0(42), true);
  assertEquals(is42or0(1), false);
  assertEquals(is42or0("42"), false);

  const isHello = isLiteral("hello");
  assertEquals(isHello("hello"), true);
  assertEquals(isHello("world"), false);

  const isOptionalString = isOptional("string");
  assertEquals(isOptionalString(undefined), true);
  assertEquals(isOptionalString("hello"), true);
  assertEquals(isOptionalString(42), false);
});

Deno.test("isArrayOf and isRecordOf", () => {
  const isArrayOfString = isArrayOf("string");
  assertEquals(isArrayOfString([]), true);
  assertEquals(isArrayOfString(["hello", "world"]), true);
  assertEquals(isArrayOfString(["hello", 42]), false);

  const isRecordOfArrayOfString = isRecordOf(isArrayOf("string"));
  assertEquals(isRecordOfArrayOfString({}), true);
  assertEquals(
    isRecordOfArrayOfString({
      foo: ["hello", "world"],
      bar: ["hello", "world"],
    }),
    true,
  );
  assertEquals(isRecordOfArrayOfString({ foo: ["hello", 42] }), false);
});

Deno.test("isTuple and isUnion", () => {
  type NamedNumber = [string, number];
  const isNamedNumber = isTuple<NamedNumber>("string", "number");
  // This should cause a type error.
  // const wrongGuard = isTuple<NamedNumber>(
  //     'string',
  //     'number',
  //     'string',
  // );
  assertEquals(isNamedNumber(["foo", 42]), true);
  assertEquals(isNamedNumber(["foo", "42"]), false);

  const isKeyType = isUnion<string, number>("string", "number");
  const isKeyType2 = isUnion(asTypeGuard("string"), asTypeGuard("number"));

  assertEquals(isKeyType("hello"), true);
  assertEquals(isKeyType(42), true);
  assertEquals(isKeyType(true), false);

  assertEquals(isKeyType2("hello"), true);
  assertEquals(isKeyType2(42), true);
  assertEquals(isKeyType2(true), false);
});

Deno.test("asParser", () => {
  const defaultFoo: Foo = {
    foo: "",
    bar: 0,
    list: [],
  };
  const fooParser = asParser<Foo>(
    {
      foo: "string",
      bar: "number",
      list: isArrayOf("string"),
    },
    defaultFoo,
  );

  const fooJson = JSON.stringify(foo);
  const parsedFoo = fooParser(fooJson);
  assertEquals(parsedFoo, foo);

  const notFooJson = JSON.stringify(notFoo);
  const parsedNotFoo = fooParser(notFooJson);
  assertEquals(parsedNotFoo, defaultFoo);
  parsedFoo.list.push("hello");
  assertNotEquals(parsedFoo, defaultFoo); // cloned
});

Deno.test("withCondition", () => {
  const nonEmptyString = withCondition("string", (v, err) => {
    if (v.length === 0) {
      err?.("String should not be empty");
      return false;
    }
    return true;
  });

  assertEquals(nonEmptyString("hello"), true);
  assertEquals(nonEmptyString(""), false);
  assertEquals(nonEmptyString(42), false);
});
