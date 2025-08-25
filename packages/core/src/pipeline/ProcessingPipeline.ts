/**
 * Advanced Processing Pipeline
 *
 * Integrates advanced processors with the ProcessingPipeline:
 * - ComponentPropertyProcessor for template property merging
 * - Advanced extractors for comprehensive concept extraction
 * - ConceptValidator for comprehensive validation
 * - EventNormalizer for cross-framework consistency
 */

import { ExtensionRegistry } from '../registry/ExtensionRegistry';
import { TemplateAnalyzer } from '../analyzer/TemplateAnalyzer';
import { ErrorCollector, PerformanceTracker } from '../metadata';

// advanced processing processors
import {
  ComponentPropertyProcessor,
  ImportProcessor,
  ScriptMergeProcessor,
  ComponentNameResolver,
  type ComponentResolutionStrategy,
  type ComponentDefinition,
  DEFAULT_MERGE_STRATEGIES,
} from '../processors';

import { EventExtractor, StylingExtractor } from '../extractors';

import {
  ConceptValidator,
  FrameworkConsistencyChecker,
  type ValidationOptions,
  type ValidationResult,
} from '../validation';

import {
  EventNormalizer,
  type EventNormalizationOptions,
} from '../normalization';

import type { ComponentConcept } from '../concepts';

/**
 * Processing options for template processing pipeline.
 */
export interface ProcessingOptions {
  /** Target framework */
  framework?: string;
  /** Extensions to use */
  extensions?: string[];
  /** Component metadata */
  component?: any;
  /** Component property merge strategies */
  mergeStrategies?: ComponentResolutionStrategy;
  /** Validation options */
  validation?: ValidationOptions;
  /** Event normalization options */
  eventNormalization?: EventNormalizationOptions;
  /** Advanced extraction options */
  extraction?: {
    useEventExtractor?: boolean;
    useStylingExtractor?: boolean;
    normalizeEvents?: boolean;
    validateConcepts?: boolean;
  };
  /** Component definition for property merging */
  componentDefinition?: ComponentDefinition;
}

/**
 * Result from template processing pipeline.
 */
export interface ProcessingResult {
  /** Generated output */
  output: string;
  /** Processing errors */
  errors: ErrorCollector;
  /** Processing metadata */
  metadata: {
    /** Processing time in milliseconds */
    processingTime: number;
    /** Extensions used */
    extensionsUsed: string[];
    /** Performance metrics */
    performance: Record<string, number>;
  };
  /** Validation results */
  validation?: ValidationResult;
  /** Component properties after merging */
  componentProperties?: any;
  /** Framework consistency report */
  consistencyReport?: any;
  /** Advanced processing metadata */
  advancedMetadata?: {
    /** Whether processing was used */
    processing: boolean;
    /** Processors used */
    processorsUsed: string[];
    /** Validation score */
    validationScore?: number;
    /** Events normalized count */
    eventsNormalized: number;
    /** Properties merged */
    propertiesMerged: boolean;
  };
}

/**
 * Processing pipeline with comprehensive features.
 */
export class ProcessingPipeline {
  private registry: ExtensionRegistry;
  private analyzer: TemplateAnalyzer;
  private errorCollector: ErrorCollector;
  private componentPropertyProcessor: ComponentPropertyProcessor;
  private importProcessor: ImportProcessor;
  private scriptMergeProcessor: ScriptMergeProcessor;
  private componentNameResolver: ComponentNameResolver;
  private eventExtractor: EventExtractor;
  private stylingExtractor: StylingExtractor;
  private conceptValidator: ConceptValidator;
  private frameworkConsistencyChecker: FrameworkConsistencyChecker;
  private eventNormalizer: EventNormalizer;
  private advancedErrorCollector: ErrorCollector;
  private performanceTracker: PerformanceTracker;

