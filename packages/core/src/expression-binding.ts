import type { Attributes, ExpressionBinding } from '@js-template-engine/types';

/**
 * Returns true when an attribute value is a dynamic `{ $expression: ... }`
 * binding rather than a static value.
 */
export function isExpressionBinding(value: unknown): value is ExpressionBinding {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    '$expression' in value
  );
}

/**
 * Returns the whole-object style expression carried by a style value - the
 * string value of its top-level `$expression` key - or `undefined` when there
 * is none. Unlike {@link isExpressionBinding}, this isolates the expression so
 * a style object may carry it *alongside* static properties, includes, nested
 * selectors, and per-property `$expression` values: callers emit the returned
 * expression through the target's dynamic style mechanism and process the
 * remaining keys normally.
 */
export function wholeStyleExpression(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  const expression = (value as { $expression?: unknown }).$expression;
  return typeof expression === 'string' ? expression : undefined;
}

/**
 * Returns the spread expressions carried by a node's `$spread` attribute
 * directive - one entry per spread object, in authored order - or an empty
 * array when the node declares no spread. The `$spread` value is an
 * {@link ExpressionBinding} or an array of them; each names a runtime object
 * whose own enumerable properties are spread onto the element (or composed
 * component) ahead of the authored attributes, which override per key. Callers
 * emit the returned expressions through the target's spread syntax (React
 * `{...x}`, Vue `v-bind="x"`, Svelte `{...x}`); HTML mode ignores them.
 */
export function nodeSpreads(attributes: Attributes | undefined): string[] {
  const spread = attributes?.$spread;
  if (spread === undefined) {
    return [];
  }
  const entries = Array.isArray(spread) ? spread : [spread];
  return entries
    .filter(isExpressionBinding)
    .map((entry) => entry.$expression.trim());
}
