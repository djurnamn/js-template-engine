import type { RenderContext, PipelineStep, PipelineStepResult } from '../../types/renderContext';
import { ExtensionManager } from '../../utils/ExtensionManager';
import { NodeTraverser } from '../../utils/NodeTraverser';

/**
 * Processes extensions and applies node handlers
 */
export class ExtensionProcessingStep implements PipelineStep {
  name = 'ExtensionProcessing';

  async execute(context: RenderContext): Promise<PipelineStepResult> {
    try {
      const { nodes, options, isRoot, ancestorNodesContext, extensionManager } = context;
      const nodeTraverser = new NodeTraverser({ extensions: options.extensions || [] });
      
      // Call beforeRender hooks for root renders
      if (isRoot) {
        extensionManager.callBeforeRender(nodes, options);
      }

      // For each extension, for each node, call the handler (always on the original node list)
      let processedNodes = nodes;
      if (options.extensions) {
        for (const extension of options.extensions) {
          processedNodes = nodes.map(node =>
            extensionManager.callNodeHandlers(node, ancestorNodesContext)
          );
        }
      }

      // Apply onNodeVisit hooks
      processedNodes = nodeTraverser.traverseTree(processedNodes, ancestorNodesContext);

      // Update context with processed nodes
      const updatedContext: RenderContext = {
        ...context,
        processedNodes
      };

      return {
        success: true,
        context: updatedContext
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        context
      };
    }
  }

  runForNonRoot = true;
} 