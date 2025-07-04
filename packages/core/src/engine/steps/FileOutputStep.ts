import type { RenderContext, PipelineStep, PipelineStepResult } from '../../types/renderContext';
import { FileOutputManager } from '../../utils/FileOutputManager';

/**
 * Handles file output writing
 */
export class FileOutputStep implements PipelineStep {
  name = 'FileOutput';
  private fileOutputManager: FileOutputManager;

  constructor(fileOutputManager: FileOutputManager) {
    this.fileOutputManager = fileOutputManager;
  }

  async execute(context: RenderContext): Promise<PipelineStepResult> {
    try {
      const { 
        template, 
        styleOutput, 
        options, 
        processedNodes, 
        isRoot,
        styleHandled,
        usedRendererExtension 
      } = context;
      
      if (!isRoot) {
        return {
          success: true,
          context
        };
      }

      // Write output files if requested
      await this.fileOutputManager.writeAllOutputs({
        template: template || '',
        styleOutput: styleOutput || '',
        hasStyles: Boolean(styleOutput),
        styleHandled: styleHandled || false,
        options,
        processedNodes: processedNodes || [],
        extensionManager: null // We don't need this for file output
      });

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