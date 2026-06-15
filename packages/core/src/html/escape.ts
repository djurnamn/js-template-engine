/** Escapes text content for HTML output. */
export function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Escapes a double-quoted HTML attribute value. */
export function escapeAttributeValue(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;');
}
