import type {
  RenderContext,
  PipelineStep,
  PipelineStepResult,
} from '../../types/renderContext';
import { StyleManager } from '../StyleManager';

/**
 * Processes styles and generates style output.
 * Handles style extraction, processing, and output generation for template nodes.
 */
export class StyleProcessingStep implements PipelineStep {
  name = 'StyleProcessing';
  private styleManager: StyleManager;

  /**
   * Creates a new StyleProcessingStep instance.
   * @param styleManager - The style manager to use for processing styles.
   */
  constructor(styleManager: StyleManager) {
    this.styleManager = styleManager;
  }

  /**
   * Executes the style processing step.
   * Processes styles from template nodes and generates style output.
   *
   * @param context - The rendering context containing processed nodes and options.
   * @returns A promise that resolves to the pipeline step result.
   */
  async execute(context: RenderContext): Promise<PipelineStepResult> {
    try {
      const { processedNodes, options, isRoot } = context;

      if (!isRoot || !processedNodes) {
        return {
          success: true,
          context,
        };
      }

      // Process styles for all nodes
      processedNodes.forEach((node) => this.styleManager.processNode(node));

      const hasStyles = this.styleManager.hasStyles();
      const styleOutput = hasStyles
        ? this.styleManager.generateOutput(options, processedNodes)
        : '';

      // Update context with style information
      const updatedContext: RenderContext = {
        ...context,
        styleOutput,
        styleHandled: false,
      };

      return {
        success: true,
        context: updatedContext,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        context,
      };
    }
  }
}
