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
 * single-quoted string literals.
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
    .map(([key, entryValue]) => {
      return `${objectKey(key)}: ${serializeJavaScriptValue(entryValue)}`;
    });
  return entries.length === 0 ? '{}' : `{ ${entries.join(', ')} }`;
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

function objectKey(key: string): string {
  return IDENTIFIER.test(key) ? key : quoteSingle(key);
}

/** Escapes static text for a JSX child position. */
export function escapeJsxText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;');
}

/** Escapes static text for a double-quoted JSX attribute value. */
export function escapeJsxAttributeValue(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/**
 * Escapes CSS for embedding in a template literal: backslashes, backticks,
 * and `${` sequences.
 */
export function escapeTemplateLiteral(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
}

/** Converts a kebab-case CSS property name to its camelCase form. */
export function toCamelCaseProperty(propertyName: string): string {
  return propertyName.replace(/-([a-z])/g, (_, letter: string) =>
    letter.toUpperCase()
  );
}
