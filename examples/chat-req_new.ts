import { fin } from "@yyhhenry/rust-result";
import {
  array,
  atomic,
  type InferType,
  leafErr,
  literal,
  optional,
  struct,
  withCondition,
} from "../mod_new.ts";

const Message = struct({
  role: literal("user", "assistant", "system"),
  content: atomic("string"),
});

const Messages = withCondition(
  array(Message),
  (v) => {
    if (v.length === 0) {
      return leafErr("Messages should not be empty");
    }
    return fin();
  },
);
export type Messages = InferType<typeof Messages>;

const ChatRequest = struct({
  model: atomic("string"),
  stream: optional(atomic("boolean")),
  messages: Messages,
});
export type ChatRequest = InferType<typeof ChatRequest>;

function validateMessages(v: unknown) {
  Messages.validate(v).match(
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

export function chatRequest(userInput: string): ChatRequest | undefined {
  const parsed = ChatRequest.parse(userInput);
  if (parsed.isErr()) {
    console.log("Invalid ChatRequest:", parsed.e.message);
    return undefined;
  }
  parsed.v.stream ??= true;
  return parsed.v;
}

// Invalid ChatRequest: in messages: Messages should not be empty
chatRequest(
  JSON.stringify({
    model: "model",
    stream: true,
    messages: [],
  }),
);
