/**
 * High-level integration API for the concept-driven extension system.
 * This is the main entry point that replaces the legacy extension system.
 */

import { ExtensionRegistry } from '../registry/ExtensionRegistry';
import { ProcessingPipeline } from '../pipeline/ProcessingPipeline';
import { TemplateAnalyzer } from '../analyzer/TemplateAnalyzer';
import { ErrorCollector } from '../metadata';
import type { FrameworkExtension, StylingExtension, UtilityExtension } from '../extensions';
import type { ProcessingOptions, ProcessingResult } from '../pipeline/ProcessingPipeline';

/**
 * Engine configuration options.
 */
export interface ConceptEngineOptions {
  /** Default framework to use */
  defaultFramework?: string;
  /** Default styling approach to use */
  defaultStyling?: string;
  /** Default utility extensions */
  defaultUtilities?: string[];
  /** Enable performance tracking */
  enablePerformanceTracking?: boolean;
  /** Enable verbose error reporting */
  verboseErrors?: boolean;
  /** Custom analyzer options */
  analyzerOptions?: {
    extractStyling?: boolean;
    extractEvents?: boolean;
    extractConditionals?: boolean;
    extractIterations?: boolean;
    extractSlots?: boolean;
    extractAttributes?: boolean;
    eventPrefixes?: string[];
    ignoreAttributes?: string[];
  };
}

/**
 * Template rendering options.
 */
export interface RenderOptions extends ProcessingOptions {
  /** Override default framework */
  framework?: string;
  /** Override default styling */
  styling?: string;
  /** Override default utilities */
  utilities?: string[];
  /** Component metadata */
  component?: {
    name?: string;
    props?: Record<string, string>;
    imports?: string[];
    [key: string]: any;
  };
}

/**
 * Template node interface for public API.
 */
export interface TemplateNode {
  type?: 'element' | 'text' | 'comment' | 'if' | 'for' | 'slot' | 'fragment';
  tag?: string;
  content?: string;
  attributes?: Record<string, any>;
  expressionAttributes?: Record<string, any>;
  children?: TemplateNode[];
  
  // Conditional node properties
  condition?: string;
  then?: TemplateNode[];
  else?: TemplateNode[];
  
  // Loop node properties
  items?: string;
  item?: string;
  index?: string;
  key?: string;
  
  // Slot node properties
  name?: string;
  fallback?: TemplateNode[];
  
  // Extension data
  extensions?: Record<string, any>;
}

/**
 * Engine status information.
 */
export interface EngineStatus {
  /** Available framework extensions */
  frameworks: string[];
  /** Available styling extensions */
  styling: string[];
  /** Available utility extensions */
  utilities: string[];
  /** Current configuration */
  config: ConceptEngineOptions;
}

/**
 * Main concept-driven template engine.
 */
export class ConceptEngine {
  private registry: ExtensionRegistry;
  private pipeline: ProcessingPipeline;
  private analyzer: TemplateAnalyzer;
  private errorCollector: ErrorCollector;
  private options: Required<ConceptEngineOptions>;

  constructor(options: ConceptEngineOptions = {}) {
    // Set default options
    this.options = {
      defaultFramework: options.defaultFramework || '',
      defaultStyling: options.defaultStyling || '',
      defaultUtilities: options.defaultUtilities || [],
      enablePerformanceTracking: options.enablePerformanceTracking ?? true,
      verboseErrors: options.verboseErrors ?? false,
      analyzerOptions: options.analyzerOptions || {}
    };

    // Initialize components
    this.registry = new ExtensionRegistry();
    this.errorCollector = new ErrorCollector();
    this.analyzer = new TemplateAnalyzer(this.options.analyzerOptions, this.errorCollector);
    this.pipeline = new ProcessingPipeline(this.registry, this.analyzer, this.errorCollector);
  }

  /**
   * Register a framework extension.
   */
  registerFramework(extension: FrameworkExtension): void {
    const result = this.registry.registerFramework(extension);
    
    if (!result.isValid) {
      const errorMsg = `Failed to register framework extension '${extension.metadata.key}': ${result.errors.join(', ')}`;
      throw new Error(errorMsg);
    }

    if (result.warnings.length > 0 && this.options.verboseErrors) {
      console.warn(`Warnings when registering framework extension '${extension.metadata.key}':`, result.warnings);
    }
  }

  /**
   * Register a styling extension.
   */
  registerStyling(extension: StylingExtension): void {
    const result = this.registry.registerStyling(extension);
    
    if (!result.isValid) {
      const errorMsg = `Failed to register styling extension '${extension.metadata.key}': ${result.errors.join(', ')}`;
      throw new Error(errorMsg);
    }

    if (result.warnings.length > 0 && this.options.verboseErrors) {
      console.warn(`Warnings when registering styling extension '${extension.metadata.key}':`, result.warnings);
    }
  }

  /**
   * Register a utility extension.
   */
  registerUtility(extension: UtilityExtension): void {
    const result = this.registry.registerUtility(extension);
    
    if (!result.isValid) {
      const errorMsg = `Failed to register utility extension '${extension.metadata.key}': ${result.errors.join(', ')}`;
      throw new Error(errorMsg);
    }

    if (result.warnings.length > 0 && this.options.verboseErrors) {
      console.warn(`Warnings when registering utility extension '${extension.metadata.key}':`, result.warnings);
    }
  }

