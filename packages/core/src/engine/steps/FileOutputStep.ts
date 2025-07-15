import type {
  RenderContext,
  PipelineStep,
  PipelineStepResult,
} from '../../types/renderContext';
import { FileOutputManager } from '../FileOutputManager';
import { FileOutputError } from '../errors';

/**
 * Handles file output writing.
 * Manages writing rendered templates and styles to disk.
 */
export class FileOutputStep implements PipelineStep {
  name = 'FileOutput';
  private fileOutputManager: FileOutputManager;

  /**
   * Creates a new FileOutputStep instance.
   * @param fileOutputManager - The file output manager to use for writing files.
   */
  constructor(fileOutputManager: FileOutputManager) {
    this.fileOutputManager = fileOutputManager;
  }

  /**
   * Executes the file output step.
   * Writes rendered templates and styles to disk for root-level renders.
   *
   * @param context - The rendering context containing template and style data.
   * @returns A promise that resolves to the pipeline step result.
   */
  async execute(context: RenderContext): Promise<PipelineStepResult> {
    try {
      const {
        template,
        styleOutput,
        options,
        processedNodes,
        isRoot,
        styleHandled,
        usedRendererExtension,
      } = context;

      if (!isRoot) {
        return {
          success: true,
          context,
        };
      }

      // Write output files if requested
      try {
        await this.fileOutputManager.writeAllOutputs({
          template: template || '',
          styleOutput: styleOutput || '',
          hasStyles: Boolean(styleOutput),
          styleHandled: styleHandled || false,
          options,
          processedNodes: processedNodes || [],
          extensionManager: context.extensionManager,
        });
      } catch (err) {
        throw new FileOutputError('Error writing output files', {
          options,
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
          error instanceof FileOutputError
            ? error
            : new FileOutputError(
                error instanceof Error ? error.message : String(error)
              ),
        context,
      };
    }
  }
}