  constructor(
    registry: ExtensionRegistry,
    analyzer?: TemplateAnalyzer,
    errorCollector?: ErrorCollector
  ) {
    this.registry = registry;
    this.analyzer = analyzer || new TemplateAnalyzer();
    this.errorCollector = errorCollector || new ErrorCollector();
    this.performanceTracker = new PerformanceTracker();

    // Initialize advanced processors
    this.advancedErrorCollector = new ErrorCollector();
    this.componentPropertyProcessor = new ComponentPropertyProcessor(
      DEFAULT_MERGE_STRATEGIES,
      this.advancedErrorCollector
    );
    this.importProcessor = new ImportProcessor(this.advancedErrorCollector);
    this.scriptMergeProcessor = new ScriptMergeProcessor(
      this.advancedErrorCollector
    );
    this.componentNameResolver = new ComponentNameResolver(
      this.advancedErrorCollector
    );
    this.eventExtractor = new EventExtractor(this.advancedErrorCollector);
    this.stylingExtractor = new StylingExtractor(this.advancedErrorCollector);
    this.conceptValidator = new ConceptValidator(this.advancedErrorCollector);
    this.frameworkConsistencyChecker = new FrameworkConsistencyChecker(
      this.advancedErrorCollector
    );
    this.eventNormalizer = new EventNormalizer(
      undefined,
      this.advancedErrorCollector
    );
  }

