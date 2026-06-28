import type { ElementNode, TemplateNode } from '@js-template-engine/types';

import { normalizeNamedSlots } from './slots';

/**
 * Visits every element node in document order, descending into element
 * children, fragment children, conditional branches, iteration children,
 * slot fallbacks, and projected named-slot content (`ElementNode.slots`).
 */
export function visitElements(
  nodes: TemplateNode[],
  visitor: (element: ElementNode) => void
): void {
  for (const node of nodes) {
    switch (node.type) {
      case 'element':
        visitor(node);
        if (node.children) {
          visitElements(node.children, visitor);
        }
        for (const named of normalizeNamedSlots(node.slots)) {
          visitElements(named.content, visitor);
        }
        break;
      case 'fragment':
        visitElements(node.children, visitor);
        break;
      case 'slot':
        if (node.fallback) {
          visitElements(node.fallback, visitor);
        }
        break;
      case 'conditional':
        for (const branch of node.conditions) {
          visitElements(branch.children, visitor);
        }
        break;
      case 'iteration':
        visitElements(node.children, visitor);
        break;
      default:
        break;
    }
  }
}
