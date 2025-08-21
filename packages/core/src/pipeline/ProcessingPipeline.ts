/**
 * Processing pipeline orchestrator for the concept-driven extension system.
 */

import type { ComponentConcept } from '../concepts';
import type { FrameworkExtension, StylingExtension, UtilityExtension } from '../extensions';
import { ExtensionRegistry } from '../registry/ExtensionRegistry';
import { TemplateAnalyzer } from '../analyzer/TemplateAnalyzer';
import { ErrorCollector, PerformanceTracker } from '../metadata';

/**
 * Template node interface (avoiding circular dependency).
 */
interface TemplateNode {
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
 * Processing options for the pipeline.
 */
export interface ProcessingOptions {
  /** Active framework extension key */
  framework?: string;
  /** Active styling extension key */
  styling?: string;
  /** Active utility extension keys */
  utilities?: string[];
  /** Component metadata */
  component?: {
    name?: string;
    props?: Record<string, string>;
    imports?: string[];
    [key: string]: any;
  };
  /** Additional context */
  [key: string]: any;
}

/**
 * Active extensions for processing.
 */
export interface ActiveExtensions {
  /** Framework extension */
  framework?: FrameworkExtension;
  /** Styling extension */
  styling?: StylingExtension;
  /** Utility extensions */
  utilities: UtilityExtension[];
}

/**
 * Processed concepts after extension processing.
 */
export interface ProcessedConcepts {
  /** Processed events */
  events: any; // FrameworkEventOutput
  /** Processed styling */
  styling: any; // StyleOutput | null
  /** Processed conditionals */
  conditionals: any; // FrameworkConditionalOutput
  /** Processed iterations */
  iterations: any; // FrameworkIterationOutput
  /** Processed slots */
  slots: any; // FrameworkSlotOutput
  /** Processed attributes */
  attributes: any; // FrameworkAttributeOutput
}

/**
 * Processing result.
 */
export interface ProcessingResult {
  /** Final rendered output */
  output: string;
  /** Processed concepts */
  concepts: ProcessedConcepts;
  /** Processing metadata */
  metadata: ProcessingMetadata;
  /** Collected errors and warnings */
  errors: ErrorCollector;
  /** Performance metrics */
  performance: any; // PerformanceMetrics
}

/**
 * Processing metadata.
 */
export interface ProcessingMetadata {
  /** Extensions used */
  extensionsUsed: string[];
  /** Concepts found */
  conceptsFound: {
    events: number;
    styling: boolean;
    conditionals: number;
    iterations: number;
    slots: number;
    attributes: number;
  };
  /** Processing timestamp */
  timestamp: Date;
}

/**
 * Main processing pipeline orchestrator.
 */
export class ProcessingPipeline {
  private registry: ExtensionRegistry;
  private analyzer: TemplateAnalyzer;
  private errorCollector: ErrorCollector;
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
  }

  /**
   * Main processing method that orchestrates the entire flow.
   */
  async process(
    template: TemplateNode[],
    options: ProcessingOptions
  ): Promise<ProcessingResult> {
    this.performanceTracker.start();
    this.errorCollector.clear();
    this.analyzer.clearErrors();

    try {
      // Step 1: Analyze template and extract concepts
      this.performanceTracker.startExtension('analyzer');
      const concepts = this.analyzer.extractConcepts(template);
      this.performanceTracker.endExtension('analyzer');

      // Merge analyzer errors
      const analyzerErrors = this.analyzer.getErrors();
      analyzerErrors.getErrors().forEach(error => this.errorCollector.addError(error));

      // Step 2: Get active extensions
      const activeExtensions = this.getActiveExtensions(options);

      // Step 3: Process concepts with extensions
      const processedConcepts = await this.processConcepts(concepts, activeExtensions);

      // Step 4: Render final output
      const output = await this.renderOutput(processedConcepts, activeExtensions, options);

      // Step 5: Generate metadata
      const metadata = this.generateMetadata(concepts, activeExtensions);

      return {
        output,
        concepts: processedConcepts,
        metadata,
        errors: this.errorCollector,
        performance: this.performanceTracker.getMetrics()
      };

    } catch (error) {
      this.errorCollector.addSimpleError(
        `Pipeline processing failed: ${error instanceof Error ? error.message : String(error)}`,
        'root',
        'pipeline'
      );

      // Return error result
      return {
        output: '',
        concepts: this.createEmptyProcessedConcepts(),
        metadata: this.generateEmptyMetadata(),
        errors: this.errorCollector,
        performance: this.performanceTracker.getMetrics()
      };
    }
  }

