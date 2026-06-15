import type { ElementNode, TemplateNode } from '@js-template-engine/types';

/**
 * Prop names the passthrough surface contract reserves. A component with a
 * passthrough node may not declare a prop — or a slot whose name resolves to
 * a prop — under any of these: `class`/`className` and `style` are the
 * consumer-supplied values the surface merges, and `ref`/`element` are the
 * DOM-handle names the framework targets generate (React's ref-as-prop,
 * Svelte's bindable `element`). Reserved on every target so a kit built for
 * all of them stays coherent.
 */
export const RESERVED_PASSTHROUGH_PROPS: readonly string[] = [
  'class',
  'className',
  'style',
  'ref',
  'element',
];

/**
 * Returns the component's passthrough surface root — the single top-level
 * element a consumer's props/attributes spread onto — or `undefined` when no
 * element sets `passthrough`.
 *
 * Returns the node only when it is well-formed per the surface contract: the
 * sole rendered (non-comment) top-level child, set on exactly one element in
 * the tree, with an intrinsic HTML tag. A malformed passthrough (a second
 * flagged node, a nested or non-single root, a component-reference tag) is a
 * validation error caught upstream by `validateTemplate`, so renderers can
 * treat a returned node as authoritative.
 */
export function passthroughNodeOf(
  children: readonly TemplateNode[]
): ElementNode | undefined {
  const rendered = children.filter((node) => node.type !== 'comment');
  if (rendered.length !== 1) {
    return undefined;
  }
  const root = rendered[0];
  if (root.type === 'element' && root.passthrough === true) {
    return root;
  }
  return undefined;
}
