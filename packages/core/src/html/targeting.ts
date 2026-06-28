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

/** How stylesheet rules and script selectors address one element. */
export interface ElementTarget {
  /**
   * The selector used in generated CSS and `querySelector` calls:
   * `'.button'`, or `'[data-jte-node="0"]'` for marked elements.
   */
  selector: string;
  /**
   * Set when the engine marked the element because it needed a selector but
   * had no static class; the markup renderer emits the attribute. The index
   * is a zero-based counter over marked elements in document order - it
   * links markup, stylesheet, and script within one generated output and
   * carries no meaning beyond it.
   */
  generatedNodeIndex?: number;
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
 * `inline` strategy. (Under `'css'` output, includes resolve before targeting
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
 * under the `in-file` and `separate-file` styling strategies; only styles
 * with nested selectors under `inline`), or when its events are wired
 * through `addEventListener` (the `in-file` and `separate-file` scripting
 * strategies). The selector prefers the element's first selector-eligible
 * class - its first static class, or with styling extensions applied the
 * first entry in `selectorClasses` (static classes followed by
 * semantic-extension classes; utility classes are never selectors). Only
 * elements without one are marked with a `data-jte-node="<n>"` attribute
 * and addressed through an attribute selector - the authored class list is
 * never extended.
 */
export function planTargets(
  children: TemplateNode[],
  stylingStrategy: string,
  scriptingStrategy: string,
  selectorClasses?: ReadonlyMap<ElementNode, readonly string[]>
): TargetPlan {
  const plan: TargetPlan = new Map();
  let markedCount = 0;

  visitElements(children, (element) => {
    if (!needsSelector(element, stylingStrategy, scriptingStrategy)) {
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
      plan.set(element, {
        selector: `[${GENERATED_NODE_ATTRIBUTE}="${generatedNodeIndex}"]`,
        generatedNodeIndex,
      });
    }
  });

  return plan;
}

function needsSelector(
  element: ElementNode,
  stylingStrategy: string,
  scriptingStrategy: string
): boolean {
  const style = element.attributes?.style;
  // A whole-object `$expression` does not preclude static / nested / include
  // keys on the same node; the predicates below ignore the `$expression` key,
  // so a mixed node is bound by its stylesheet-bound siblings and a pure
  // whole-object expression (no such siblings) is not.
  if (style !== undefined) {
    const stylesheetBound =
      stylingStrategy === 'inline'
        ? hasNestedSelectors(style) || hasIncludes(style)
        : hasNestedSelectors(style) || hasPlainProperties(style) || hasIncludes(style);
    if (stylesheetBound) {
      return true;
    }
  }
  return (element.events?.length ?? 0) > 0 && scriptingStrategy !== 'inline';
}
