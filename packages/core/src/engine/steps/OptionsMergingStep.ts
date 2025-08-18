import type {
  RenderContext,
  PipelineStep,
  PipelineStepResult,
} from '../../types/renderContext';
import type { TemplateOptions } from '../../types';
import { ExtensionManager } from '../ExtensionManager';
import { ValidationError } from '../errors';

/**
 * Merges and validates rendering options.
 * Handles default options, extension merging, and option validation.
 */
export class OptionsMergingStep implements PipelineStep {
  name = 'OptionsMerging';
  private constructorExtensions: any[];

  /**
   * Creates a new OptionsMergingStep instance.
   * @param extensions - The extensions to use for options merging.
   */
  constructor(extensions: any[]) {
    this.constructorExtensions = extensions;
  }

  /**
   * Determines the appropriate Prettier parser by asking extensions.
   * @param options - The merged template options.
   * @param extensions - The active extensions.
   * @returns The appropriate parser string for Prettier.
   */
  private determinePrettierParser(options: TemplateOptions, extensions: any[]): string {
    // Ask the first extension that has a getPrettierParser method
    for (const extension of extensions) {
      if (extension.getPrettierParser && typeof extension.getPrettierParser === 'function') {
        return extension.getPrettierParser(options);
      }
    }
    
    // Default fallback based on language if no extension provides a parser
    const language = options.language ?? 'javascript';
    if (language === 'typescript') {
      return 'typescript';
    }
    
    if (language === 'javascript') {
      return 'babel';
    }
    
    // Final fallback
    return 'html';
  }

  /**
   * Executes the options merging step.
   * Merges default options with user-provided options and extension options.
   *
   * @param context - The rendering context containing options to merge.
   * @returns A promise that resolves to the pipeline step result.
   */
  async execute(context: RenderContext): Promise<PipelineStepResult> {
    try {
      const { options, isRoot } = context;

      if (!isRoot) {
        // For non-root renders, just pass through the options
        return {
          success: true,
          context,
        };
      }

      // Define default options
      const defaultOptions: Partial<TemplateOptions> = {
        attributeFormatter: (
          attribute: string,
          value: string | number | boolean
        ) => ` ${attribute}="${value}"`,
        language: 'javascript',
        filename: options.name ?? 'untitled',
        outputDir: 'dist',
        preferSelfClosingTags: false,
        writeOutputFile: false,
        verbose: false,
        styles: {
          outputFormat: 'css',
          generateSourceMap: false,
          minify: false,
        },
      };

      // Merge constructor extensions with options extensions
      const mergedExtensions = [...this.constructorExtensions];
      if (options.extensions) {
        options.extensions.forEach((extension) => {
          if (
            !mergedExtensions.some(
              (existingExtension) => existingExtension.key === extension.key
            )
          ) {
            mergedExtensions.push(extension);
          }
        });
      }

      // Use ExtensionManager to merge options
      const extensionManager = new ExtensionManager(mergedExtensions);
      const merged = extensionManager.callOptionsHandlers(
        defaultOptions as TemplateOptions,
        options
      );

      const finalOptions: TemplateOptions = {
        ...merged,
        ...options,
        extensions: mergedExtensions,
      };

      // Auto-detect prettier parser if not explicitly set
      if (!options.prettierParser) {
        finalOptions.prettierParser = this.determinePrettierParser(finalOptions, mergedExtensions);
      }

      const rendererExtensions = mergedExtensions.filter(
        (ext) => ext && (ext.isRenderer === true)
      );
      if (rendererExtensions.length > 1) {
        // Add error to context.errors (initialize if needed)
        if (!('errors' in context)) {
          (context as any).errors = [];
        }
        (context as any).errors.push(
          new ValidationError(
            `Multiple renderer extensions detected: ${rendererExtensions
              .map((ext) => ext.key || 'unknown')
              .join(', ')}. Only one renderer extension can be used at a time.`,
            { extensions: rendererExtensions }
          )
        );
        // Set template to empty string and return failure
        const updatedContext: RenderContext = {
          ...context,
          options: finalOptions,
          template: '',
        };
        return {
          success: false,
          context: updatedContext,
          error: (context as any).errors[(context as any).errors.length - 1],
        };
      }

      // Update context with merged options
      const updatedContext: RenderContext = {
        ...context,
        options: finalOptions,
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
