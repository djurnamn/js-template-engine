import { isExpressionBinding, staticTagOf } from '@js-template-engine/core';
import type { ElementNode } from '@js-template-engine/types';

import type { ReactNodeOverrides } from './overrides';

/** The name of the generated ref-composition helper. */
export const COMPOSE_REFS_NAME = 'composeRefs';

/**
 * The generated ref-composition helper: returns one ref callback handing the
 * node to every supplied ref, a callback ref or a ref object, skipping those
 * that are absent. Its cleanup runs each callback's own cleanup, or hands the
 * callback `null`, and clears each ref object, so every ref is released when
 * the node is.
 *
 * The composed callback is memoized by the identity of the refs it composes,
 * in nested `WeakMap`s (a sentinel stands for an absent ref), so it stays the
 * same function across renders whenever the refs do. A new callback each
 * render would make React detach and re-attach every ref on every render: a
 * consumer callback ref that stores state would re-render the consumer each
 * time, and loop when it stores a new object. No hook is used, so the helper
 * works inside loops and branches.
 *
 * Used where a node spreads `rest`, which carries the consumer's `ref`, or on
 * a passthrough root forwarding it, and the node also takes a ref of the
 * component's own: a `ref` after the spread would otherwise replace the
 * consumer's.
 *
 * @returns The helper's declaration, typed with React's `Ref` and
 *   `RefCallback`.
 */
export function composeRefsDeclaration(): string {
  return [
    'type ComposedRefCache = WeakMap<object, ComposedRefCache | RefCallback<never>>;',
    '',
    'const composedRefCache: ComposedRefCache = new WeakMap();',
    'const absentRef = {};',
    'const composedRef = {};',
    '',
    `function ${COMPOSE_REFS_NAME}<T>(...refs: (Ref<T> | undefined)[]): RefCallback<T> {`,
    '  let level = composedRefCache;',
    '  for (const ref of refs) {',
    '    const key = ref ?? absentRef;',
    '    let next = level.get(key) as ComposedRefCache | undefined;',
    '    if (next === undefined) {',
    '      next = new WeakMap();',
    '      level.set(key, next);',
    '    }',
    '    level = next;',
    '  }',
    '  const cached = level.get(composedRef) as RefCallback<T> | undefined;',
    '  if (cached !== undefined) {',
    '    return cached;',
    '  }',
    '  const composed: RefCallback<T> = (node) => {',
    '    const cleanups = refs.map((ref) => {',
    "      if (typeof ref === 'function') {",
    '        const cleanup = ref(node);',
    "        return typeof cleanup === 'function' ? cleanup : () => ref(null);",
    '      }',
    '      if (ref) {',
    '        ref.current = node;',
    '        return () => {',
    '          ref.current = null;',
    '        };',
    '      }',
    '      return undefined;',
    '    });',
    '    return () => {',
    '      for (const cleanup of cleanups) {',
    '        cleanup?.();',
    '      }',
    '    };',
    '  };',
    '  level.set(composedRef, composed as RefCallback<never>);',
    '  return composed;',
    '}',
  ].join('\n');
}

/** Whether an `indeterminate` value is one the ref sets: bound, or `true`. */
export function setsThroughRef(value: unknown): boolean {
  return isExpressionBinding(value) || value === true;
}

/**
 * The element tag a node renders in React: its React tag override's, else
 * its own, a dynamic tag's `default` included.
 */
export function reactTag(
  node: ElementNode,
  override: ReactNodeOverrides | undefined
): string {
  return override?.tag ?? staticTagOf(node.tag);
}

/**
 * Whether React sets an element's `indeterminate` through the generated
 * ref: it renders as an `<input>` and sets one, bound or a static `true`,
 * in its own attributes (its React override's winning) or a conditional
 * entry's.
 *
 * @param node - The element node.
 * @returns `true` for an input binding `indeterminate`.
 */
export function setsIndeterminateThroughRef(node: ElementNode): boolean {
  const override = node.extensions?.react as ReactNodeOverrides | undefined;
  if (reactTag(node, override) !== 'input') {
    return false;
  }
  const overridden =
    typeof override?.attributes === 'object' &&
    override.attributes !== null &&
    'indeterminate' in override.attributes;
  const own = overridden
    ? override!.attributes!.indeterminate
    : node.attributes?.indeterminate;
  const entries = Array.isArray(node.conditionalAttributes)
    ? node.conditionalAttributes
    : [];
  return (
    setsThroughRef(own) ||
    entries.some((entry) => setsThroughRef(entry?.attributes?.indeterminate))
  );
}

/** The name of the generated `indeterminate` ref helper. */
export const INDETERMINATE_REF_NAME = 'indeterminateRef';

/** The name of the two ref callbacks {@link INDETERMINATE_REF_NAME} picks from. */
export const INDETERMINATE_REFS_NAME = 'indeterminateRefs';

/**
 * The generated `indeterminate` ref helper: returns the ref callback that
 * sets an input's `indeterminate` property to the value's truth, one of two
 * module-level callbacks. React has no `indeterminate` prop, since the
 * property has no attribute, so an `<input>` binding it takes this ref.
 *
 * The callback stays the same function while the value's truth does, so
 * React calls it only when the input mounts and when the value changes,
 * and the property is written only then: a click that clears a mixed box
 * stays cleared across renders that pass the same value, as a property
 * bound in Vue or Svelte does. No hook is used, so the helper works inside
 * loops and branches.
 *
 * @returns The helper's declaration, typed with React's `RefCallback`.
 */
export function indeterminateRefDeclaration(): string {
  return [
    `const ${INDETERMINATE_REFS_NAME}: readonly [RefCallback<Element>, RefCallback<Element>] = [`,
    '  (element) => {',
    "    if (element && 'indeterminate' in element) element.indeterminate = false;",
    '  },',
    '  (element) => {',
    "    if (element && 'indeterminate' in element) element.indeterminate = true;",
    '  },',
    '];',
    '',
    `function ${INDETERMINATE_REF_NAME}(indeterminate: unknown): RefCallback<Element> {`,
    `  return ${INDETERMINATE_REFS_NAME}[indeterminate ? 1 : 0];`,
    '}',
  ].join('\n');
}
