import type { JsonValue } from '@js-template-engine/types';

/** Serializes text as a single-quoted JavaScript string literal. */
export function quoteSingle(text: string): string {
  const escaped = text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n');
  return `'${escaped}'`;
}

/**
 * Serializes a JSON-compatible value as JavaScript source, using
 * single-quoted string literals. Used for `export let` prop defaults.
 */
export function serializeJavaScriptValue(value: JsonValue): string {
  if (typeof value === 'string') {
    return quoteSingle(value);
  }
  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(serializeJavaScriptValue).join(', ')}]`;
  }
  const entries = Object.entries(value)
    .filter((entry): entry is [string, JsonValue] => entry[1] !== undefined)
    .map(([key, entryValue]) => `${objectKey(key)}: ${serializeJavaScriptValue(entryValue)}`);
  return entries.length === 0 ? '{}' : `{ ${entries.join(', ')} }`;
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

function objectKey(key: string): string {
  return IDENTIFIER.test(key) ? key : quoteSingle(key);
}

/**
 * Escapes static text for an element's text content. Static text is always
 * literal, so `{` is escaped to `&#123;` - otherwise a brace in the text
 * would be parsed as the start of a Svelte expression.
 */
export function escapeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\{/g, '&#123;');
}

/** Escapes a static value for a double-quoted attribute (`alt="..."`). */
export function escapeAttributeValue(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/**
 * Prepares an expression for a Svelte `{ ... }` binding (`src={...}`,
 * `on:click={...}`, `{#if ...}`). Svelte expressions live inside braces
 * rather than quoted attributes, so the expression is emitted verbatim,
 * trimmed of surrounding whitespace.
 */
export function expression(source: string): string {
  return source.trim();
}