  /**
   * Advanced processing method with comprehensive features.
   */
  async process(
    template: any[], // TemplateNode[]
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    this.performanceTracker.start();

    this.advancedErrorCollector.clear();
    const processorsUsed: string[] = [];
    let eventsNormalized = 0;
    let propertiesMerged = false;

    try {
      // Step 1: Process component properties if definition provided
      let componentProperties;
      if (options.componentDefinition) {
        this.performanceTracker.startExtension('component-property-processor');
        processorsUsed.push('ComponentPropertyProcessor');

        // Update merge strategies if provided
        if (options.mergeStrategies) {
          this.componentPropertyProcessor = new ComponentPropertyProcessor(
            options.mergeStrategies,
            this.advancedErrorCollector
          );
        }

        const renderOptions = {
          framework: options.framework || 'react',
          component: options.component,
        };

        componentProperties =
          this.componentPropertyProcessor.mergeComponentProperties(
            options.componentDefinition,
            renderOptions
          );
        propertiesMerged = true;

        // Update options with merged component name
        if (!options.component?.name && componentProperties.name) {
          options.component = {
            ...options.component,
            name: componentProperties.name,
          };
        }

        this.performanceTracker.endExtension('component-property-processor');
      }

      // Step 2: Enhanced concept extraction if enabled
      let concepts: ComponentConcept;

      if (
        options.extraction?.useEventExtractor ||
        options.extraction?.useStylingExtractor
      ) {
        this.performanceTracker.startExtension('enhanced-extraction');

        // Use base analyzer for initial extraction
        concepts = this.analyzer.extractConcepts(template);

        // Enhance events if requested
        if (options.extraction.useEventExtractor) {
          processorsUsed.push('EventExtractor');
          const eventExtractionOptions = {
            framework: options.framework as 'vue' | 'react' | 'svelte',
            normalizeEvents: options.extraction.normalizeEvents ?? true,
            validateEvents: options.extraction.validateConcepts ?? true,
          };

          const eventResult = this.eventExtractor.extractEvents(
            template,
            eventExtractionOptions
          );
          concepts.events = eventResult.events;
          eventsNormalized = eventResult.normalizedCount;
        }

        // Enhance styling if requested
        if (options.extraction.useStylingExtractor) {
          processorsUsed.push('StylingExtractor');
          const stylingExtractionOptions = {
            framework: options.framework as 'vue' | 'react' | 'svelte',
            validateCSS: options.extraction.validateConcepts ?? true,
            cssFrameworkDetection: true,
          };

          const stylingResult = this.stylingExtractor.extractStyling(
            template,
            stylingExtractionOptions
          );
          concepts.styling = stylingResult.styling;
        }

        this.performanceTracker.endExtension('enhanced-extraction');
      } else {
        // Use standard extraction
        concepts = this.analyzer.extractConcepts(template);
      }

      // Step 3: Event normalization if enabled
      if (options.extraction?.normalizeEvents && options.framework) {
        this.performanceTracker.startExtension('event-normalization');
        processorsUsed.push('EventNormalizer');

        const normalizationOptions: EventNormalizationOptions = {
          framework: options.framework as 'vue' | 'react' | 'svelte',
          validateEvents: true,
          ...options.eventNormalization,
        };

        const normalizedEvents = this.eventNormalizer.normalizeEvents(
          concepts.events,
          normalizationOptions
        );
        eventsNormalized += normalizedEvents.filter(
          (ne) => ne.wasNormalized
        ).length;

        // Update concepts with normalized events
        concepts.events = normalizedEvents.map((ne) => ({
          ...ne.original,
          name: ne.commonName,
          modifiers: ne.modifiers,
        }));

        this.performanceTracker.endExtension('event-normalization');
      }

      // Step 4: Concept validation if enabled
      let validation: ValidationResult | undefined;
      if (options.extraction?.validateConcepts) {
        this.performanceTracker.startExtension('concept-validation');
        processorsUsed.push('ConceptValidator');

        const validationOptions: ValidationOptions = {
          framework: options.framework as 'vue' | 'react' | 'svelte',
          checkAccessibility: true,
          checkPerformance: true,
          checkBestPractices: true,
          enableCrossConceptValidation: true,
          ...options.validation,
        };

        validation = this.conceptValidator.validateComponent(
          concepts,
          validationOptions
        );
        this.performanceTracker.endExtension('concept-validation');
      }

      // Step 5: Framework consistency check if multiple frameworks need to be supported
      let consistencyReport;
      if (options.validation?.enableCrossConceptValidation) {
        this.performanceTracker.startExtension('consistency-check');
        processorsUsed.push('FrameworkConsistencyChecker');

        consistencyReport =
          this.frameworkConsistencyChecker.checkConsistency(concepts);
        this.performanceTracker.endExtension('consistency-check');
      }

      // Step 6: Process with base pipeline
      const baseResult = await this.processTemplate(template, options);

      // Step 7: Merge advanced processing errors with base errors
      const mergedErrors = this.mergeErrorCollectors(
        baseResult.errors,
        this.advancedErrorCollector
      );

      // Step 8: Create enhanced result
      const enhancedResult: ProcessingResult = {
        ...baseResult,
        errors: mergedErrors,
        validation,
        componentProperties,
        consistencyReport,
        advancedMetadata: {
          processing: true,
          processorsUsed,
          validationScore: validation?.score,
          eventsNormalized,
          propertiesMerged,
        },
      };

      return enhancedResult;
    } catch (error) {
      this.advancedErrorCollector.addSimpleError(
        `Enhanced pipeline processing failed: ${error instanceof Error ? error.message : String(error)}`,
        'root',
        'enhanced-pipeline'
      );

      // Return enhanced error result
      const baseResult = await this.processTemplate(template, options);
      return {
        ...baseResult,
        errors: this.mergeErrorCollectors(
          baseResult.errors,
          this.advancedErrorCollector
        ),
        advancedMetadata: {
          processing: false,
          processorsUsed,
          eventsNormalized: 0,
          propertiesMerged: false,
        },
      };
    }
  }

