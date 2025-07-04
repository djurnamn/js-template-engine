import type { RenderContext, PipelineStep, PipelineStepResult } from '../../types/renderContext';
import { ExtensionManager } from '../../utils/ExtensionManager';

/**
 * Calls afterRender hooks
 */
export class AfterRenderStep implements PipelineStep {
  name = 'AfterRender';
  private constructorExtensions: any[];

  constructor(extensions: any[]) {
    this.constructorExtensions = extensions;
  }

  async execute(context: RenderContext): Promise<PipelineStepResult> {
    try {
      const { processedNodes, options, isRoot } = context;
      
      if (!isRoot) {
        return {
          success: true,
          context
        };
      }

      // Call afterRender hooks
      const extensionManager = new ExtensionManager(options.extensions || []);
      extensionManager.callAfterRender(processedNodes || [], options);

      return {
        success: true,
        context
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        context
      };
    }
  }
} 