  /**
   * Get active extensions based on options.
   */
  private getActiveExtensions(options: ProcessingOptions): ActiveExtensions {
    const activeExtensions: ActiveExtensions = {
      utilities: []
    };

    // Get framework extension
    if (options.framework) {
      const framework = this.registry.getFramework(options.framework);
      if (framework) {
        activeExtensions.framework = framework;
      } else {
        this.errorCollector.addWarning(
          `Framework extension '${options.framework}' not found`,
          'root',
          'pipeline'
        );
      }
    }

    // Get styling extension
    if (options.styling) {
      const styling = this.registry.getStyling(options.styling);
      if (styling) {
        activeExtensions.styling = styling;
      } else {
        this.errorCollector.addWarning(
          `Styling extension '${options.styling}' not found`,
          'root',
          'pipeline'
        );
      }
    }

    // Get utility extensions
    if (options.utilities) {
      for (const utilityKey of options.utilities) {
        const utility = this.registry.getUtility(utilityKey);
        if (utility) {
          activeExtensions.utilities.push(utility);
        } else {
          this.errorCollector.addWarning(
            `Utility extension '${utilityKey}' not found`,
            'root',
            'pipeline'
          );
        }
      }
    }

    return activeExtensions;
  }

  /**
   * Process concepts with active extensions.
   */
  private async processConcepts(
    concepts: ComponentConcept,
    extensions: ActiveExtensions
  ): Promise<ProcessedConcepts> {
    const processed: ProcessedConcepts = {
      events: null,
      styling: null,
      conditionals: null,
      iterations: null,
      slots: null,
      attributes: null
    };

    // Process with utility extensions first (they modify concepts)
    let modifiedConcepts = concepts;
    for (const utility of extensions.utilities) {
      this.performanceTracker.startExtension(utility.metadata.key);
      try {
        modifiedConcepts = utility.process(modifiedConcepts);
        this.performanceTracker.incrementConceptCount();
      } catch (error) {
        this.errorCollector.addSimpleError(
          `Utility extension '${utility.metadata.key}' failed: ${error instanceof Error ? error.message : String(error)}`,
          'root',
          utility.metadata.key
        );
      }
      this.performanceTracker.endExtension(utility.metadata.key);
    }

    // Process with framework extension
    if (extensions.framework) {
      const framework = extensions.framework;
      this.performanceTracker.startExtension(framework.metadata.key);

      try {
        processed.events = framework.processEvents(modifiedConcepts.events);
        processed.conditionals = framework.processConditionals(modifiedConcepts.conditionals);
        processed.iterations = framework.processIterations(modifiedConcepts.iterations);
        processed.slots = framework.processSlots(modifiedConcepts.slots);
        processed.attributes = framework.processAttributes(modifiedConcepts.attributes);
        
        // Count concepts processed
        this.performanceTracker.incrementConceptCount();
      } catch (error) {
        this.errorCollector.addSimpleError(
          `Framework extension '${framework.metadata.key}' failed: ${error instanceof Error ? error.message : String(error)}`,
          'root',
          framework.metadata.key
        );
      }

      this.performanceTracker.endExtension(framework.metadata.key);
    }

    // Process with styling extension
    if (extensions.styling) {
      const styling = extensions.styling;
      this.performanceTracker.startExtension(styling.metadata.key);

      try {
        processed.styling = styling.processStyles(modifiedConcepts.styling);
        this.performanceTracker.incrementConceptCount();
      } catch (error) {
        this.errorCollector.addSimpleError(
          `Styling extension '${styling.metadata.key}' failed: ${error instanceof Error ? error.message : String(error)}`,
          'root',
          styling.metadata.key
        );
      }

      this.performanceTracker.endExtension(styling.metadata.key);
    }

    return processed;
  }

