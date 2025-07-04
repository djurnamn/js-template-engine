/**
 * NodeTraverser
 * Handles recursive traversal and transformation of template node trees,
 * applying extension hooks and supporting ancestor context tracking.
 */
import type { TemplateNode, Extension } from '@js-template-engine/types';

export interface NodeTraverserOptions {
  extensions: Extension[];
  // Future: add more config here (e.g., custom hooks, traversal mode)
}

export class NodeTraverser {
  private extensions: Extension[];

  constructor(options: NodeTraverserOptions) {
    this.extensions = options.extensions;
  }

  /**
   * Recursively traverse and transform a node tree.
   * Calls onNodeVisit for each extension on each node.
   * @param nodes The array of root nodes to traverse.
   * @param ancestors The ancestor node stack (for context-aware extensions).
   * @returns The transformed node tree.
   */
  traverseTree(nodes: TemplateNode[], ancestors: TemplateNode[] = []): TemplateNode[] {
    return nodes.map(node => {
      // Call onNodeVisit hooks for each extension
      for (const ext of this.extensions) {
        if (ext.onNodeVisit) {
          ext.onNodeVisit(node, ancestors);
        }
      }
      const updatedNode = { ...node };
      if ((updatedNode.type === 'element' || updatedNode.type === undefined || updatedNode.type === 'slot') && updatedNode.children) {
        updatedNode.children = this.traverseTree(updatedNode.children, [...ancestors, updatedNode]);
      }
      return updatedNode;
    });
  }
} 