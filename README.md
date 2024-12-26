# type-guard-map

A set of utility functions to create type guards and parsers for TypeScript.

You can create type helpers in a functional way, and then use them as type guards, validators, and parsers.

You can infer TypeScript types from the type helpers, or create type helpers from existing types.

With optional fields, you need to define the type explicitly, since `{ a?: T }` is not the same as `{ a: T | undefined }`.

**User friendly error messages** are automatically generated, and you can do additional validation with `cond()`, which allows you to return a custom error message.

## Example

```ts
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
```

## Work with `@vueuse/core`

```ts
import { useDebounceFn, useStorage } from '@vueuse/core';
import { TypeHelper } from '@yyhhenry/type-guard-map';
import cloneDeep from 'lodash/cloneDeep';
import { ref, watch } from 'vue';

export function useCheckedStorage<T>(
  key: string,
  helper: TypeHelper<T>,
  defaultValue: T,
) {
  return useStorage<T>(key, cloneDeep(defaultValue), undefined, {
    serializer: {
      read: (text) => helper.parseWithDefault(text, cloneDeep(defaultValue)),
      write: JSON.stringify,
    },
  });
}

export function useAutoSaving<T>(
  key: string,
  helper: TypeHelper<T>,
  defaultValue: T,
  afterSave?: () => void,
  ms = 1000,
  maxWait = 5000,
) {
  const storage = useCheckedStorage(key, helper, defaultValue);
  const value = ref<T>(storage.value);
  const save = () => {
    storage.value = value.value;
    afterSave?.();
  };
  const debouncedSave = useDebounceFn(save, ms, { maxWait });
  watch(() => value.value, debouncedSave, { deep: true });
  return { value, save };
}
```

## Development

We prefer VSCode with the following settings:

```json
{
  "[typescript]": {
    "editor.defaultFormatter": "denoland.vscode-deno"
  }
}
```
