/** A value a component derives from its props, written once in `derived`. */
export interface DerivedValue {
  /** The name the template and the component script read the value by. */
  name: string;
  /** The expression that computes it, as written. */
  expression: string;
}

/**
 * A component's derived values, in declaration order.
 *
 * @param component - The component, or anything carrying its `derived` map.
 * @returns The values; empty when the component declares none.
 * @example
 * derivedValuesOf({ derived: { total: 'items.length' } });
 * // [{ name: 'total', expression: 'items.length' }]
 */
export function derivedValuesOf(component: {
  derived?: Readonly<Record<string, string>>;
}): DerivedValue[] {
  return Object.entries(component.derived ?? {}).map(([name, expression]) => ({
    name,
    expression,
  }));
}

/**
 * A derived value's expression as the body of an arrow function, such as
 * Vue's `computed(() => ...)`: its outer whitespace trimmed and an object
 * literal parenthesized, so it reads as a value rather than a block.
 *
 * @param expression - The expression, as written.
 * @returns The expression, ready to follow `=>`.
 * @example
 * arrowBodyOf('{ total: items.length }'); // '({ total: items.length })'
 */
export function arrowBodyOf(expression: string): string {
  const trimmed = expression.trim();
  return trimmed.startsWith('{') ? `(${trimmed})` : trimmed;
}

/**
 * The comment the html target writes at a component's head for each derived value,
 * saying what the name the markup reads is computed from:
 * `sortedRows = sortRows(rows, sortKey)`. The expression's whitespace runs
 * are collapsed to single spaces, so the comment stays on one line.
 *
 * @param value - The derived value.
 * @returns The comment's text.
 */
export function derivedComment(value: DerivedValue): string {
  return `${value.name} = ${value.expression.trim().replace(/\s+/g, ' ')}`;
}
