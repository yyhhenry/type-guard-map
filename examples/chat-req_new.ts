import { err, fin, ok, type Result } from "@yyhhenry/rust-result";
import {
  array,
  DBoolean,
  DString,
  type InferType,
  leafErr,
  literal,
  optional,
  struct,
  withCondition,
} from "../mod_new.ts";

const DMessage = struct({
  role: literal("user", "assistant", "system"),
  content: DString,
});

const DMessages = withCondition(
  array(DMessage),
  (v) => {
    if (v.length === 0) {
      return leafErr("Messages should not be empty");
    }
    return fin();
  },
);

const DChatRequest = struct({
  model: DString,
  stream: optional(DBoolean),
  messages: DMessages,
});
export type ChatRequest = InferType<typeof DChatRequest>;

function validateMessages(v: unknown) {
  DMessages.validate(v).match(
    () => console.log(JSON.stringify(v), "Accepted"),
    (e) => console.log(JSON.stringify(v), "error:", e.message),
  );
}

// [{"role":"user","content":"hello"}] Accepted
validateMessages([{ role: "user", content: "hello" }]);

// [{"role":"Peter","content":"hello"}] error: in 0.role: Expected one of "user", "assistant", "system", got "Peter"
validateMessages([{ role: "Peter", content: "hello" }]);

// [{"role":"assistant","content":42}] error: in 0.content: Expected string, got 42
validateMessages([{ role: "assistant", content: 42 }]);

export function chatRequest(userInput: string): Result<ChatRequest, Error> {
  return DChatRequest.parse(userInput).match(
    (req) => {
      req.stream ??= false;
      return ok(req);
    },
    (e) => {
      console.log("Invalid ChatRequest:", e.message);
      return err(e);
    },
  );
}

// Invalid ChatRequest: in messages: Messages should not be empty
chatRequest(
  JSON.stringify({
    model: "model",
    stream: true,
    messages: [],
  }),
);

// Invalid ChatRequest: in messages.0.content: Expected string, got 42
chatRequest(
  JSON.stringify({
    model: "model",
    stream: false,
    messages: [
      {
        role: "user",
        content: 42,
      },
    ],
  }),
);

// Invalid ChatRequest: Expected property name or '}' in JSON at position 1 (line 1 column 2)
chatRequest("{");

// ok {
//   model: "model",
//   messages: [ { role: "user", content: "hello" } ],
//   stream: false
// }
chatRequest(JSON.stringify(
  {
    model: "model",
    messages: [
      {
        role: "user",
        content: "hello",
      },
    ],
  },
)).map((req) => {
  console.log("ok", req);
}).expect("Unexpected error");
