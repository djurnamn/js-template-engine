import type {
  RenderContext,
  PipelineStep,
  PipelineStepResult,
} from '../../types/renderContext';
import { ExtensionManager } from '../ExtensionManager';
import { ExtensionError } from '../errors';

/**
 * Calls afterRender hooks.
 * Executes post-rendering extension hooks for cleanup and final processing.
 */
export class AfterRenderStep implements PipelineStep {
  name = 'AfterRender';
  private constructorExtensions: any[];

  /**
   * Creates a new AfterRenderStep instance.
   * @param extensions - The extensions to use for after-render processing.
   */
  constructor(extensions: any[]) {
    this.constructorExtensions = extensions;
  }

  /**
   * Executes the after render step.
   * Calls afterRender hooks on all extensions for root-level renders.
   *
   * @param context - The rendering context containing processed nodes and options.
   * @returns A promise that resolves to the pipeline step result.
   */
  async execute(context: RenderContext): Promise<PipelineStepResult> {
    try {
      const { processedNodes, options, isRoot } = context;

      if (!isRoot) {
        return {
          success: true,
          context,
        };
      }

      // Call afterRender hooks
      try {
        const extensionManager = new ExtensionManager(options.extensions || []);
        extensionManager.callAfterRender(processedNodes || [], options);
      } catch (err) {
        throw new ExtensionError('Error in afterRender hook', {
          extension: 'unknown',
          hook: 'afterRender',
          error: err,
        });
      }

      return {
        success: true,
        context,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof ExtensionError
            ? error
            : new ExtensionError(
                error instanceof Error ? error.message : String(error)
              ),
        context,
      };
    }
  }
}
