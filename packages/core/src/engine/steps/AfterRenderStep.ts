import type { RenderContext, PipelineStep, PipelineStepResult } from '../../types/renderContext';
import { ExtensionManager } from '../../utils/ExtensionManager';
import { ExtensionError } from '../errors';

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
      try {
        const extensionManager = new ExtensionManager(options.extensions || []);
        extensionManager.callAfterRender(processedNodes || [], options);
      } catch (err) {
        throw new ExtensionError('Error in afterRender hook', { extension: 'unknown', hook: 'afterRender', error: err });
      }

      return {
        success: true,
        context
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof ExtensionError ? error : new ExtensionError(error instanceof Error ? error.message : String(error)),
        context
      };
    }
  }
} 