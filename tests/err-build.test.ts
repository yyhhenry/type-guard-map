import { assertEquals } from "@std/assert";
import { leafErr, leafExpect } from "../src/err-builder.ts";

Deno.test("ErrBuilder", () => {
  const err = leafErr("something wrong");
  assertEquals(err.unwrapErr().toError().message, "something wrong");

  const errExpect = leafExpect("string", 42);
  assertEquals(
    errExpect.unwrapErr().toError().message,
    "Expected string, got 42",
  );
});
