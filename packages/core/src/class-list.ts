import type { ConditionalAttributes } from '@js-template-engine/types';

import { normalizeClassList } from './normalize';

/**
 * A run of condition-gated classes that share the same set of conditions:
 * the classes apply whenever any of `conditions` holds.
 */
export interface ConditionalClassGroup {
  /** The distinct conditions gating the classes, in entry order. */
  conditions: string[];
  /** The classes, in first-occurrence order. */
  classes: string[];
}

/**
 * Groups the classes of a node's `conditionalAttributes` entries for
 * emission. A conditional class is dropped when an unconditional (static or
 * extension) class already carries it. A class repeated across entries is
 * kept once, at its first occurrence, and gated on every entry that declares
 * it, so it applies whenever any of those conditions holds. Consecutive
 * classes gated on the same conditions share a group, so entries without
 * repeated classes or conditions come back one group per entry, in array
 * order.
 *
 * @param conditionals - The node's conditional attribute entries, in order.
 * @param unconditionalClasses - The classes the node carries unconditionally.
 * @returns The groups, in first-occurrence order of their classes.
 * @example
 * groupConditionalClasses(
 *   [
 *     { condition: "variant === 'a'", attributes: { class: ['shared', 'a'] } },
 *     { condition: "variant === 'b'", attributes: { class: ['shared', 'b'] } },
 *   ],
 *   []
 * );
 * // => [
 * //   { conditions: ["variant === 'a'", "variant === 'b'"], classes: ['shared'] },
 * //   { conditions: ["variant === 'a'"], classes: ['a'] },
 * //   { conditions: ["variant === 'b'"], classes: ['b'] },
 * // ]
 */
export function groupConditionalClasses(
  conditionals: readonly ConditionalAttributes[],
  unconditionalClasses: Iterable<string>
): ConditionalClassGroup[] {
  const excluded = new Set(unconditionalClasses);
  const entriesByClass = new Map<string, number[]>();
  conditionals.forEach((conditional, index) => {
    for (const className of normalizeClassList(conditional.attributes.class)) {
      if (excluded.has(className)) {
        continue;
      }
      const entries = entriesByClass.get(className);
      if (entries === undefined) {
        entriesByClass.set(className, [index]);
      } else {
        entries.push(index);
      }
    }
  });

  const groups: Array<ConditionalClassGroup & { key: string }> = [];
  for (const [className, entries] of entriesByClass) {
    const conditions: string[] = [];
    for (const index of entries) {
      const condition = conditionals[index].condition.trim();
      if (!conditions.includes(condition)) {
        conditions.push(condition);
      }
    }
    // Classes gated on the same conditions share a group, whichever entries
    // declared them.
    const key = conditions.join('\u0000');
    const last = groups[groups.length - 1];
    if (last !== undefined && last.key === key) {
      last.classes.push(className);
      continue;
    }
    groups.push({ key, conditions, classes: [className] });
  }
  return groups.map(({ conditions, classes }) => ({ conditions, classes }));
}

/**
 * A node's `conditionalAttributes` entries without their `class`: what a
 * target renders when its override removes the node's class (`class: null`),
 * which takes the condition-gated classes with the static ones and the
 * styling extensions', while an entry's other attributes stay under their
 * condition. Entries that set no class come back as they are.
 *
 * @param conditionals - The node's conditional attribute entries, in order.
 * @returns The entries with no `class` key.
 * @example
 * withoutConditionalClasses([
 *   { condition: 'open', attributes: { class: 'box--open', 'aria-expanded': 'true' } },
 * ]);
 * // => [{ condition: 'open', attributes: { 'aria-expanded': 'true' } }]
 */
export function withoutConditionalClasses(
  conditionals: readonly ConditionalAttributes[]
): ConditionalAttributes[] {
  return conditionals.map((conditional) => {
    if (!('class' in conditional.attributes)) {
      return conditional;
    }
    const { class: _removed, ...attributes } = conditional.attributes;
    return { ...conditional, attributes };
  });
}

/**
 * Joins a group's conditions into one expression that holds whenever any of
 * them does, safe to use as the test of a generated `?:`, an object value
 * or an array element. Several conditions are each parenthesized and joined
 * with `||`; a single one is parenthesized only when its top level carries
 * a `?:`, a comma, an arrow function or an assignment, which would
 * otherwise bind looser than the surrounding code.
 *
 * @param conditions - The conditions, at least one.
 * @returns The joined condition expression.
 * @example
 * joinConditions(['isOpen']); // 'isOpen'
 * joinConditions(['a ? b : c']); // '(a ? b : c)'
 * joinConditions(["v === 'a'", "v === 'b'"]); // "(v === 'a') || (v === 'b')"
 */
export function joinConditions(conditions: readonly string[]): string {
  if (conditions.length === 1) {
    const condition = conditions[0].trim();
    return bindsLooserThanTernaryTest(condition) ? `(${condition})` : condition;
  }
  return conditions.map((condition) => `(${condition.trim()})`).join(' || ');
}

