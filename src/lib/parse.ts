/**
 * The result of parsing something that crossed a boundary.
 *
 * CLAUDE.md: "Validate anything crossing a boundary before using it: form
 * input, API responses, and LLM output. Parse it into a known shape and fail
 * loudly when it does not match." This is the shape those parsers return —
 * either a value of the type they promise, or the reason they will not promise
 * it. There is no third case where a caller gets a plausible-looking default.
 */

export type ParseResult<T> =
  | { readonly kind: "ok"; readonly value: T }
  | { readonly kind: "invalid"; readonly error: string };

export function ok<T>(value: T): ParseResult<T> {
  return { kind: "ok", value };
}

export function invalid<T>(error: string): ParseResult<T> {
  return { kind: "invalid", error };
}