  /**
   * Render a template using the concept-driven pipeline.
   */
  async render(template: TemplateNode[], options: RenderOptions = {}): Promise<ProcessingResult> {
    // Merge with defaults
    const processingOptions: ProcessingOptions = {
      framework: options.framework || this.options.defaultFramework,
      styling: options.styling || this.options.defaultStyling,
      utilities: options.utilities || this.options.defaultUtilities,
      component: options.component,
      ...options
    };

    // Remove undefined values
    if (!processingOptions.framework) {
      delete processingOptions.framework;
    }
    if (!processingOptions.styling) {
      delete processingOptions.styling;
    }
    if (!processingOptions.utilities || processingOptions.utilities.length === 0) {
      delete processingOptions.utilities;
    }

    try {
      const result = await this.pipeline.process(template, processingOptions);
      
      // Log errors if verbose mode is enabled
      if (this.options.verboseErrors && (result.errors.hasErrors() || result.errors.hasWarnings())) {
        console.warn('Processing completed with issues:', result.errors.formatErrors());
      }

      return result;
    } catch (error) {
      throw new Error(`Template rendering failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get engine status and available extensions.
   */
  getStatus(): EngineStatus {
    return {
      frameworks: this.registry.getAvailableFrameworks(),
      styling: this.registry.getAvailableStyling(),
      utilities: this.registry.getAvailableUtilities(),
      config: this.options
    };
  }

  /**
   * Check if a specific extension is available.
   */
  hasExtension(key: string, type?: 'framework' | 'styling' | 'utility'): boolean {
    return this.registry.hasExtension(key, type);
  }

  /**
   * Get a specific framework extension.
   */
  getFrameworkExtension(key: string): FrameworkExtension | undefined {
    return this.registry.getFramework(key);
  }

  /**
   * Get a specific styling extension.
   */
  getStylingExtension(key: string): StylingExtension | undefined {
    return this.registry.getStyling(key);
  }

  /**
   * Get a specific utility extension.
   */
  getUtilityExtension(key: string): UtilityExtension | undefined {
    return this.registry.getUtility(key);
  }

  /**
   * Remove an extension.
   */
  removeExtension(key: string, type: 'framework' | 'styling' | 'utility'): boolean {
    return this.registry.removeExtension(key, type);
  }

  /**
   * Clear all extensions of a specific type.
   */
  clearExtensions(type?: 'framework' | 'styling' | 'utility'): void {
    this.registry.clearExtensions(type);
  }

  /**
   * Get the total number of registered extensions.
   */
  getExtensionCount(type?: 'framework' | 'styling' | 'utility'): number {
    return this.registry.getExtensionCount(type);
  }

  /**
   * Set default framework.
   */
  setDefaultFramework(framework: string): void {
    if (!this.registry.hasExtension(framework, 'framework')) {
      throw new Error(`Framework extension '${framework}' is not registered`);
    }
    this.options.defaultFramework = framework;
  }

  /**
   * Set default styling approach.
   */
  setDefaultStyling(styling: string): void {
    if (!this.registry.hasExtension(styling, 'styling')) {
      throw new Error(`Styling extension '${styling}' is not registered`);
    }
    this.options.defaultStyling = styling;
  }

  /**
   * Set default utility extensions.
   */
  setDefaultUtilities(utilities: string[]): void {
    for (const utility of utilities) {
      if (!this.registry.hasExtension(utility, 'utility')) {
        throw new Error(`Utility extension '${utility}' is not registered`);
      }
    }
    this.options.defaultUtilities = utilities;
  }

  /**
   * Analyze a template without rendering.
   * Useful for debugging and understanding concept extraction.
   */
  async analyze(template: TemplateNode[]): Promise<{
    concepts: any; // ComponentConcept
    errors: ErrorCollector;
    performance: any; // PerformanceMetrics
  }> {
    this.errorCollector.clear();
    this.analyzer.clearErrors();

    const performanceTracker = this.pipeline.getPerformanceTracker();
    performanceTracker.start();

    try {
      const concepts = this.analyzer.extractConcepts(template);
      
      // Merge analyzer errors
      const analyzerErrors = this.analyzer.getErrors();
      analyzerErrors.getErrors().forEach(error => this.errorCollector.addError(error));

      return {
        concepts,
        errors: this.errorCollector,
        performance: performanceTracker.getMetrics()
      };
    } catch (error) {
      this.errorCollector.addSimpleError(
        `Template analysis failed: ${error instanceof Error ? error.message : String(error)}`,
        'root',
        'analyzer'
      );

      return {
        concepts: null,
        errors: this.errorCollector,
        performance: performanceTracker.getMetrics()
      };
    }
  }

  /**
   * Validate an extension without registering it.
   */
  validateExtension(extension: FrameworkExtension | StylingExtension | UtilityExtension): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    return this.registry.validateExtension(extension);
  }

  /**
   * Get current error collector (useful for debugging).
   */
  getErrorCollector(): ErrorCollector {
    return this.errorCollector;
  }

  /**
   * Get performance tracker (useful for profiling).
   */
  getPerformanceTracker(): any { // PerformanceTracker
    return this.pipeline.getPerformanceTracker();
  }

  /**
   * Create a new ConceptEngine instance with the same configuration.
   */
  clone(overrideOptions?: Partial<ConceptEngineOptions>): ConceptEngine {
    const newOptions = { ...this.options, ...overrideOptions };
    const clonedEngine = new ConceptEngine(newOptions);

    // Copy all registered extensions
    for (const key of this.registry.getAvailableFrameworks()) {
      const extension = this.registry.getFramework(key);
      if (extension) {
        clonedEngine.registerFramework(extension);
      }
    }

    for (const key of this.registry.getAvailableStyling()) {
      const extension = this.registry.getStyling(key);
      if (extension) {
        clonedEngine.registerStyling(extension);
      }
    }

    for (const key of this.registry.getAvailableUtilities()) {
      const extension = this.registry.getUtility(key);
      if (extension) {
        clonedEngine.registerUtility(extension);
      }
    }

    return clonedEngine;
  }
}