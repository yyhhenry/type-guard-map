# type-guard-map

A set of utility functions to create type guards and parsers for TypeScript.

## Example

```ts
interface ChatRequest {
    model: string;
    /**
     * Default is true.
     */
    stream?: boolean;
    messages: {
        role: 'user' | 'assistant' | 'system';
        content: string;
    }[];
}
const isChatRequest = asTypeGuard<ChatRequest>({
    model: 'string',
    stream: isOptional('boolean'),
    messages: isArrayOf({
        role: isLiteral('user', 'assistant', 'system'),
        content: 'string',
    }),
});
const chatRequestParser = asParser<ChatRequest>(isChatRequest);

function chatRequest(userInput: string) {
    try {
        const parsed = chatRequestParser(userInput);
        parsed.stream ??= true;
        return parsed;
    } catch (e) {
        console.trace(e);
        return undefined;
    }
}
```
