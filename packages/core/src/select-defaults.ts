import type {
  AttributeValue,
  ElementNode,
  TemplateNode,
} from '@js-template-engine/types';

import { isExpressionBinding } from './expression-binding';

/** Matches an identifier or a dot-separated member path: `props.plan`. */
const IDENTIFIER_PATH = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/;

interface CollectedOption {
  option: ElementNode;
  /** True when reached through fragments and `optgroup`s only. */
  own: boolean;
}

/**
 * The options a select's `defaultValue` preselects, and how. A select has
 * no default-value property in markup, so its options carry it: when every
 * option is the select's own (directly, in a fragment or an `optgroup`)
 * with a static value and the default is static, the matching option maps
 * to `true`; otherwise each option maps to an expression comparing its
 * value with the default, `entry.id === plan`. An option with its own
 * `selected` or `defaultSelected`, or no known value, is left out. Under
 * `multiple` the value is a list, or a single value, and each option is
 * looked up in it: `[tiers].flat().includes(entry.id)`.
 *
 * @param select - The select element.
 * @param defaultValue - The select's `defaultValue`, or its bound `value`.
 * @param options - `multiple`: whether the select takes several values.
 * @returns Each option to preselect, with its selected value.
 *
 * @example
 * selectedOptions(select, { $expression: 'tier' });
 * // Map { <option value="free"> => { $expression: "'free' === tier" }, ... }
 */
export function selectedOptions(
  select: ElementNode,
  defaultValue: AttributeValue,
  options: { multiple?: boolean } = {}
): Map<ElementNode, AttributeValue> {
  const collected: CollectedOption[] = [];
  collectOptions(select.children ?? [], true, collected);
  const values = collected.map(({ option }) => optionValueOf(option));
  const allStatic =
    !isExpressionBinding(defaultValue) &&
    collected.every(
      ({ own }, index) =>
        own &&
        values[index] !== undefined &&
        !isExpressionBinding(values[index]!)
    );
  const selected = new Map<ElementNode, AttributeValue>();
  collected.forEach(({ option }, index) => {
    const value = values[index];
    const attributes = option.attributes ?? {};
    if (
      value === undefined ||
      attributes.selected !== undefined ||
      attributes.defaultSelected !== undefined
    ) {
      return;
    }
    if (allStatic) {
      if (String(value) === String(defaultValue)) {
        selected.set(option, true);
      }
      return;
    }
    selected.set(option, {
      $expression:
        options.multiple === true
          ? `[${operand(defaultValue)}].flat().includes(${operand(value)})`
          : `${operand(value)} === ${operand(defaultValue)}`,
    });
  });
  return selected;
}

/** A value as an operand: a parenthesized expression, a static literal. */
function operand(value: AttributeValue): string {
  if (isExpressionBinding(value)) {
    const expression = value.$expression.trim();
    return IDENTIFIER_PATH.test(expression) ? expression : `(${expression})`;
  }
  if (typeof value === 'string') {
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  }
  return String(value);
}

function collectOptions(
  nodes: readonly TemplateNode[],
  own: boolean,
  options: CollectedOption[]
): void {
  for (const node of nodes) {
    if (node.type === 'fragment') {
      collectOptions(node.children, own, options);
    } else if (node.type === 'element') {
      if (typeof node.tag !== 'string' || !/^[a-z]/.test(node.tag)) {
        continue;
      }
      if (node.tag === 'option') {
        options.push({ option: node, own });
      } else if (node.tag === 'optgroup') {
        collectOptions(node.children ?? [], own, options);
      } else if (node.tag !== 'select') {
        collectOptions(node.children ?? [], false, options);
      }
    } else if (node.type === 'iteration') {
      collectOptions(node.children, false, options);
    } else if (node.type === 'conditional') {
      for (const branch of node.conditions) {
        collectOptions(branch.children, false, options);
      }
    } else if (node.type === 'slot') {
      collectOptions(node.fallback ?? [], false, options);
    }
  }
}

/** An option's value: its `value` attribute, or else its text. */
function optionValueOf(option: ElementNode): AttributeValue | undefined {
  const value = option.attributes?.value as AttributeValue | undefined;
  if (value !== undefined) {
    return value;
  }
  const children = option.children ?? [];
  if (children.length === 1 && children[0].type === 'text') {
    const text = children[0];
    return text.content !== undefined
      ? text.content.trim()
      : { $expression: String(text.expression).trim() };
  }
  return undefined;
}
