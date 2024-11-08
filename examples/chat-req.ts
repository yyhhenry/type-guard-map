import {
  asParser,
  isArrayOf,
  isLiteral,
  isOptional,
  withCondition,
} from "@yyhhenry/type-guard-map";

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}
export interface ChatRequest {
  model: string;
  /**
   * Default is true.
   */
  stream?: boolean;
  messages: Message[];
}
export const isMessages = withCondition(
  isArrayOf<Message>({
    role: isLiteral("user", "assistant", "system"),
    content: "string",
  }),
  (v, err) => {
    if (v.length === 0) {
      err?.("Messages should not be empty");
      return false;
    }
    return true;
  },
);
export const printWith = (prefix: string) => (msg: string) =>
  console.log(prefix, msg);

// true
isMessages([{ role: "user", content: "hello" }]);

// with role=Peter: in [0]: in role: Expected one of user, assistant, system, got Peter
isMessages(
  [{ role: "Peter", content: "hello" }],
  printWith(`with role=Peter:`),
);

// with content=42: in [0]: in content: Expected string, got number
isMessages([{ role: "system", content: 42 }], printWith(`with content=42:`));

// with empty msgs: Messages should not be empty
isMessages([], printWith(`with empty msgs:`));

export const chatRequestParser = asParser<ChatRequest>({
  model: "string",
  stream: isOptional("boolean"),
  messages: isMessages,
});

export function chatRequest(userInput: string) {
  try {
    const parsed = chatRequestParser(userInput);
    parsed.stream ??= true;
    return parsed;
  } catch (e) {
    if (e instanceof Error) {
      console.log("Invalid ChatRequest:", e.message);
    }
    return undefined;
  }
}

// Invalid ChatRequest: in messages: Messages should not be empty
chatRequest(
  JSON.stringify({
    model: "model",
    stream: true,
    messages: [],
  }),
);
