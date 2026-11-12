import type { AttributeOverrides, Attributes } from '@js-template-engine/types';

/**
 * The attributes an element renders in a scripted target: its own, with the
 * target's `attributes` override merged in per key, the override winning. A
 * key the override sets to `null` removes the element's attribute of that
 * name in that target; an `undefined` value leaves nothing either.
 *
 * @param own - The element's own attributes.
 * @param override - The `attributes` of the target's node override, if any.
 * @returns The merged attributes, without the removed keys.
 *
 * @example
 * mergeAttributeOverride(
 *   { type: 'checkbox', indeterminate: { $expression: 'mixed' } },
 *   { indeterminate: null }
 * );
 * // → { type: 'checkbox' }
 */
export function mergeAttributeOverride(
  own: Attributes | undefined,
  override: AttributeOverrides | undefined
): Attributes {
  const merged: Record<string, unknown> = { ...own, ...override };
  for (const [name, value] of Object.entries(merged)) {
    if (value === null || value === undefined) {
      delete merged[name];
    }
  }
  return merged as Attributes;
}
