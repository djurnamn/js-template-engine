import type { TemplateNode, ExtendedTemplate } from '@js-template-engine/types';
import type { TemplateOptions } from '../types';
import type { RenderContext } from '../types/renderContext';

import { StyleManager } from './StyleManager';
import { RenderPipeline } from './RenderPipeline';
import { FileOutputManager } from '../utils/FileOutputManager';
import { ExtensionManager } from '../utils/ExtensionManager';
import { NodeTraverser } from '../utils/NodeTraverser';
import { createLogger } from '../utils/logger';

import {
  InputNormalizationStep,
  OptionsMergingStep,
  ExtensionProcessingStep,
  TemplateRenderingStep,
  StyleProcessingStep,
  RootHandlerStep,
  FileOutputStep,
  AfterRenderStep
} from './steps';

import { TemplateEngineError } from './errors';

/**
 * Refactored TemplateEngine using pipeline architecture
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

  constructor(extensions: any[] = [], verbose = false) {
    this.extensions = extensions;
    this.verbose = verbose;
    this.logger = createLogger(verbose, 'RefactoredTemplateEngine');
    this.styleManager = new StyleManager();
    this.nodeTraverser = new NodeTraverser({ extensions });
    this.extensionManager = new ExtensionManager(extensions);
    this.fileOutputManager = new FileOutputManager();

    // Initialize the rendering pipeline with all steps
    this.renderPipeline = new RenderPipeline([
      new InputNormalizationStep(),
      new OptionsMergingStep(extensions),
      new ExtensionProcessingStep(),
      new TemplateRenderingStep(this.styleManager, verbose),
      new StyleProcessingStep(this.styleManager),
      new RootHandlerStep(extensions),
      new FileOutputStep(this.fileOutputManager),
      new AfterRenderStep(extensions)
    ], verbose);
  }

  /**
   * Render template nodes or extended template to HTML/JSX
   */
  async render(
    input: TemplateNode[] | ExtendedTemplate,
    options: TemplateOptions = {},
    isRoot = true,
    ancestorNodesContext: TemplateNode[] = []
  ): Promise<{ output: string, errors: TemplateEngineError[] }> {
    // Create initial render context
    const context: RenderContext = {
      input,
      nodes: [],
      component: undefined,
      options,
      isRoot,
      ancestorNodesContext,
      extensionManager: this.extensionManager
    };

    // Execute the rendering pipeline
    const output = await this.renderPipeline.execute(context);
    const errors = (context as any).errors || [];
    return { output, errors };
  }

  /**
   * Get the current extensions
   */
  getExtensions(): any[] {
    return [...this.extensions];
  }

  /**
   * Add an extension
   */
  addExtension(extension: any): void {
    this.extensions.push(extension);
    // Reinitialize pipeline with new extensions
    this.renderPipeline = new RenderPipeline([
      new InputNormalizationStep(),
      new OptionsMergingStep(this.extensions),
      new ExtensionProcessingStep(),
      new TemplateRenderingStep(this.styleManager, this.verbose),
      new StyleProcessingStep(this.styleManager),
      new RootHandlerStep(this.extensions),
      new FileOutputStep(this.fileOutputManager),
      new AfterRenderStep(this.extensions)
    ], this.verbose);
  }

  /**
   * Get the style manager
   */
  getStyleManager(): StyleManager {
    return this.styleManager;
  }

  /**
   * Get the file output manager
   */
  getFileOutputManager(): FileOutputManager {
    return this.fileOutputManager;
  }
} 