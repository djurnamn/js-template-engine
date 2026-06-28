import type { DynamicTag, ElementNode, TemplateNode } from '@js-template-engine/types';

/**
 * True when an element's `tag` is a dynamic tag (resolved from a runtime
 * expression) rather than a literal tag name.
 */
export function isDynamicTag(tag: ElementNode['tag']): tag is DynamicTag {
  return typeof tag === 'object' && tag !== null;
}

/**
 * The static tag a node resolves to for non-runtime purposes - the literal
 * tag itself, or a dynamic tag's `default`. It is the basis for the HTML-mode
 * preview, the void/children validation, and the passthrough typed prop
 * surface; the runtime tag (the expression) may differ.
 */
export function staticTagOf(tag: ElementNode['tag']): string {
  return isDynamicTag(tag) ? tag.default : tag;
}

/**
 * Returns the dynamic-tag expression of the component's single root rendered
 * element, or `undefined` when the root is static or absent. Dynamic tags are
 * root-only (validated by `validateTemplate`), so renderers can trust a
 * returned expression belongs to the root element.
 */
export function dynamicRootTagExpressionOf(
  children: readonly TemplateNode[]
): string | undefined {
  const rendered = children.filter((node) => node.type !== 'comment');
  if (rendered.length !== 1) {
    return undefined;
  }
  const root = rendered[0];
  if (root.type === 'element' && isDynamicTag(root.tag)) {
    return root.tag.$expression;
  }
  return undefined;
}
