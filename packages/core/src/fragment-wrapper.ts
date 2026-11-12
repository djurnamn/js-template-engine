import type { ElementNode, TemplateNode } from '@js-template-engine/types';

/**
 * The element a fragment renders around its children in a framework
 * target: a fragment whose `extensions.<extensionKey>` names a `tag` renders
 * that element or component there, with the block's `attributes` and
 * `events`, and its children alone everywhere else. The element is the
 * fragment's tag override applied to an element with no attributes of its
 * own, so the target renders it exactly as it renders an element with a
 * `tag` override - a conditional's or loop's lone wrapper carrying the
 * directive or key as a lone element does. Its children are the fragment's,
 * the same node objects. The element is built on each call from the
 * fragment as it stands, so a template changed between renders renders its
 * current wrapper.
 *
 * @param node - The node to test.
 * @param extensionKey - The target extension's name (`react`, `vue`, ...).
 * @returns The wrapper element, or `undefined` for any other node and for a
 *   fragment with no tag override in that target.
 * @example
 * fragmentWrapper(
 *   { type: 'fragment', extensions: { react: { tag: 'Portal' } }, children: [] },
 *   'react'
 * );
 * // → { type: 'element', tag: 'Portal', extensions: { react: { tag: 'Portal' } }, children: [] }
 */
export function fragmentWrapper(
  node: TemplateNode,
  extensionKey: string
): ElementNode | undefined {
  if (node.type !== 'fragment') {
    return undefined;
  }
  const override = node.extensions?.[extensionKey];
  if (typeof override?.tag !== 'string') {
    return undefined;
  }
  return {
    type: 'element',
    tag: override.tag,
    extensions: { [extensionKey]: override },
    children: node.children,
  };
}