  /**
   * Render final output using the framework extension.
   */
  private async renderOutput(
    processedConcepts: ProcessedConcepts,
    extensions: ActiveExtensions,
    options: ProcessingOptions
  ): Promise<string> {
    if (!extensions.framework) {
      this.errorCollector.addWarning('No framework extension available for rendering', 'root', 'pipeline');
      return '';
    }

    const framework = extensions.framework;
    this.performanceTracker.startExtension(`${framework.metadata.key}-render`);

    try {
      // Reconstruct component concept for rendering
      const conceptsForRendering: ComponentConcept = {
        events: [], // Events are already processed into framework-specific format
        styling: { // Use original styling concept structure
          nodeId: 'root',
          staticClasses: [],
          dynamicClasses: [],
          inlineStyles: {},
          styleBindings: {}
        },
        conditionals: [],
        iterations: [],
        slots: [],
        attributes: [],
        metadata: options.component || {}
      };

      const renderContext = {
        component: options.component,
        options: options,
        processedConcepts: processedConcepts
      };

      const output = framework.renderComponent(conceptsForRendering, renderContext);
      this.performanceTracker.endExtension(`${framework.metadata.key}-render`);
      
      return output;
    } catch (error) {
      this.errorCollector.addSimpleError(
        `Framework rendering failed: ${error instanceof Error ? error.message : String(error)}`,
        'root',
        framework.metadata.key
      );
      this.performanceTracker.endExtension(`${framework.metadata.key}-render`);
      return '';
    }
  }

  /**
   * Generate processing metadata.
   */
  private generateMetadata(
    concepts: ComponentConcept,
    extensions: ActiveExtensions
  ): ProcessingMetadata {
    const extensionsUsed: string[] = [];
    
    if (extensions.framework) {
      extensionsUsed.push(extensions.framework.metadata.key);
    }
    if (extensions.styling) {
      extensionsUsed.push(extensions.styling.metadata.key);
    }
    extensions.utilities.forEach(utility => {
      extensionsUsed.push(utility.metadata.key);
    });

    return {
      extensionsUsed,
      conceptsFound: {
        events: concepts.events.length,
        styling: concepts.styling.staticClasses.length > 0 || 
                 concepts.styling.dynamicClasses.length > 0 || 
                 Object.keys(concepts.styling.inlineStyles).length > 0,
        conditionals: concepts.conditionals.length,
        iterations: concepts.iterations.length,
        slots: concepts.slots.length,
        attributes: concepts.attributes.length
      },
      timestamp: new Date()
    };
  }

  /**
   * Create empty processed concepts.
   */
  private createEmptyProcessedConcepts(): ProcessedConcepts {
    return {
      events: null,
      styling: null,
      conditionals: null,
      iterations: null,
      slots: null,
      attributes: null
    };
  }

  /**
   * Generate empty metadata for error cases.
   */
  private generateEmptyMetadata(): ProcessingMetadata {
    return {
      extensionsUsed: [],
      conceptsFound: {
        events: 0,
        styling: false,
        conditionals: 0,
        iterations: 0,
        slots: 0,
        attributes: 0
      },
      timestamp: new Date()
    };
  }

  /**
   * Get error collector for external access.
   */
  getErrorCollector(): ErrorCollector {
    return this.errorCollector;
  }

  /**
   * Get performance tracker for external access.
   */
  getPerformanceTracker(): PerformanceTracker {
    return this.performanceTracker;
  }
}