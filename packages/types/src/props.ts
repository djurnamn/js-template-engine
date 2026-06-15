import type { JsonValue } from './json-value';

/**
 * A component prop definition.
 *
 * Rendered as a generated props interface with destructured defaults in
 * React, `defineProps` in Vue, `export let` declarations in Svelte, and
 * plain consts in the HTML-mode script block.
 *
 * @example
 * const variant: PropDefinition = {
 *   type: "'primary' | 'secondary'",
 *   default: 'primary',
 * };
 */
export interface PropDefinition {
  /** A TypeScript type expression: `"'primary' | 'secondary'"`, `'boolean'`. */
  type: string;
  /** Whether the prop is required. Defaults to `false`. */
  required?: boolean;
  /** A JSON-serializable default value. */
  default?: JsonValue;
}
