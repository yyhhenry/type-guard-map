import { assertEquals } from "@std/assert";
import { DNumber, DString, leafErr, leafExpect } from "../mod.ts";
import { createHelper, type InferType, struct } from "../src/type-helper.ts";
import { fin } from "@yyhhenry/rust-result";
import { tuple } from "../src/type-helper.ts";
import { assertType, type TypeEq } from "../src/assert-type.ts";

Deno.test("TypeHelper (create, guard, validate)", () => {
  const DHex = createHelper<string>((v) => {
    if (typeof v !== "string") {
      return leafExpect("string", v);
    }
    if (!/^[0-9a-fA-F]+$/.test(v)) {
      return leafErr("Invalid hex string");
    }
    return fin();
  });

  assertEquals(DHex.guard("a000"), true);
  assertEquals(DHex.guard(123), false);
  assertEquals(DHex.guard("123z"), false);

  assertEquals(DHex.validate("a000").unwrap(), "a000");
  assertEquals(
    DHex.validate(123).unwrapErr().message,
    "Expected string, got 123",
  );
  assertEquals(
    DHex.validate("123z").unwrapErr().message,
    "Invalid hex string",
  );
});

Deno.test("parse & parseWithDefault", () => {
  interface PersonExpected {
    name: string;
    age: number;
  }
  const DPerson = struct({
    name: DString,
    age: DNumber,
  });
  type Person = InferType<typeof DPerson>;
  assertType<TypeEq<Person, PersonExpected>>();

  const person = DPerson.parse(JSON.stringify({ name: "Alice", age: 20 }));
  assertEquals(person.unwrap(), { name: "Alice", age: 20 });

  const personErr = DPerson.parse(JSON.stringify({ name: "Alice" }));
  assertEquals(
    personErr.unwrapErr().message,
    "in age: Expected number, got undefined",
  );

  const person2 = DPerson.parseWithDefault(
    JSON.stringify({ name: "Alice" }),
    { name: "Bob", age: 30 },
  );
  assertEquals(person2, { name: "Bob", age: 30 });
});

Deno.test("clone", () => {
  const DPerson = struct({
    name: DString,
    age: DNumber,
  });
  const person = { name: "Alice", age: 20 };
  const person2 = DPerson.clone(person);
  assertEquals(person2.unwrap(), person);

  // `JSON.stringify` transforms Date to string,
  // and our type helper will find the difference
  const DDate = createHelper<Date>((v) => {
    if (v instanceof Date) {
      return fin();
    }
    return leafExpect("Date", v);
  });
  const date = new Date();
  const date2 = DDate.clone(date);
  assertEquals(
    date2.unwrapErr().message,
    "Expected Date, got " + JSON.stringify(date),
  );
});

Deno.test("and & merge & or", () => {
  const DStringOrNumber = DString.or(DNumber);
  assertType<TypeEq<InferType<typeof DStringOrNumber>, string | number>>();

  assertEquals(DStringOrNumber.guard("123"), true);
  assertEquals(DStringOrNumber.guard(123), true);
  assertEquals(DStringOrNumber.guard(true), false);

  const DNameWithAge_And = struct({
    name: DString,
  }).and(struct({
    age: DNumber,
  }));
  assertType<
    TypeEq<
      InferType<typeof DNameWithAge_And>,
      { name: string } & { age: number }
    >
  >(); // This keeps the original & operator

  const DNameWithAge = struct({
    name: DString,
  }).merge(struct({
    age: DNumber,
  }));
  assertType<
    TypeEq<InferType<typeof DNameWithAge>, { name: string; age: number }>
  >();

  assertEquals(DNameWithAge.guard({ name: "Alice", age: 20 }), true);
  assertEquals(
    DNameWithAge.validate({ name: "Alice" }).unwrapErr().message,
    "in age: Expected number, got undefined",
  );
  assertEquals(
    DNameWithAge.validate({ name: "Alice", age: "20" }).unwrapErr().message,
    `in age: Expected number, got "20"`,
  );
});

Deno.test("opt", () => {
  const DOptString = DString.opt();
  assertType<TypeEq<InferType<typeof DOptString>, string | undefined>>();

  assertEquals(DOptString.guard("123"), true);
  assertEquals(DOptString.guard(undefined), true);
  assertEquals(
    DOptString.validate(123).unwrapErr().message,
    "Expected string, got 123",
  );
});

Deno.test("arr", () => {
  const DArrayOfString = DString.arr();
  assertType<TypeEq<InferType<typeof DArrayOfString>, string[]>>();

  assertEquals(DArrayOfString.guard(["123", "456"]), true);
  assertEquals(DArrayOfString.guard([]), true);
  assertEquals(
    DArrayOfString.validate(["123", 456]).unwrapErr().message,
    "in 1: Expected string, got 456",
  );
});

Deno.test("rec", () => {
  const DRecOfString = DString.rec();
  assertType<TypeEq<InferType<typeof DRecOfString>, Record<string, string>>>();

  assertEquals(DRecOfString.guard({ a: "123", b: "456" }), true);
  assertEquals(DRecOfString.guard({}), true);
  assertEquals(
    DRecOfString.validate({ a: "123", b: 456 }).unwrapErr().message,
    "in b: Expected string, got 456",
  );
});

Deno.test("cond", () => {
  const DPositiveNumber = DNumber.cond((v) => {
    if (v > 0) {
      return fin();
    }
    return leafErr("Expected positive number");
  });
  assertType<TypeEq<InferType<typeof DPositiveNumber>, number>>();

  assertEquals(DPositiveNumber.guard(123), true);
  assertEquals(
    DPositiveNumber.validate(-123).unwrapErr().message,
    "Expected positive number",
  );
});

Deno.test("struct", () => {
  interface Person {
    name: string;
    age?: number;
  }
  const DPerson = struct({
    name: DString,
    age: DNumber.opt(),
  });
  assertType<TypeEq<InferType<typeof DPerson>, Person>>();

  assertEquals(DPerson.guard({ name: "Alice" }), true);
  assertEquals(DPerson.guard({ name: "Alice", age: 20 }), true);
  assertEquals(
    DPerson.validate({ name: "Alice", age: "20" }).unwrapErr().message,
    `in age: Expected number, got "20"`,
  );
});

Deno.test("tuple", () => {
  const DPair = tuple(DString, DNumber);
  assertType<TypeEq<InferType<typeof DPair>, [string, number]>>();

  assertEquals(DPair.guard(["Alice", 20]), true);
  assertEquals(
    DPair.validate(["Alice"]).unwrapErr().message,
    "tuple length 2, got 1",
  );
  assertEquals(
    DPair.validate(["Alice", "20"]).unwrapErr().message,
    `in 1: Expected number, got "20"`,
  );
  assertEquals(
    DPair.validate(["Alice", 20, "Bob"]).unwrapErr().message,
    "tuple length 2, got 3",
  );
});