/**
 * True when the expression's top level (outside nested brackets and string
 * or template literals) carries a ternary `?`, a comma, an arrow `=>` or an
 * assignment - the operators that bind looser than a `?:` test. `?.`, `??`
 * and the comparison operators bind tighter and do not count.
 */
function bindsLooserThanTernaryTest(expression: string): boolean {
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
      const next = expression[i + 1];
      if (char === '?') {
        if (next === '.' || next === '?') {
          i += 1; // `?.` optional chaining or `??` nullish
        } else {
          return true; // ternary
        }
      } else if (char === ',') {
        return true;
      } else if (char === '=') {
        const previous = expression[i - 1];
        if (next === '>') {
          return true; // arrow
        }
        if (next === '=') {
          i += next === '=' && expression[i + 2] === '=' ? 2 : 1; // `==`, `===`
          continue;
        }
        if (
          previous !== '=' &&
          previous !== '!' &&
          previous !== '<' &&
          previous !== '>'
        ) {
          return true; // `=` or a compound assignment such as `+=`
        }
        if (
          (previous === '<' || previous === '>') &&
          expression[i - 2] === previous
        ) {
          return true; // `<<=`, `>>=`
        }
      }
    }
  }
  return false;
}

/**
 * True when a class `$expression` is a plain reference - an identifier or a
 * member chain such as `className` or `props.tone`. Reading a reference has
 * no side effects and can never be an always-truthy literal, so a target may
 * guard it by repeating it; any other expression is evaluated exactly once.
 *
 * @param expression - The class expression source.
 * @returns Whether the expression is a plain reference.
 */
export function isReferenceExpression(expression: string): boolean {
  return /^[A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)*$/.test(expression.trim());
}

/**
 * Picks the quote that delimits a class attribute value without escaping:
 * a double quote, unless the value carries one and no single quote.
 *
 * @param value - The class attribute value.
 * @returns The delimiting quote character.
 */
export function classAttributeQuote(value: string): '"' | "'" {
  return value.includes('"') && !value.includes("'") ? "'" : '"';
}

/**
 * Escapes a class attribute value as little as markup requires, so class
 * names stay verbatim in the source a utility scanner reads: only an `&`
 * that would begin a character reference, and the delimiting quote, are
 * written as entities. `<`, `>` and every other `&` are legal inside a
 * quoted attribute value and are left as they are.
 *
 * @param value - The class attribute value.
 * @param quote - The quote delimiting the value.
 * @returns The escaped value, without delimiters.
 * @example
 * escapeClassAttributeValue("[&_svg:not([class*='size-'])]:size-4", '"');
 * // => "[&_svg:not([class*='size-'])]:size-4"
 */
export function escapeClassAttributeValue(
  value: string,
  quote: '"' | "'" = '"'
): string {
  const escaped = value.replace(/&(?=[A-Za-z0-9#])/g, '&amp;');
  return quote === '"'
    ? escaped.replace(/"/g, '&quot;')
    : escaped.replace(/'/g, '&#39;');
}

/**
 * A class attribute value with its delimiters: the quote that needs no
 * escaping (see {@link classAttributeQuote}) around the minimally escaped
 * value (see {@link escapeClassAttributeValue}).
 *
 * @param value - The class attribute value.
 * @returns The quoted value, e.g. `"btn [&_svg]:size-4"`.
 */
export function quoteClassAttributeValue(value: string): string {
  const quote = classAttributeQuote(value);
  return `${quote}${escapeClassAttributeValue(value, quote)}${quote}`;
}

/**
 * Serializes class names as a JavaScript string literal whose delimiter
 * needs no escaping, so the names stay verbatim in the source: a single
 * quote, else a double quote (when `allowDoubleQuote`; not inside a
 * double-quoted attribute), else a template literal. Only when every
 * delimiter occurs in the text, or the text carries a backslash or line
 * break, is the single-quoted form escaped.
 *
 * @param text - The class names.
 * @param options - `allowDoubleQuote` (default `true`) permits the
 *   double-quoted form.
 * @returns The string literal source.
 * @example
 * classStringLiteral("[&_svg:not([class*='size-'])]:size-4");
 * // => "\"[&_svg:not([class*='size-'])]:size-4\""
 */
export function classStringLiteral(
  text: string,
  options: { allowDoubleQuote?: boolean } = {}
): string {
  const allowDoubleQuote = options.allowDoubleQuote ?? true;
  if (!/[\\\n\r]/.test(text)) {
    if (!text.includes("'")) {
      return `'${text}'`;
    }
    if (allowDoubleQuote && !text.includes('"')) {
      return `"${text}"`;
    }
    if (!text.includes('`') && !text.includes('${')) {
      return `\`${text}\``;
    }
  }
  const escaped = text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
  return `'${escaped}'`;
}
