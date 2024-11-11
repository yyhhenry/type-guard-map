import { err, fin, ok, type Result } from "@yyhhenry/rust-result";
import {
  DBoolean,
  DString,
  type InferType,
  leafErr,
  literal,
  struct,
  type TypeHelper,
} from "@yyhhenry/type-guard-map";

const DMessage = struct({
  role: literal("user", "assistant", "system"),
  content: DString,
});

const DMessages = DMessage.arr().cond((v) => {
  if (v.length === 0) {
    return leafErr("Messages should not be empty");
  }
  return fin();
});

// Infer type from Helper
export type Messages = InferType<typeof DMessages>;

// Or create Helper from existing type
export interface ChatRequest {
  model: string;
  stream?: boolean;
  messages: Messages;
}
// With optional fields, you need to define the type explicitly,
// since { a?: T } is not the same as { a: T | undefined }.
const DChatRequest: TypeHelper<ChatRequest> = struct({
  model: DString,
  stream: DBoolean.opt(),
  messages: DMessages,
});

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
  } satisfies ChatRequest,
)).map((req) => {
  console.log("ok", req);
}).expect("Unexpected error");
