import { assertEquals } from "@std/assert";
import { literal } from "../src/atomic.ts";
import {
  DBoolean,
  DNumber,
  DString,
  DUndefined,
  type InferType,
} from "../mod.ts";

type TypeEq<A, B> = (<T>() => T extends A ? 1 : 2) extends
  <T>() => T extends B ? 1 : 2 ? true : false;

Deno.test("atomic", () => {
  assertEquals(DString.guard("123"), true);
  assertEquals(DString.guard(String("")), true);
  assertEquals(DString.guard(123), false);

  assertEquals(DNumber.guard(123), true);
  assertEquals(DNumber.guard(123.456), true);
  assertEquals(DNumber.guard(0), true);
  assertEquals(DNumber.guard("123"), false);
  assertEquals(DNumber.guard([]), false);

  assertEquals(DBoolean.guard(true), true);
  assertEquals(DBoolean.guard(false), true);
  assertEquals(DBoolean.guard("true"), false);
  assertEquals(DBoolean.guard(0), false);

  assertEquals(DUndefined.guard(undefined), true);
  assertEquals(DUndefined.guard({}), false);
  assertEquals(DUndefined.guard(null), false);
  assertEquals(DUndefined.guard(0), false);
});

Deno.test("literal", () => {
  const DRole = literal("user", "assistant", "system");
  type Role = InferType<typeof DRole>; // "user" | "assistant" | "system"
  const _: TypeEq<Role, "user" | "assistant" | "system"> = true;

  assertEquals(DRole.guard("user"), true);
  assertEquals(DRole.guard("assistant"), true);
  assertEquals(DRole.guard("system"), true);
  assertEquals(DRole.guard("admin"), false);
  assertEquals(DRole.guard(123), false);
  assertEquals(DRole.guard(true), false);

  const DEnabled = literal("enabled", "disabled", null);
  type Enabled = InferType<typeof DEnabled>; // "enabled" | "disabled" | null
  const _1: TypeEq<Enabled, "enabled" | "disabled" | null> = true;
  assertEquals(DEnabled.guard("enabled"), true);
  assertEquals(DEnabled.guard("disabled"), true);
  assertEquals(DEnabled.guard(null), true);
  assertEquals(DEnabled.guard("null"), false);
});
