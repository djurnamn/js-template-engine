import type { TemplateNode, ExtendedTemplate } from '@js-template-engine/types';
import type { TemplateOptions } from '../types';
import type { RenderContext } from '../types/renderContext';

import { StyleManager } from './StyleManager';
import { RenderPipeline } from './RenderPipeline';
import { FileOutputManager } from './FileOutputManager';
import { ExtensionManager } from './ExtensionManager';
import { NodeTraverser } from './NodeTraverser';
import { createLogger } from '../utils/logger';

import {
  TemplateValidationStep,
  InputNormalizationStep,
  OptionsMergingStep,
  ExtensionProcessingStep,
  TemplateRenderingStep,
  StyleProcessingStep,
  RootHandlerStep,
  FileOutputStep,
  AfterRenderStep,
} from './steps';

import { TemplateEngineError } from './errors';

/**
 * Main template engine class that orchestrates the rendering process.
 * Uses a pipeline architecture to process templates through multiple steps.
 */
export class TemplateEngine {
  private styleManager: StyleManager;
  private extensions: any[];
  private logger: ReturnType<typeof createLogger>;
  private verbose: boolean;
  private nodeTraverser: NodeTraverser;
  private extensionManager: ExtensionManager;
  private fileOutputManager: FileOutputManager;
  private renderPipeline: RenderPipeline;

  /**
   * Creates a new TemplateEngine instance.
   * @param extensions - Array of extensions to use during rendering.
   * @param verbose - Whether to enable verbose logging.
   */
  constructor(extensions: any[] = [], verbose = false) {
    this.extensions = extensions;
    this.verbose = verbose;
    this.logger = createLogger(verbose, 'RefactoredTemplateEngine');
    this.styleManager = new StyleManager();
    this.nodeTraverser = new NodeTraverser({ extensions });
    this.extensionManager = new ExtensionManager(extensions);
    this.fileOutputManager = new FileOutputManager();

    // Initialize the rendering pipeline with all steps
    this.renderPipeline = new RenderPipeline(
      [
        new TemplateValidationStep(), // Re-enabled with lenient validation
        new InputNormalizationStep(),
        new OptionsMergingStep(extensions),
        new ExtensionProcessingStep(),
        new TemplateRenderingStep(this.styleManager, verbose),
        new StyleProcessingStep(this.styleManager),
        new RootHandlerStep(extensions),
        new FileOutputStep(this.fileOutputManager),
        new AfterRenderStep(extensions),
      ],
      verbose
    );
  }

  /**
   * Renders template nodes or extended template to HTML/JSX.
   *
   * @param input - The template nodes or extended template to render.
   * @param options - Template rendering options.
   * @param isRoot - Whether this is a root-level render call.
   * @param ancestorNodesContext - Context of ancestor nodes for nested rendering.
   * @returns A promise that resolves to the rendered output and any errors.
   */
  async render(
    input: TemplateNode[] | ExtendedTemplate,
    options: TemplateOptions = {},
    isRoot = true,
    ancestorNodesContext: TemplateNode[] = []
  ): Promise<{ output: string; errors: TemplateEngineError[] }> {
    // Create initial render context
    const context: RenderContext = {
      input,
      nodes: [],
      component: undefined,
      options,
      isRoot,
      ancestorNodesContext,
      extensionManager: this.extensionManager,
    };

    // Execute the rendering pipeline
    const output = await this.renderPipeline.execute(context);
    const errors = (context as any).errors || [];
    return { output, errors };
  }

  /**
   * Gets the current extensions.
   * @returns A copy of the current extensions array.
   */
  getExtensions(): any[] {
    return [...this.extensions];
  }

  /**
   * Adds an extension to the engine.
   * @param extension - The extension to add.
   */
  addExtension(extension: any): void {
    this.extensions.push(extension);
    // Reinitialize pipeline with new extensions
    this.renderPipeline = new RenderPipeline(
      [
        new InputNormalizationStep(),
        new OptionsMergingStep(this.extensions),
        new ExtensionProcessingStep(),
        new TemplateRenderingStep(this.styleManager, this.verbose),
        new StyleProcessingStep(this.styleManager),
        new RootHandlerStep(this.extensions),
        new FileOutputStep(this.fileOutputManager),
        new AfterRenderStep(this.extensions),
      ],
      this.verbose
    );
  }

  /**
   * Gets the style manager instance.
   * @returns The StyleManager instance.
   */
  getStyleManager(): StyleManager {
    return this.styleManager;
  }

  /**
   * Gets the file output manager instance.
   * @returns The FileOutputManager instance.
   */
  getFileOutputManager(): FileOutputManager {
    return this.fileOutputManager;
  }
}
