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

/**
 * Visits every node in document order with its node path, descending as
 * {@link visitElements} does: element children (`<path>.children[i]`),
 * projected named-slot content (`<path>.slots.<name>[i]`), fragment and
 * iteration children, conditional branches
 * (`<path>.conditions[j].children[i]`) and slot fallbacks
 * (`<path>.fallback[i]`).
 *
 * @param nodes - The nodes to visit.
 * @param path - The path of the array holding them (`children`, or `''` for
 *   a node-array template).
 * @param visitor - Called with each node and its path.
 */
export function visitNodes(
  nodes: readonly TemplateNode[],
  path: string,
  visitor: (node: TemplateNode, path: string) => void
): void {
  nodes.forEach((node, index) => {
    const nodePath = `${path}[${index}]`;
    visitor(node, nodePath);
    switch (node.type) {
      case 'element':
        if (node.children) {
          visitNodes(node.children, `${nodePath}.children`, visitor);
        }
        for (const named of normalizeNamedSlots(node.slots)) {
          visitNodes(named.content, `${nodePath}.slots.${named.name}`, visitor);
        }
        break;
      case 'fragment':
      case 'iteration':
        visitNodes(node.children, `${nodePath}.children`, visitor);
        break;
      case 'slot':
        if (node.fallback) {
          visitNodes(node.fallback, `${nodePath}.fallback`, visitor);
        }
        break;
      case 'conditional':
        node.conditions.forEach((branch, branchIndex) => {
          visitNodes(
            branch.children,
            `${nodePath}.conditions[${branchIndex}].children`,
            visitor
          );
        });
        break;
      default:
        break;
    }
  });
}
