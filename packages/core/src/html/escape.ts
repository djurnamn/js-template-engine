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

/**
 * Escapes text placed inside an HTML comment: the sequences that would end
 * the comment early or open a nested one (`<!--`, `-->`, `--!>`) have their
 * angle bracket written as an entity. Any other `--`, a BEM modifier's
 * included, is left as it is.
 */
export function escapeComment(value: string): string {
  return value
    .replace(/<!--/g, '&lt;!--')
    .replace(/--!>/g, '--!&gt;')
    .replace(/-->/g, '--&gt;');
}
