import type {
  ElementNode,
  NestedStyleObject,
  TemplateNode,
} from '@js-template-engine/types';

import { isExpressionBinding } from '../expression-binding';
import { normalizeClassList } from '../normalize';
import { visitElements } from '../traverse';

/** The attribute marking elements that need a selector but have no static class. */
export const GENERATED_NODE_ATTRIBUTE = 'data-jte-node';

/** How stylesheet rules address one element. */
export interface ElementTarget {
  /**
   * The selector used in generated CSS: `'.button'`, or
   * `'[data-jte-node="Button-0"]'` for marked elements.
   */
  selector: string;
  /**
   * Set when the engine marked the element because it needed a selector but
   * had no static class: a zero-based counter over the component's marked
   * elements in document order.
   */
  generatedNodeIndex?: number;
  /**
   * The marker attribute's value, set together with `generatedNodeIndex`:
   * the component's name and the counter, `'Button-0'`. The markup renderer
   * emits it verbatim and the selector matches it, so components sharing a
   * page never match each other's elements.
   */
  generatedNodeValue?: string;
}

/**
 * Returns the `data-jte-node` value for a component's marked element: the
 * component's name, a hyphen and the element's zero-based counter. Any
 * character in the name other than an ASCII letter, digit, `_` or `-` is
 * written as its code point in hexadecimal between underscores (a space
 * reads `_20_`), so the value is safe both as an attribute value and inside
 * a quoted attribute selector, and distinct names stay distinct; an empty
 * name reads `Component`.
 *
 * @param componentName - The component's name: `'StatGrid'`.
 * @param index - The zero-based counter over the component's marked elements.
 * @returns The marker value: `'StatGrid-0'`.
 *
 * @example
 * generatedNodeValue('StatGrid', 0); // 'StatGrid-0'
 */
export function generatedNodeValue(
  componentName: string,
  index: number
): string {
  const name = componentName.replace(
    /[^A-Za-z0-9_-]/gu,
    (character) => `_${(character.codePointAt(0) ?? 0).toString(16)}_`
  );
  return `${name === '' ? 'Component' : name}-${index}`;
}

/** Selector targets per element, keyed by node identity. */
export type TargetPlan = Map<ElementNode, ElementTarget>;

/**
 * Returns true when a style object contains nested selector blocks.
 * Expression-valued properties are runtime values, not selector blocks.
 */
export function hasNestedSelectors(style: NestedStyleObject): boolean {
  return Object.values(style).some(
    (value) =>
      typeof value === 'object' && value !== null && !isExpressionBinding(value)
  );
}

/**
 * Returns true when a style object contains at least one static plain
 * property. Expression-valued properties render through the target's
 * dynamic style mechanism and never enter generated CSS or static
 * `style` attributes.
 */
export function hasPlainProperties(style: NestedStyleObject): boolean {
  return Object.entries(style).some(
    ([key, value]) =>
      key !== '$expression' &&
      (typeof value === 'string' || typeof value === 'number')
  );
}

/**
 * Returns true when a style object carries a top-level Sass include - the
 * `$include` key or an `@include ...` at-rule key. Like a nested selector it
 * must reach a stylesheet - an `@include` cannot live in an inline `style`
 * attribute - so its presence binds the node to a stylesheet even under the
 * `inline` placement. (Under `'css'` output, includes resolve before targeting
 * runs; this binding matters for `'scss'` pass-through.)
 */
export function hasIncludes(style: NestedStyleObject): boolean {
  return Object.keys(style).some(
    (key) => key === '$include' || key.startsWith('@include')
  );
}

/**
 * Returns true when a style object carries `$expression` values on
 * top-level properties.
 */
export function hasExpressionProperties(style: NestedStyleObject): boolean {
  return Object.values(style).some(
    (value) => value !== undefined && isExpressionBinding(value)
  );
}

/**
 * Assigns a selector class to every element that needs one.
 *
 * An element needs a selector when its styles go to a stylesheet (always
 * under the `in-file` and `separate-file` stylesheet placements; only styles
 * with nested selectors or includes under `inline`). The selector prefers the element's first selector-eligible
 * class - its first static class, or with styling extensions applied the
 * first entry in `selectorClasses` (static classes followed by
 * semantic-extension classes; utility classes are never selectors). Only
 * elements without one are marked with a `data-jte-node="<Name>-<n>"`
 * attribute (see {@link generatedNodeValue}) and addressed through an
 * attribute selector - the authored class list is never extended. The
 * component's name in the value keeps markers unique across components
 * whose stylesheets share a page, so a caller rendering more than one
 * component onto a page must pass each one's `componentName`; left out, every
 * component marks as `Component` and their selectors collide.
 *
 * `scriptingStrategy` is deprecated and ignored - no output wires events
 * through selectors - and is removed in 3.0.0.
 *
 * @param children - The component's nodes.
 * @param placement - The stylesheet placement.
 * @param scriptingStrategy - Deprecated and ignored.
 * @param selectorClasses - Per-element selector-eligible classes, once
 * styling extensions have been applied.
 * @param componentName - The component's name, which namespaces its
 * markers. Defaults to `'Component'`.
 * @returns The selector target of every element that needs one.
 */
export function planTargets(
  children: TemplateNode[],
  placement: string,
  scriptingStrategy?: string,
  selectorClasses?: ReadonlyMap<ElementNode, readonly string[]>,
  componentName = 'Component'
): TargetPlan {
  const plan: TargetPlan = new Map();
  let markedCount = 0;

  visitElements(children, (element) => {
    if (!needsSelector(element, placement)) {
      return;
    }
    const eligibleClasses =
      selectorClasses?.get(element) ??
      normalizeClassList(element.attributes?.class);
    if (eligibleClasses.length > 0) {
      plan.set(element, { selector: `.${eligibleClasses[0]}` });
    } else {
      const generatedNodeIndex = markedCount;
      markedCount += 1;
      const value = generatedNodeValue(componentName, generatedNodeIndex);
      plan.set(element, {
        selector: `[${GENERATED_NODE_ATTRIBUTE}="${value}"]`,
        generatedNodeIndex,
        generatedNodeValue: value,
      });
    }
  });

  return plan;
}

function needsSelector(element: ElementNode, placement: string): boolean {
  const style = element.attributes?.style;
  // A whole-object `$expression` does not preclude static / nested / include
  // keys on the same node; the predicates below ignore the `$expression` key,
  // so a mixed node is bound by its stylesheet-bound siblings and a pure
  // whole-object expression (no such siblings) is not.
  if (style === undefined) {
    return false;
  }
  return placement === 'inline'
    ? hasNestedSelectors(style) || hasIncludes(style)
    : hasNestedSelectors(style) ||
        hasPlainProperties(style) ||
        hasIncludes(style);
}
