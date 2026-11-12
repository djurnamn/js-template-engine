/**
 * A `class` `$expression` part embedded in a presence guard -
 * `(<expression> ? ' ' + <expression> : '')`, so that a falsy runtime value
 * contributes nothing to the class string - appears there twice: as the
 * ternary condition and as the right operand of a `' ' +` concatenation.
 * In the concatenation slot `+` binds tighter than
 * every logical operator and the ternary, so an expression whose top level
 * carries `&&`, `||`, `??`, or `?:` reassociates and miscompiles - e.g.
 * `' ' + variant && 'active'` parses as `(' ' + variant) && 'active'` and drops
 * both the separating space and `variant`. Parenthesizing the whole expression
 * before it is embedded keeps it a single operand.
 *
 * A bare identifier, member chain, call, string literal, or `+` concatenation
 * (the common `'Block--' + variant` modifier form) already binds at least as
 * tightly as the surrounding `+`, so it is emitted verbatim, without
 * parentheses.
 *
 * @param expression - The class `$expression` source, as authored.
 * @returns The expression trimmed, wrapped in parentheses only when its top
 *   level carries a logical or ternary operator.
 * @example
 * parenthesizeClassExpression("'Block--' + variant"); // "'Block--' + variant"
 * parenthesizeClassExpression("active ? 'on' : 'off'"); // "(active ? 'on' : 'off')"
 * parenthesizeClassExpression("variant || 'default'"); // "(variant || 'default')"
 *
 * @deprecated No target embeds class expressions this way any
 * more; it is removed in 3.0.0.
 */
export function parenthesizeClassExpression(expression: string): string {
  const trimmed = expression.trim();
  return hasTopLevelLogicalOperator(trimmed) ? `(${trimmed})` : trimmed;
}

/**
 * True when the expression's top level (outside any nested parentheses,
 * brackets, braces, or string/template literals) carries a logical operator
 * (`&&`, `||`, `??`) or a ternary `?:`. Optional chaining (`?.`) binds tightly
 * and does not count.
 *
 * This is the class-concatenation companion to the React extension's
 * `&&`-short-circuit scanner: that one deliberately excludes `&&` (a bare
 * `&&`-chain is a valid short-circuit condition), whereas here `&&` is a
 * hazard in the `' ' +` operand slot, so it is included.
 */
function hasTopLevelLogicalOperator(expression: string): boolean {
  let depth = 0;
  let quote = '';
  for (let i = 0; i < expression.length; i += 1) {
    const char = expression[i];
    if (quote !== '') {
      if (char === '\\') {
        i += 1;
      } else if (char === quote) {
        quote = '';
      }
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
    } else if (char === '(' || char === '[' || char === '{') {
      depth += 1;
    } else if (char === ')' || char === ']' || char === '}') {
      depth -= 1;
    } else if (depth === 0) {
      if (char === '?') {
        if (expression[i + 1] === '.') {
          i += 1; // `?.` optional chaining - binds tightly
        } else {
          return true; // `??` nullish or `?` ternary
        }
      } else if (char === '|' && expression[i + 1] === '|') {
        return true;
      } else if (char === '&' && expression[i + 1] === '&') {
        return true;
      }
    }
  }
  return false;
}
