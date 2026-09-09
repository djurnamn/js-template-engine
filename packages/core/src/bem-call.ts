/**
 * One conditionally-applied BEM modifier in a runtime `bem(...)` call: the
 * modifier name and the JavaScript condition gating it. The condition is
 * authored expression text - a framework target rewrites any named-slot
 * reference inside it to its own presence form before formatting the call.
 */
export interface BemConditionalModifier {
  /** The modifier name (without the block/element base or separator). */
  modifier: string;
  /** The JavaScript condition gating the modifier. */
  condition: string;
}

/**
 * Formats a runtime `bem(...)` call from its parts. The element name is the
 * first argument (`undefined` when block-level with conditional/multiple
 * modifiers, omitted when block-level with none); the modifiers form the
 * second argument - a record when any modifier is conditional (static entries
 * keyed to `true`, conditional entries to their condition), a bare string or
 * array for static-only modifiers, or absent when there are none.
 *
 * Conditions are emitted verbatim: a caller that needs named-slot references
 * resolved (`!icon` -> `!$$slots.icon`) rewrites the `condition` of each
 * {@link BemConditionalModifier} before calling this.
 *
 * @param elementName - The BEM element name, or `undefined` for block level.
 * @param staticModifiers - Unconditional modifier names.
 * @param conditionalModifiers - Condition-gated modifiers, in order.
 * @returns The `bem(...)` call expression text.
 *
 * @example
 * formatBemCall(undefined, [], [{ modifier: 'text-only', condition: '!$$slots.icon' }])
 * // => "bem(undefined, { 'text-only': !$$slots.icon })"
 */
export function formatBemCall(
  elementName: string | undefined,
  staticModifiers: readonly string[],
  conditionalModifiers: readonly BemConditionalModifier[]
): string {
  const modifierArgument = buildModifierArgument(
    staticModifiers,
    conditionalModifiers
  );
  if (modifierArgument === undefined) {
    return elementName === undefined ? 'bem()' : `bem(${quote(elementName)})`;
  }
  const elementArgument =
    elementName === undefined ? 'undefined' : quote(elementName);
  return `bem(${elementArgument}, ${modifierArgument})`;
}

function buildModifierArgument(
  staticModifiers: readonly string[],
  conditionalModifiers: readonly BemConditionalModifier[]
): string | undefined {
  if (conditionalModifiers.length > 0) {
    const entries = [
      ...staticModifiers.map((modifier) => `${objectKey(modifier)}: true`),
      ...conditionalModifiers.map(
        ({ modifier, condition }) => `${objectKey(modifier)}: ${condition}`
      ),
    ];
    return `{ ${entries.join(', ')} }`;
  }
  if (staticModifiers.length === 0) {
    return undefined;
  }
  if (staticModifiers.length === 1) {
    return quote(staticModifiers[0]);
  }
  return `[${staticModifiers.map(quote).join(', ')}]`;
}

/** Single-quotes a string literal for emission. */
function quote(value: string): string {
  return `'${value}'`;
}

/** Returns a record key: a bare identifier where valid, otherwise quoted. */
function objectKey(value: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value) ? value : quote(value);
}