  /**
   * Core template processing pipeline implementation.
   */
  private async processTemplate(
    template: any[],
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const extensionsUsed: string[] = [];
    this.errorCollector.clear();

    try {
      // Extract concepts using analyzer
      const concepts = this.analyzer.extractConcepts(template);

      // Process styling extensions generically by type
      let processedConcepts = concepts;
      if (options.extensions?.length) {
        for (const extensionKey of options.extensions) {
          const stylingExtension = this.registry.getStyling(extensionKey);
          if (stylingExtension) {
            extensionsUsed.push(extensionKey);
            const styleResult = stylingExtension.processStyles(concepts.styling);
            // Update concepts with processed styling
            processedConcepts.styling = styleResult.updatedStyling || processedConcepts.styling;
            // Add style output to context
            (options as any).styleOutput = styleResult.styles;
          }
        }
      }

      // Get framework extension if specified
      let output = '';
      if (options.framework) {
        const frameworkExtension = this.registry.getFramework(options.framework);
        if (frameworkExtension) {
          extensionsUsed.push(options.framework);
          
          // Render component using framework extension with processed concepts
          const renderContext = {
            component: options.component,
            options: options,
            concepts: processedConcepts,
            styleOutput: (options as any).styleOutput
          };
          output = frameworkExtension.renderComponent(processedConcepts, renderContext);
        } else {
          this.errorCollector.addError({
            message: `Framework extension '${options.framework}' not found`,
            nodeId: 'root',
            extension: 'pipeline',
            severity: 'error'
          });
        }
      }

      // If no framework specified or extension not found, create basic output
      if (!output) {
        output = this.createBasicOutput(template);
      }

      const processingTime = Date.now() - startTime;

      return {
        output,
        errors: this.errorCollector,
        metadata: {
          processingTime,
          extensionsUsed,
          performance: { total: processingTime }
        }
      };
    } catch (error) {
      this.errorCollector.addError({
        message: `Template processing failed: ${error instanceof Error ? error.message : String(error)}`,
        nodeId: 'root',
        extension: 'pipeline',
        severity: 'error'
      });

      const processingTime = Date.now() - startTime;
      return {
        output: '',
        errors: this.errorCollector,
        metadata: {
          processingTime,
          extensionsUsed,
          performance: { total: processingTime }
        }
      };
    }
  }

  /**
   * Create basic output from template nodes when no framework extension is available.
   */
  private createBasicOutput(template: any[]): string {
    return template.map(node => {
      if (typeof node === 'string') return node;
      if (node.type === 'text') return node.content || '';
      if (node.type === 'element') {
        const tag = node.tag || 'div';
        const attrs = node.attributes ? 
          Object.entries(node.attributes)
            .map(([key, value]) => `${key}="${value}"`)
            .join(' ') : '';
        const children = node.children ? 
          this.createBasicOutput(node.children) : '';
        return `<${tag}${attrs ? ' ' + attrs : ''}>${children}</${tag}>`;
      }
      return '';
    }).join('');
  }

  /**
   * Process with automatic advanced processing feature detection.
   */
  async processWithAutoEnhancement(
    template: any[], // TemplateNode[]
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    // Auto-enable advanced processing features based on template complexity and options
    const enhancedOptions: ProcessingOptions = {
      ...options,
      extraction: {
        useEventExtractor: this.shouldUseEventExtractor(template),
        useStylingExtractor: this.shouldUseStylingExtractor(template),
        normalizeEvents: !!options.framework,
        validateConcepts: true,
      },
      validation: {
        framework: options.framework as 'vue' | 'react' | 'svelte',
        checkAccessibility: true,
        checkPerformance: true,
        checkBestPractices: true,
        enableCrossConceptValidation: true,
      },
    };

    return this.process(template, enhancedOptions);
  }

