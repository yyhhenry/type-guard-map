import { err, type Result } from "@yyhhenry/rust-result";

/**
 * Syntax error builder with stack information.
 * See `leafErr` and `leafExpect` for usage.
 */
export interface ErrBuilder {
  /**
   * Adds a key to the stack information and returns itself (not a new object).
   */
  errIn(key: string | number): ErrBuilder;
  /**
   * Converts the current error message to a SyntaxError object.
   */
  toError(): SyntaxError;
}

/**
 * A helper class that implements the `ErrBuilder` interface.
 */
class ErrBuilderImpl implements ErrBuilder {
  stackRev: (string | number)[];
  constructor(public message: string) {
    this.stackRev = [];
  }
  errIn(key: string | number): ErrBuilder {
    this.stackRev.push(key);
    return this;
  }
  toError(): SyntaxError {
    return new SyntaxError(this.asFullMessage());
  }
  asFullMessage(): string {
    if (this.stackRev.length === 0) {
      return this.message;
    }
    return `in ${this.stackRev.reverse().join(".")}: ${this.message}`;
  }
}
/**
 * Creates a `Result` object representing an error with a given message.
 */
export function leafErr<T>(message: string): Result<T, ErrBuilder> {
  return err(new ErrBuilderImpl(message));
}
/**
 * Creates a `Result` object representing an error with a message indicating that the value is not as expected.
 */
export function leafExpect<T>(
  expectStr: string,
  v: unknown,
): Result<T, ErrBuilder> {
  return leafErr(`Expected ${expectStr}, got ${JSON.stringify(v)}`);
}
