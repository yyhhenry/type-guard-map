import { test } from 'node:test';
import { deepStrictEqual, notDeepStrictEqual, strictEqual } from 'node:assert';
import {
    asTypeGuard,
    isAnyFn,
    isArrayOf,
    checkAtomicType,
    isNonNullableObject,
    isPartialUnknown,
    isTuple,
    isLiteral,
    isUnion,
    isRecordOf,
    isOptional,
    asParser,
    withCondition,
} from './lib.js';

test('example-snippet', () => {
    interface Message {
        role: 'user' | 'assistant' | 'system';
        content: string;
    }
    interface ChatRequest {
        model: string;
        /**
         * Default is true.
         */
        stream?: boolean;
        messages: Message[];
    }
    const isMessages = withCondition(
        isArrayOf<Message>({
            role: isLiteral('user', 'assistant', 'system'),
            content: 'string',
        }),
        (v, err) => {
            if (v.length === 0) {
                err?.('Messages should not be empty');
                return false;
            }
            return true;
        },
    );
    const printWith = (prefix: string) => (msg: string) =>
        console.log(prefix, msg);
    strictEqual(isMessages([{ role: 'user', content: 'hello' }]), true);
    // with role=Peter: in [0]: in role: Expected one of user, assistant, system, got Peter
    strictEqual(
        isMessages(
            [{ role: 'Peter', content: 'hello' }],
            printWith(`with role=Peter:`),
        ),
        false,
    );
    // with content=42: in [0]: in content: Expected string, got number
    strictEqual(
        isMessages(
            [{ role: 'system', content: 42 }],
            printWith(`with content=42:`),
        ),
        false,
    );
    // with empty msgs: Messages should not be empty
    strictEqual(isMessages([], printWith(`with empty msgs:`)), false);

    const chatRequestParser = asParser<ChatRequest>({
        model: 'string',
        stream: isOptional('boolean'),
        messages: isMessages,
    });

    function chatRequest(userInput: string) {
        try {
            const parsed = chatRequestParser(userInput);
            parsed.stream ??= true;
            return parsed;
        } catch (e) {
            if (e instanceof Error) {
                console.log('Invalid ChatRequest:', e.message);
            }
            return undefined;
        }
    }
    deepStrictEqual(
        chatRequest(
            JSON.stringify({
                model: 'model',
                messages: [{ role: 'user', content: 'hello' }],
            }),
        ),
        {
            model: 'model',
            stream: true,
            messages: [{ role: 'user', content: 'hello' }],
        },
    );
    // Invalid ChatRequest: in messages: Messages should not be empty
    strictEqual(
        chatRequest(
            JSON.stringify({
                model: 'model',
                stream: true,
                messages: [],
            }),
        ),
        undefined,
    );
});

test('isNonNullableObject', () => {
    strictEqual(isNonNullableObject({}), true);
    strictEqual(isNonNullableObject([]), true); // Arrays are certainly objects.
    strictEqual(isNonNullableObject(0), false);
    strictEqual(isNonNullableObject(null), false);
});

test('isAnyFn', () => {
    function fn1() {}
    const fn2 = function (hello: string) {
        return hello;
    };
    const fn3 = () => {};
    const fn4 = new Function('a', 'b', 'return a + b');
    strictEqual(isAnyFn(fn1), true);
    strictEqual(isAnyFn(fn2), true);
    strictEqual(isAnyFn(fn3), true);
    strictEqual(isAnyFn(fn4), true);
    strictEqual(isAnyFn({}), false);
    strictEqual(isAnyFn([]), false);
    strictEqual(isAnyFn(0), false);
});

interface Foo {
    foo: string;
    bar: number;
    list: string[];
}
const foo: Foo = {
    foo: 'hello',
    bar: 42,
    list: ['hello', 'world'],
};
const notFoo = {
    name: 'Peter',
    age: 42,
};
const somethingNull = null;
const notObject = 42;

test('isPartialUnknown', () => {
    strictEqual(isPartialUnknown<Foo>(foo), true);
    strictEqual(isPartialUnknown<Foo>(notFoo), true); // Still true, it just act like isNonNullableObject.
    strictEqual(isPartialUnknown<Foo>(somethingNull), false);
    strictEqual(isPartialUnknown<Foo>(notObject), false);

    const isFooManual = (v: unknown): v is Foo => {
        if (!isPartialUnknown<Foo>(v)) {
            return false;
        }
        // let typeName = typeof v.notExist; // This should cause a type error.
        return (
            typeof v.foo === 'string' && // Intellisense should work here.
            typeof v.bar === 'number' && // Renaming should include this line.
            isArrayOf('string')(v.list)
        );
    };
    strictEqual(isFooManual(foo), true);
    strictEqual(isFooManual(notFoo), false);
});