  /**
   * Create component properties example for date/dayjs scenario.
   */
  createDateComponentExample(): {
    definition: ComponentDefinition;
    options: ProcessingOptions;
    result: any; // ComponentProperties
  } {
    const definition: ComponentDefinition = {
      common: {
        name: 'DateComponent',
        imports: [{ from: 'dayjs', default: 'dayjs' }],
        script: `const formatDate = (date) => dayjs(date).format('YYYY-MM-DD');
const twoDaysFromDate = (date) => dayjs(date).add(2, 'day').toDate();`,
        props: {
          date: 'Date',
          title: 'string',
        },
      },
      framework: {
        imports: [{ from: 'react', named: ['useState', 'useEffect'] }],
        script: `const [date, setDate] = useState(initialDate);
useEffect(() => console.log('Date changed:', date), [date]);
const onDateChange = (newDate) => setDate(newDate);`,
        props: {
          onDateChange: '(date: Date) => void',
        },
      },
    };

    const options: ProcessingOptions = {
      framework: 'react',
      componentDefinition: definition,
      mergeStrategies: {
        script: { mode: 'merge', includeComments: true },
        props: { mode: 'merge', conflictResolution: 'warn' },
        imports: { mode: 'merge', deduplication: true, grouping: true },
      },
    };

    const renderOptions = { framework: 'react', component: {} };
    const result = this.componentPropertyProcessor.mergeComponentProperties(
      definition,
      renderOptions
    );

    return { definition, options, result };
  }

  /**
   * Helper method to determine if enhanced event extraction should be used.
   */
  private shouldUseEventExtractor(template: any[]): boolean {
    // Use enhanced extractor if template has complex event patterns
    const templateStr = JSON.stringify(template);
    return (
      templateStr.includes('@') ||
      templateStr.includes('on:') ||
      templateStr.includes('onClick')
    );
  }

  /**
   * Helper method to determine if enhanced styling extraction should be used.
   */
  private shouldUseStylingExtractor(template: any[]): boolean {
    // Use enhanced extractor if template has complex styling
    const templateStr = JSON.stringify(template);
    return (
      templateStr.includes('class') ||
      templateStr.includes('style') ||
      templateStr.includes('className')
    );
  }

  /**
   * Merge error collectors from base and advanced processing processing.
   */
  private mergeErrorCollectors(
    baseErrors: ErrorCollector,
    advancedErrors: ErrorCollector
  ): ErrorCollector {
    const merged = new ErrorCollector();

    // Copy base errors
    baseErrors.getErrors().forEach((error) => merged.addError(error));
    baseErrors
      .getErrorsBySeverity('warning')
      .forEach((warning) =>
        merged.addWarning(warning.message, warning.nodeId, warning.extension)
      );

    // Copy advanced processing errors
    advancedErrors.getErrors().forEach((error) => merged.addError(error));
    advancedErrors
      .getErrorsBySeverity('warning')
      .forEach((warning) =>
        merged.addWarning(warning.message, warning.nodeId, warning.extension)
      );

    return merged;
  }

  /**
   * Get access to advanced processing processors for external use.
   */
  getComponentPropertyProcessor(): ComponentPropertyProcessor {
    return this.componentPropertyProcessor;
  }

  getImportProcessor(): ImportProcessor {
    return this.importProcessor;
  }

  getScriptMergeProcessor(): ScriptMergeProcessor {
    return this.scriptMergeProcessor;
  }

  getComponentNameResolver(): ComponentNameResolver {
    return this.componentNameResolver;
  }

  getEventExtractor(): EventExtractor {
    return this.eventExtractor;
  }

  getStylingExtractor(): StylingExtractor {
    return this.stylingExtractor;
  }

  getConceptValidator(): ConceptValidator {
    return this.conceptValidator;
  }

  getFrameworkConsistencyChecker(): FrameworkConsistencyChecker {
    return this.frameworkConsistencyChecker;
  }

  getEventNormalizer(): EventNormalizer {
    return this.eventNormalizer;
  }

  /**
   * Get advanced processing error collector.
   */
  getAdvancedErrorCollector(): ErrorCollector {
    return this.advancedErrorCollector;
  }

  /**
   * Get analyzer for external access.
   */
  getAnalyzer(): TemplateAnalyzer {
    return this.analyzer;
  }

}
