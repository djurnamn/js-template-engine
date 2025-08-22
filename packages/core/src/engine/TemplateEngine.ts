/**
 * High-level integration API for the concept-driven extension system.
 * This is the main entry point that replaces the legacy extension system.
 */

import { ExtensionRegistry } from '../registry/ExtensionRegistry';
import { LegacyProcessingPipeline } from '../pipeline/LegacyProcessingPipeline';
import {
  ProcessingPipeline,
  type ProcessingOptions as NewProcessingOptions,
  type ProcessingResult as NewProcessingResult,
} from '../pipeline/ProcessingPipeline';
import { TemplateAnalyzer } from '../analyzer/TemplateAnalyzer';
import { ErrorCollector } from '../metadata';
import type {
  FrameworkExtension,
  StylingExtension,
  UtilityExtension,
} from '../extensions';
import type {
  LegacyProcessingOptions,
  LegacyProcessingResult,
} from '../pipeline/LegacyProcessingPipeline';
import type {
  ComponentResolutionStrategy,
  ScriptMergeStrategy,
  PropMergeStrategy,
  ImportMergeStrategy,
} from '../processors';
import type { ValidationOptions } from '../validation';

/**
 * Engine configuration options.
 */
export interface TemplateEngineOptions {
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

  // advanced processing Options
  /** Enable advanced processing enhanced processing */
  enabled?: boolean;
  /** Merge strategies for component properties */
  mergeStrategies?: {
    script?: ScriptMergeStrategy;
    props?: PropMergeStrategy;
    imports?: ImportMergeStrategy;
  };
  /** Validation configuration */
  validation?: {
    enableFrameworkConsistency?: boolean;
    enableCrossConceptValidation?: boolean;
    suggestEventAlternatives?: boolean;
    checkAccessibility?: boolean;
    checkPerformance?: boolean;
    checkBestPractices?: boolean;
  };
  /** Normalization configuration */
  normalization?: {
    normalizeEventNames?: boolean;
    normalizeStylingApproaches?: boolean;
    validateNormalizedEvents?: boolean;
  };
  /** Extraction options */
  extraction?: {
    useEventExtractor?: boolean;
    useStylingExtractor?: boolean;
    detectCSSFrameworks?: boolean;
    extractCSSVariables?: boolean;
    validateCSS?: boolean;
  };
}

/**
 * Template rendering options.
 */
export interface RenderOptions extends LegacyProcessingOptions {
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
  config: TemplateEngineOptions;
}

/**
 * Main concept-driven template engine.
 */
export class TemplateEngine {
  private registry: ExtensionRegistry;
  private pipeline: LegacyProcessingPipeline;
  private advancedPipeline: ProcessingPipeline;
  private analyzer: TemplateAnalyzer;
  private errorCollector: ErrorCollector;
  private options: Required<TemplateEngineOptions>;

