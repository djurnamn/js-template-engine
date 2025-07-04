import type { RenderContext, PipelineStep, PipelineStepResult } from '../../types/renderContext';
import type { TemplateOptions } from '../../types';
import { ExtensionManager } from '../../utils/ExtensionManager';

/**
 * Merges and validates rendering options
 */
export class OptionsMergingStep implements PipelineStep {
  name = 'OptionsMerging';
  private constructorExtensions: any[];

  constructor(extensions: any[]) {
    this.constructorExtensions = extensions;
  }

  async execute(context: RenderContext): Promise<PipelineStepResult> {
    try {
      const { options, isRoot } = context;
      
      if (!isRoot) {
        // For non-root renders, just pass through the options
        return {
          success: true,
          context
        };
      }

      // Define default options
      const defaultOptions: Partial<TemplateOptions> = {
        attributeFormatter: (attribute: string, value: string | number | boolean) => ` ${attribute}="${value}"`,
        fileExtension: '.html',
        filename: options.name ?? 'untitled',
        outputDir: 'dist',
        preferSelfClosingTags: false,
        prettierParser: 'html',
        writeOutputFile: false,
        verbose: false,
        styles: {
          outputFormat: 'css',
          generateSourceMap: false,
          minify: false,
        }
      };

      // Merge constructor extensions with options extensions
      const mergedExtensions = [...this.constructorExtensions];
      if (options.extensions) {
        options.extensions.forEach(ext => {
          if (!mergedExtensions.some(e => e.key === ext.key)) {
            mergedExtensions.push(ext);
          }
        });
      }

      // Use ExtensionManager to merge options
      const extensionManager = new ExtensionManager(mergedExtensions);
      const merged = extensionManager.callOptionsHandlers(defaultOptions as TemplateOptions, options);

      const finalOptions: TemplateOptions = {
        ...merged,
        ...options,
        extensions: mergedExtensions
      };

      // Update context with merged options
      const updatedContext: RenderContext = {
        ...context,
        options: finalOptions
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
} 