/**
 * Node-level overrides for the BEM extension, carried under
 * `extensions.bem` on element nodes.
 *
 * The contributed base class is `block`, or `block` joined with `element`
 * by the element separator when `element` is present; each entry in
 * `modifiers` appends one modifier class to the base, in declared order.
 *
 * A node without its own `block` uses the nearest ancestor element's
 * declared `block` — inheritance flows through fragments, conditionals,
 * iterations, and slot fallbacks. A node declaring only `element` does not
 * pass a block on to its descendants.
 *
 * @example
 * const node: ElementNode = {
 *   type: 'element',
 *   tag: 'span',
 *   extensions: {
 *     bem: { element: 'icon', modifiers: ['large'] },
 *   },
 * };
 * // under an ancestor declaring { block: 'button' }
 * // → contributes 'button__icon button__icon--large'
 */
export interface BemNodeOverrides {
  /** The BEM block name. Declared blocks are inherited by descendants. */
  block?: string;
  /** The BEM element name, joined to the effective block. */
  element?: string;
  /** BEM modifier names, each appended to the base class. */
  modifiers?: string[];
}

declare module '@js-template-engine/types' {
  interface ExtensionOverrides {
    bem?: BemNodeOverrides;
  }
}