  constructor(options: TemplateEngineOptions = {}) {
    // Set default options
    this.options = {
      defaultFramework: options.defaultFramework || '',
      defaultStyling: options.defaultStyling || '',
      defaultUtilities: options.defaultUtilities || [],
      enablePerformanceTracking: options.enablePerformanceTracking ?? true,
      verboseErrors: options.verboseErrors ?? false,
      analyzerOptions: options.analyzerOptions || {},

      // advanced processing defaults
      enabled: options.enabled ?? true,
      mergeStrategies: {
        script: { mode: 'append', separator: '\n\n', includeComments: false },
        props: { mode: 'merge', conflictResolution: 'warn' },
        imports: { mode: 'merge', deduplication: true, grouping: true },
        ...(options.mergeStrategies || {}),
      },
      validation: {
        enableFrameworkConsistency: true,
        enableCrossConceptValidation: true,
        checkAccessibility: true,
        checkPerformance: true,
        checkBestPractices: true,
        ...(options.validation || {}),
      },
      normalization: {
        normalizeEventNames: true,
        normalizeStylingApproaches: false,
        validateNormalizedEvents: true,
        ...(options.normalization || {}),
      },
      extraction: {
        useEventExtractor: true,
        useStylingExtractor: true,
        detectCSSFrameworks: true,
        extractCSSVariables: true,
        validateCSS: true,
        ...(options.extraction || {}),
      },
    };

    // Initialize components
    this.registry = new ExtensionRegistry();
    this.errorCollector = new ErrorCollector();
    this.analyzer = new TemplateAnalyzer(
      this.options.analyzerOptions,
      this.errorCollector
    );
    this.pipeline = new LegacyProcessingPipeline(
      this.registry,
      this.analyzer,
      this.errorCollector
    );
    this.advancedPipeline = new ProcessingPipeline(
      this.registry,
      this.analyzer,
      this.errorCollector
    );
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
      console.warn(
        `Warnings when registering framework extension '${extension.metadata.key}':`,
        result.warnings
      );
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
      console.warn(
        `Warnings when registering styling extension '${extension.metadata.key}':`,
        result.warnings
      );
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
      console.warn(
        `Warnings when registering utility extension '${extension.metadata.key}':`,
        result.warnings
      );
    }
  }

  /**
   * Render a template using the legacy pipeline (for backwards compatibility).
   */
  async renderLegacy(
    template: TemplateNode[],
    options: RenderOptions = {}
  ): Promise<LegacyProcessingResult> {
    // Use new pipeline if processing is enabled
    if (this.options.enabled) {
      const result = await this.render(template, options);
      // Return compatible result with proper metadata structure
      return {
        output: result.output,
        concepts: result.concepts,
        metadata: {
          extensionsUsed: result.metadata.extensionsUsed || [],
          conceptsFound: result.metadata.conceptsFound || {
            events: 0,
            styling: false,
            conditionals: 0,
            iterations: 0,
            slots: 0,
            attributes: 0
          },
          timestamp: new Date()
        },
        errors: result.errors,
        performance: result.performance,
      };
    }

    // Use legacy pipeline directly
    return this._renderWithLegacyPipeline(template, options);
  }

  /**
   * Render using legacy pipeline (Phase 1 compatibility).
   */
  private async _renderWithLegacyPipeline(
    template: TemplateNode[],
    options: RenderOptions = {}
  ): Promise<LegacyProcessingResult> {
    // Merge with defaults
    const processingOptions: LegacyProcessingOptions = {
      framework: options.framework || this.options.defaultFramework,
      styling: options.styling || this.options.defaultStyling,
      utilities: options.utilities || this.options.defaultUtilities,
      component: options.component,
      ...options,
    };

    // Remove undefined values
    if (!processingOptions.framework) {
      delete processingOptions.framework;
    }
    if (!processingOptions.styling) {
      delete processingOptions.styling;
    }
    if (
      !processingOptions.utilities ||
      processingOptions.utilities.length === 0
    ) {
      delete processingOptions.utilities;
    }

    try {
      const result = await this.pipeline.process(template, processingOptions);

      // Log errors if verbose mode is enabled
      if (
        this.options.verboseErrors &&
        (result.errors.hasErrors() || result.errors.hasWarnings())
      ) {
        console.warn(
          'Processing completed with issues:',
          result.errors.formatErrors()
        );
      }

      return result;
    } catch (error) {
      throw new Error(
        `Template rendering failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Render using enhanced pipeline with advanced processing features.
   */
  async render(
    template: TemplateNode[],
    options: RenderOptions = {}
  ): Promise<NewProcessingResult> {
    // Check if we have any extensions available
    const hasFramework = options.framework ? this.registry.hasExtension(options.framework, 'framework') : 
                        this.options.defaultFramework ? this.registry.hasExtension(this.options.defaultFramework, 'framework') : false;
    const hasStyling = options.styling ? this.registry.hasExtension(options.styling, 'styling') : 
                      this.options.defaultStyling ? this.registry.hasExtension(this.options.defaultStyling, 'styling') : false;
    const hasUtilities = (options.utilities || this.options.defaultUtilities).some(u => 
                        this.registry.hasExtension(u, 'utility'));

    // If no extensions are available, fall back to legacy pipeline for basic HTML rendering
    if (!hasFramework && !hasStyling && !hasUtilities) {
      const legacyResult = await this._renderWithLegacyPipeline(template, options);
      // Convert legacy result to new result format
      return {
        ...legacyResult,
        validation: undefined,
        componentProperties: undefined,
        consistencyReport: undefined,
        advancedMetadata: {
          processing: false,
          processorsUsed: [],
          eventsNormalized: 0,
          propertiesMerged: false
        }
      };
    }

    // Merge with defaults and advanced processing options
    const enhancedOptions: NewProcessingOptions = {
      framework: options.framework || this.options.defaultFramework,
      styling: options.styling || this.options.defaultStyling,
      utilities: options.utilities || this.options.defaultUtilities,
      component: options.component,
      ...options,

      // advanced processing options
      mergeStrategies: this.options.mergeStrategies as ComponentResolutionStrategy,
      validation: {
        framework: (options.framework || this.options.defaultFramework) as
          | 'vue'
          | 'react'
          | 'svelte',
        enableFrameworkConsistency:
          this.options.validation.enableFrameworkConsistency,
        enableCrossConceptValidation:
          this.options.validation.enableCrossConceptValidation,
        checkAccessibility: this.options.validation.checkAccessibility,
        checkPerformance: this.options.validation.checkPerformance,
        checkBestPractices: this.options.validation.checkBestPractices,
      },
      eventNormalization: {
        framework: (options.framework || this.options.defaultFramework) as
          | 'vue'
          | 'react'
          | 'svelte',
        validateEvents: this.options.normalization.validateNormalizedEvents,
      },
      extraction: {
        useEventExtractor: this.options.extraction.useEventExtractor,
        useStylingExtractor: this.options.extraction.useStylingExtractor,
        normalizeEvents: this.options.normalization.normalizeEventNames,
        validateConcepts: this.options.validation.enableCrossConceptValidation,
      },
    };

    // Remove undefined values
    if (!enhancedOptions.framework) {
      delete enhancedOptions.framework;
    }
    if (!enhancedOptions.styling) {
      delete enhancedOptions.styling;
    }
    if (!enhancedOptions.utilities || enhancedOptions.utilities.length === 0) {
      delete enhancedOptions.utilities;
    }

    try {
      const result = await this.advancedPipeline.process(
        template,
        enhancedOptions
      );

      // Log errors if verbose mode is enabled
      if (
        this.options.verboseErrors &&
        (result.errors.hasErrors() || result.errors.hasWarnings())
      ) {
        console.warn(
          'Processing completed with issues:',
          result.errors.formatErrors()
        );

        // Log advanced processing specific information
        if (result.validation) {
          console.warn('Validation score:', result.validation.score);
          console.warn(
            'Validation warnings:',
            result.validation.warnings.length
          );
        }

        if (result.advancedMetadata) {
          console.warn(
            'advanced processing processors used:',
            result.advancedMetadata.processorsUsed
          );
          console.warn(
            'Events normalized:',
            result.advancedMetadata.eventsNormalized
          );
        }
      }

      return result;
    } catch (error) {
      throw new Error(
        `Template rendering failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Render with automatic advanced processing feature detection.
   */
  async renderWithAutoEnhancement(
    template: TemplateNode[],
    options: RenderOptions = {}
  ): Promise<LegacyProcessingResult> {
    return this.advancedPipeline.processWithAutoEnhancement(template, {
      framework: options.framework || this.options.defaultFramework,
      styling: options.styling || this.options.defaultStyling,
      utilities: options.utilities || this.options.defaultUtilities,
      component: options.component,
      ...options,
    });
  }

  /**
   * Get engine status and available extensions.
   */
  getStatus(): EngineStatus {
    return {
      frameworks: this.registry.getAvailableFrameworks(),
      styling: this.registry.getAvailableStyling(),
      utilities: this.registry.getAvailableUtilities(),
      config: this.options,
    };
  }

  /**
   * Check if a specific extension is available.
   */
  hasExtension(
    key: string,
    type?: 'framework' | 'styling' | 'utility'
  ): boolean {
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
  removeExtension(
    key: string,
    type: 'framework' | 'styling' | 'utility'
  ): boolean {
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
      analyzerErrors
        .getErrors()
        .forEach((error) => this.errorCollector.addError(error));

      return {
        concepts,
        errors: this.errorCollector,
        performance: performanceTracker.getMetrics(),
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
        performance: performanceTracker.getMetrics(),
      };
    }
  }

  /**
   * Validate an extension without registering it.
   */
  validateExtension(
    extension: FrameworkExtension | StylingExtension | UtilityExtension
  ): {
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
  getPerformanceTracker(): any {
    // PerformanceTracker
    return this.pipeline.getPerformanceTracker();
  }

  /**
   * Create a new TemplateEngine instance with the same configuration.
   */
  clone(overrideOptions?: Partial<TemplateEngineOptions>): TemplateEngine {
    const newOptions = { ...this.options, ...overrideOptions };
    const clonedEngine = new TemplateEngine(newOptions);

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

  /**
   * Create date/dayjs component example using advanced processing features.
   */
  createDateComponentExample() {
    return this.advancedPipeline.createDateComponentExample();
  }

  /**
   * Update merge strategies for component property processing.
   */
  updateMergeStrategies(
    strategies: Partial<typeof this.options.mergeStrategies>
  ): void {
    this.options.mergeStrategies = {
      ...this.options.mergeStrategies,
      ...strategies,
    };
  }

  /**
   * Update validation options.
   */
  updateValidationOptions(
    validation: Partial<typeof this.options.validation>
  ): void {
    this.options.validation = { ...this.options.validation, ...validation };
  }

  /**
   * Update normalization options.
   */
  updateNormalizationOptions(
    normalization: Partial<typeof this.options.normalization>
  ): void {
    this.options.normalization = {
      ...this.options.normalization,
      ...normalization,
    };
  }

  /**
   * Update extraction options.
   */
  updateExtractionOptions(
    extraction: Partial<typeof this.options.extraction>
  ): void {
    this.options.extraction = { ...this.options.extraction, ...extraction };
  }

  /**
   * Enable or disable advanced processing processing.
   */
  setEnabled(enabled: boolean): void {
    this.options.enabled = enabled;
  }

  /**
   * Get current advanced processing configuration.
   */
  getConfig() {
    return {
      enabled: this.options.enabled,
      mergeStrategies: this.options.mergeStrategies,
      validation: this.options.validation,
      normalization: this.options.normalization,
      extraction: this.options.extraction,
    };
  }

  /**
   * Get access to advanced processing processors.
   */
  getProcessors() {
    return {
      componentPropertyProcessor:
        this.advancedPipeline.getComponentPropertyProcessor(),
      importProcessor: this.advancedPipeline.getImportProcessor(),
      scriptMergeProcessor: this.advancedPipeline.getScriptMergeProcessor(),
      componentNameResolver: this.advancedPipeline.getComponentNameResolver(),
      eventExtractor: this.advancedPipeline.getEventExtractor(),
      enhancedStylingExtractor: this.advancedPipeline.getStylingExtractor(),
      conceptValidator: this.advancedPipeline.getConceptValidator(),
      frameworkConsistencyChecker:
        this.advancedPipeline.getFrameworkConsistencyChecker(),
      eventNormalizer: this.advancedPipeline.getEventNormalizer(),
    };
  }

  /**
   * Get enhanced processing pipeline.
   */
  getPipeline(): ProcessingPipeline {
    return this.advancedPipeline;
  }
}
