/**
 * NodeTraverser
 * Handles recursive traversal and transformation of template node trees,
 * applying extension hooks and supporting ancestor context tracking.
 */
import type { TemplateNode, Extension } from '@js-template-engine/types';

/**
 * Options for configuring the NodeTraverser.
 */
export interface NodeTraverserOptions {
  /**
   * The list of extensions to apply during traversal.
   */
  extensions: Extension[];
  // Future: add more config here (e.g., custom hooks, traversal mode)
}

/**
 * Traverses and transforms template node trees, applying extension hooks and tracking ancestor context.
 */
export class NodeTraverser {
  private extensions: Extension[];

  /**
   * Creates a new NodeTraverser instance.
   * @param options - The options for configuring the traverser, including extensions.
   */
  constructor(options: NodeTraverserOptions) {
    this.extensions = options.extensions;
  }

  /**
   * Recursively traverse and transform a node tree.
   * Calls onNodeVisit for each extension on each node.
   *
   * @param nodes - The array of root nodes to traverse.
   * @param ancestors - The ancestor node stack (for context-aware extensions).
   * @returns The transformed node tree.
   */
  traverseTree(
    nodes: TemplateNode[],
    ancestors: TemplateNode[] = []
  ): TemplateNode[] {
    return nodes.map((node) => {
      // Apply nodeHandler transformations first
      let transformedNode = node;
      for (const extension of this.extensions) {
        if (extension.nodeHandler) {
          transformedNode = extension.nodeHandler(transformedNode, ancestors);
        }
      }
      
      // Call onNodeVisit hooks for each extension
      for (const extension of this.extensions) {
        if (extension.onNodeVisit) {
          extension.onNodeVisit(transformedNode, ancestors);
        }
      }
      const updatedNode = { ...transformedNode };
      
      // Handle element nodes and undefined type (treated as element)
      if (
        (updatedNode.type === 'element' || updatedNode.type === undefined) &&
        'children' in updatedNode &&
        updatedNode.children
      ) {
        updatedNode.children = this.traverseTree(updatedNode.children, [
          ...ancestors,
          updatedNode,
        ]);
      }
      
      // Handle slot nodes with fallback content
      if (
        updatedNode.type === 'slot' &&
        'fallback' in updatedNode &&
        updatedNode.fallback
      ) {
        updatedNode.fallback = this.traverseTree(updatedNode.fallback, [
          ...ancestors,
          updatedNode,
        ]);
      }
      
      // Handle fragment nodes
      if (
        updatedNode.type === 'fragment' &&
        'children' in updatedNode &&
        updatedNode.children
      ) {
        updatedNode.children = this.traverseTree(updatedNode.children, [
          ...ancestors,
          updatedNode,
        ]);
      }
      
      // Handle if nodes (both then and else branches)
      if (updatedNode.type === 'if') {
        if ('then' in updatedNode && updatedNode.then) {
          updatedNode.then = this.traverseTree(updatedNode.then, [
            ...ancestors,
            updatedNode,
          ]);
        }
        if ('else' in updatedNode && updatedNode.else) {
          updatedNode.else = this.traverseTree(updatedNode.else, [
            ...ancestors,
            updatedNode,
          ]);
        }
      }
      
      // Handle for nodes
      if (
        updatedNode.type === 'for' &&
        'children' in updatedNode &&
        updatedNode.children
      ) {
        updatedNode.children = this.traverseTree(updatedNode.children, [
          ...ancestors,
          updatedNode,
        ]);
      }
      
      return updatedNode;
    });
  }
}
