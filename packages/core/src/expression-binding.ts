import type { ExpressionBinding } from '@js-template-engine/types';

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
