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
 * single-quoted string literals. Used for `withDefaults` prop defaults.
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
 * literal, so `{` is escaped to `&#123;` - otherwise a `{{ }}` sequence in
 * the text would be parsed as a Vue interpolation.
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
 * Prepares a binding expression for a double-quoted directive value
 * (`:src="..."`, `v-if="..."`, `@click="..."`). Expressions are emitted
 * verbatim - Vue tooling keeps `&&`, `>`, and `<` raw - with only the
 * quote character escaped so it cannot terminate the attribute.
 */
export function bindingExpression(expression: string): string {
  return expression.trim().replace(/"/g, '&quot;');
}
