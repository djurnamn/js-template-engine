import type { RenderContext, PipelineStep, PipelineStepResult } from '../../types/renderContext';
import { ExtensionManager } from '../../utils/ExtensionManager';
import { NodeTraverser } from '../../utils/NodeTraverser';
import { ExtensionError } from '../errors';

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
        try {
          extensionManager.callBeforeRender(nodes, options);
        } catch (err) {
          throw new ExtensionError('Error in beforeRender hook', { extension: 'unknown', hook: 'beforeRender', error: err });
        }
      }

      // For each extension, for each node, call the handler (always on the original node list)
      let processedNodes = nodes;
      if (options.extensions) {
        for (const extension of options.extensions) {
          processedNodes = nodes.map(node => {
            try {
              return extensionManager.callNodeHandlers(node, ancestorNodesContext);
            } catch (err) {
              throw new ExtensionError('Error in nodeHandler', { extension: extension.key, node, hook: 'nodeHandler', error: err });
            }
          });
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
        error: error instanceof ExtensionError ? error : new ExtensionError(error instanceof Error ? error.message : String(error)),
        context
      };
    }
  }

  runForNonRoot = true;
} 