test('checkAtomicType', () => {
    strictEqual(checkAtomicType('hello', 'string'), true);
    strictEqual(checkAtomicType(42, 'number'), true);
    strictEqual(checkAtomicType(true, 'boolean'), true);
    strictEqual(checkAtomicType(BigInt(10), 'bigint'), true);
    strictEqual(checkAtomicType(Symbol('hello'), 'symbol'), true);
    strictEqual(checkAtomicType(undefined, 'undefined'), true);

    strictEqual(checkAtomicType('hello', 'number'), false);
    strictEqual(checkAtomicType(42, 'string'), false);
    strictEqual(checkAtomicType(true, 'number'), false);
    strictEqual(checkAtomicType(BigInt(10), 'boolean'), false);
    strictEqual(checkAtomicType(Symbol('hello'), 'bigint'), false);
    strictEqual(checkAtomicType(undefined, 'symbol'), false);

    const isCharManual = (v: unknown): v is string => {
        if (!checkAtomicType(v, 'string')) {
            return false;
        }
        return v.length === 1; // TS should know that v is string here.
    };
    strictEqual(isCharManual('a'), true);
    strictEqual(isCharManual('ab'), false);
});

test('asTypeGuard', () => {
    // asTypeGuard should internally use checkWithMap, so we don't need to test checkWithMap.
    const isFoo = asTypeGuard<Foo>({
        foo: 'string',
        bar: 'number',
        list: isArrayOf('string'),
    });
    strictEqual(isFoo(foo), true);
    strictEqual(isFoo(notFoo), false);
    strictEqual(isFoo(somethingNull), false);
    strictEqual(isFoo(notObject), false);

    const fooWithEmptyList = {
        foo: 'hello',
        bar: 42,
        list: [],
    };
    const fooWithExtra = {
        foo: 'hello',
        bar: 42,
        list: ['hello', 'world'],
        extra: 'extra',
    };
    const fooWithSomethingWrongInList = {
        foo: 'hello',
        bar: 42,
        list: [42],
    };
    strictEqual(isFoo(fooWithEmptyList), true);
    strictEqual(isFoo(fooWithExtra), true);
    strictEqual(isFoo(fooWithSomethingWrongInList), false);
});

test('isLiteral and isOptional', () => {
    const is42or0 = isLiteral(0, 42);
    strictEqual(is42or0(0), true);
    strictEqual(is42or0(42), true);
    strictEqual(is42or0(1), false);
    strictEqual(is42or0('42'), false);

    const isHello = isLiteral('hello');
    strictEqual(isHello('hello'), true);
    strictEqual(isHello('world'), false);

    const isOptionalString = isOptional('string');
    strictEqual(isOptionalString(undefined), true);
    strictEqual(isOptionalString('hello'), true);
    strictEqual(isOptionalString(42), false);
});

test('isArrayOf and isRecordOf', () => {
    const isArrayOfString = isArrayOf('string');
    strictEqual(isArrayOfString([]), true);
    strictEqual(isArrayOfString(['hello', 'world']), true);
    strictEqual(isArrayOfString(['hello', 42]), false);

    const isRecordOfArrayOfString = isRecordOf(isArrayOf('string'));
    strictEqual(isRecordOfArrayOfString({}), true);
    strictEqual(
        isRecordOfArrayOfString({
            foo: ['hello', 'world'],
            bar: ['hello', 'world'],
        }),
        true,
    );
    strictEqual(isRecordOfArrayOfString({ foo: ['hello', 42] }), false);
});

test('isTuple and isUnion', () => {
    type NamedNumber = [string, number];
    const isNamedNumber = isTuple<NamedNumber>('string', 'number');
    // This should cause a type error.
    // const wrongGuard = isTuple<NamedNumber>(
    //     'string',
    //     'number',
    //     'string',
    // );
    strictEqual(isNamedNumber(['foo', 42]), true);
    strictEqual(isNamedNumber(['foo', '42']), false);

    const isKeyType = isUnion<string, number>('string', 'number');
    const isKeyType2 = isUnion(asTypeGuard('string'), asTypeGuard('number'));

    strictEqual(isKeyType('hello'), true);
    strictEqual(isKeyType(42), true);
    strictEqual(isKeyType(true), false);

    strictEqual(isKeyType2('hello'), true);
    strictEqual(isKeyType2(42), true);
    strictEqual(isKeyType2(true), false);
});

test('asParser', () => {
    const defaultFoo: Foo = {
        foo: '',
        bar: 0,
        list: [],
    };
    const fooParser = asParser<Foo>(
        {
            foo: 'string',
            bar: 'number',
            list: isArrayOf('string'),
        },
        defaultFoo,
    );

    const fooJson = JSON.stringify(foo);
    const parsedFoo = fooParser(fooJson);
    deepStrictEqual(parsedFoo, foo);

    const notFooJson = JSON.stringify(notFoo);
    const parsedNotFoo = fooParser(notFooJson);
    deepStrictEqual(parsedNotFoo, defaultFoo);
    parsedFoo.list.push('hello');
    notDeepStrictEqual(parsedFoo, defaultFoo); // cloned
});
