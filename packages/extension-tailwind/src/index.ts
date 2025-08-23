import { createLogger, getExtensionOptions } from '@js-template-engine/core';
import type {
  TemplateNode,
  Extension,
  DeepPartial,
  BaseExtensionOptions,
} from '@js-template-engine/types';
import type {
  StylingExtension,
  ExtensionMetadata,
  FrameworkExtension,
  StylingConcept,
  ComponentConcept,
  RenderContext,
  StyleOutput
} from '@js-template-engine/core';
import {
  EventNormalizer,
  ComponentPropertyProcessor, 
  ScriptMergeProcessor,
  ImportProcessor,
  DEFAULT_MERGE_STRATEGIES
} from '@js-template-engine/core';
import type { ScriptMergeStrategy } from '@js-template-engine/core';
import { UtilityParser } from './parsers/UtilityParser';
import { CssGenerator } from './generators/CssGenerator';
import { TailwindProcessor } from './services/TailwindProcessor';
import type { TailwindExtensionOptions, TailwindNodeExtensions, ParsedUtility } from './types';

/**
 * Tailwind Extension
 * 
 * Provides bi-directional conversion between Tailwind utility classes and CSS styles.
 */
export class TailwindExtension
  implements Extension<TailwindExtensionOptions, TailwindNodeExtensions>, StylingExtension
{
  /** Extension metadata */
  public metadata: ExtensionMetadata & { type: 'styling' } = {
    type: 'styling',
    key: 'tailwind',
    name: 'Tailwind Extension',
    version: '1.0.0'
  };

  /** Styling approach */
  public styling = 'tailwind' as const;

  /** Extension key */
  public readonly key = 'tailwind' as const;

  /** Logger instance */
  private logger: ReturnType<typeof createLogger>;

  /** Whether this extension is a renderer */
  isRenderer = false;

  /** Extension options */
  options: TailwindExtensionOptions = {
    outputStrategy: 'css',
    unknownClassHandling: 'warn',
    cssFallback: 'custom-class',
    customClassPrefix: 'custom'
  };

  /** Tailwind processor */
  private tailwindProcessor: TailwindProcessor;

  /** Utility parser */
  private utilityParser: UtilityParser;

  /** CSS generator */
  private cssGenerator: CssGenerator;

  /** Event normalizer */
  private eventNormalizer = new EventNormalizer();

  /** Property processor */
  private propertyProcessor: ComponentPropertyProcessor;

  /** Script merger */
  private scriptMerger: ScriptMergeProcessor;

  /** Import processor */
  private importProcessor = new ImportProcessor();

  /** Script merge strategy */
  private scriptMergeStrategy: ScriptMergeStrategy = DEFAULT_MERGE_STRATEGIES.script;

  /**
   * Creates a new Tailwind extension instance.
   * @param verbose - If true, enables verbose logging.
   */
  constructor(verbose = false, tailwindConfig?: any) {
    this.logger = createLogger(verbose, 'TailwindExtension');
    
    this.tailwindProcessor = new TailwindProcessor(tailwindConfig);
    this.utilityParser = new UtilityParser(this.tailwindProcessor);
    this.cssGenerator = new CssGenerator(this.tailwindProcessor);
    
    this.propertyProcessor = new ComponentPropertyProcessor({
      script: this.scriptMergeStrategy,
      props: DEFAULT_MERGE_STRATEGIES.props,
      imports: DEFAULT_MERGE_STRATEGIES.imports
    });

    this.scriptMerger = new ScriptMergeProcessor();
  }

  /**
   * Process template nodes for Tailwind classes.
   * @param template - Template nodes to process
   * @param context - Render context
   * @returns Processed template nodes
   */
  processTemplate(
    template: TemplateNode[], 
    context: RenderContext
  ): TemplateNode[] {
    return template.map(node => this.processNode(node, context));
  }

  /**
   * Process a single template node.
   * @param node - Template node to process
   * @param context - Render context
   * @returns Processed template node
   */
  private processNode(
    node: TemplateNode,
    context: RenderContext
  ): TemplateNode {
    if (node.type !== 'element' && node.type !== undefined) {
      return node;
    }

    const processedNode = { ...node };
    const tailwindExtensions = getExtensionOptions<TailwindNodeExtensions>(node, 'tailwind');
    
    if (tailwindExtensions) {
      const classes = this.extractTailwindClasses(tailwindExtensions);
      const processedClasses = this.processTailwindClasses(classes);
      
      // Update node attributes with processed classes
      processedNode.attributes = {
        ...processedNode.attributes,
        class: processedClasses.join(' ')
      };
    }

    // Process children recursively
    if (processedNode.children) {
      processedNode.children = processedNode.children.map(child => 
        this.processNode(child, context)
      );
    }

    return processedNode;
  }

  /**
   * Extract Tailwind classes from node extensions.
   * @param extensions - Tailwind node extensions
   * @returns Array of class names
   */
  private extractTailwindClasses(extensions: TailwindNodeExtensions): string[] {
    const classes: string[] = [];
    
    if (extensions.class) {
      if (Array.isArray(extensions.class)) {
        classes.push(...extensions.class);
      } else {
        classes.push(...extensions.class.split(/\s+/));
      }
    }

    if (extensions.responsive) {
      for (const [breakpoint, breakpointClasses] of Object.entries(extensions.responsive)) {
        if (breakpointClasses) {
          const classArray = Array.isArray(breakpointClasses) 
            ? breakpointClasses 
            : breakpointClasses.split(/\s+/);
          
          classes.push(...classArray.map(cls => `${breakpoint}:${cls}`));
        }
      }
    }

    if (extensions.variants) {
      for (const [variant, variantClasses] of Object.entries(extensions.variants)) {
        if (variantClasses) {
          const classArray = Array.isArray(variantClasses) 
            ? variantClasses 
            : variantClasses.split(/\s+/);
          
          classes.push(...classArray.map(cls => `${variant}:${cls}`));
        }
      }
    }

    return classes;
  }

  /**
   * Process Tailwind classes based on output strategy.
   * @param classes - Array of Tailwind classes
   * @returns Processed classes
   */
  private processTailwindClasses(classes: string[]): string[] {
    if (this.options.outputStrategy === 'pass-through') {
      return classes;
    }

    // For CSS and SCSS output strategies, we still return the original classes
    // The actual CSS generation happens in processStyles method
    return classes;
  }

  /**
   * Process styling concepts from Tailwind classes.
   * @param concept - Styling concept to process
   * @returns Generated style output
   */
  processStyles(concept: StylingConcept): StyleOutput {
    const tailwindClasses = this.extractTailwindClassesFromConcept(concept);
    const utilities = this.utilityParser.parseUtilities(tailwindClasses);
    
    // Since the interface doesn't support async, we'll process synchronously
    // and cache results for performance
    try {
      const result = this.cssGenerator.generateCssFromUtilities(utilities, {
        format: this.options.outputStrategy,
        breakpoints: this.options.breakpoints,
        classPrefix: this.options.customClassPrefix
      });
      
      // If it's a Promise, we need to handle it differently
      if (result instanceof Promise) {
        // For now, return a placeholder and log a warning
        this.logger.warn('Async CSS generation not supported in synchronous interface');
        return {
          styles: utilities.map(u => `/* ${u.original} */`).join('\n'),
          imports: []
        };
      }
      
      return result;
    } catch (error) {
      this.logger.warn('CSS generation failed:', error);
      return {
        styles: utilities.map(u => `/* ${u.original} */`).join('\n'),
        imports: []
      };
    }
  }

  /**
   * Extract Tailwind classes from styling concept (for processStyles method).
   * @param concept - Styling concept
   * @returns Array of Tailwind classes
   */
  private extractTailwindClassesFromConcept(concept: StylingConcept): string[] {
    const classes: string[] = [];
    
    // Extract all static classes for processing
    classes.push(...concept.staticClasses);

    // Extract from dynamic classes
    for (const dynamicClass of concept.dynamicClasses) {
      if (typeof dynamicClass === 'string') {
        classes.push(dynamicClass);
      }
    }

    return classes;
  }

  /**
   * Check if a class name is a Tailwind utility class.
   * @param className - Class name to check
   * @returns True if it's a Tailwind class
   */
  private isTailwindClass(className: string): boolean {
    const validation = this.utilityParser.validateUtility(className);
    return validation.valid;
  }

  /**
   * Check if a class name is a Tailwind utility class using actual Tailwind processing.
   * @param className - Class name to check
   * @returns Promise resolving to whether it's a valid Tailwind class
   */
  private async isTailwindClassAsync(className: string): Promise<boolean> {
    const validation = await this.utilityParser.validateUtilityWithTailwind(className);
    return validation.valid;
  }

  /**
   * Convert Tailwind classes to CSS.
   * @param classes - Tailwind classes to convert
   * @returns Style output with generated CSS
   */
  convertTailwindToCss(classes: string[]): StyleOutput {
    const utilities = this.utilityParser.parseUtilities(classes);
    return this.cssGenerator.generateCssFromUtilities(utilities, {
      format: 'css'
    });
  }

  /**
   * Convert CSS styles to Tailwind classes.
   * @param styles - CSS styles to convert
   * @returns Object with converted classes and remaining styles
   */
  convertCssToTailwind(styles: Record<string, string>): {
    classes: string[];
    remaining: Record<string, string>;
  } {
    // Use synchronous fallback conversion
    const classes: string[] = [];
    const remaining: Record<string, string> = { ...styles };

    // Simple reverse mapping for common properties
    const reverseMap: Record<string, (value: string) => string | null> = {
      'background-color': (value) => {
        const colorMap: Record<string, string> = {
          '#ef4444': 'bg-red-500',
          '#3b82f6': 'bg-blue-500',
          '#2563eb': 'bg-blue-600',
          '#10b981': 'bg-green-500',
          '#ffffff': 'bg-white',
          '#000000': 'bg-black'
        };
        return colorMap[value.toLowerCase()] || null;
      },
      'color': (value) => {
        const colorMap: Record<string, string> = {
          '#ef4444': 'text-red-500',
          '#3b82f6': 'text-blue-500',
          '#ffffff': 'text-white',
          '#000000': 'text-black'
        };
        return colorMap[value.toLowerCase()] || null;
      },
      'display': (value) => {
        const displayMap: Record<string, string> = {
          'flex': 'flex',
          'block': 'block',
          'inline': 'inline',
          'none': 'hidden'
        };
        return displayMap[value] || null;
      },
      'padding': (value) => {
        const spacingMap: Record<string, string> = {
          '0px': 'p-0',
          '0.25rem': 'p-1',
          '0.5rem': 'p-2',
          '0.75rem': 'p-3',
          '1rem': 'p-4',
          '1.25rem': 'p-5',
          '1.5rem': 'p-6',
          '2rem': 'p-8',
          '2.5rem': 'p-10',
          '3rem': 'p-12'
        };
        return spacingMap[value] || null;
      }
    };

    for (const [property, value] of Object.entries(styles)) {
      const converter = reverseMap[property];
      if (converter) {
        const tailwindClass = converter(value);
        if (tailwindClass) {
          classes.push(tailwindClass);
          delete remaining[property];
        }
      }
    }

    return { classes, remaining };
  }


  /**
   * Coordinate Tailwind styling with framework extensions.
   * @param frameworkExtension - Framework extension to coordinate with
   * @param concepts - Component concepts
   * @returns Updated component concepts
   */
  coordinateWithFramework(
    frameworkExtension: FrameworkExtension, 
    concepts: ComponentConcept
  ): ComponentConcept {
    // Process all classes through Tailwind processing
    // This will validate them and handle unknown classes based on configuration
    const processedOutput = this.processClasses(concepts.styling.staticClasses);
    
    // Determine final classes based on unknownClassHandling configuration
    let finalClasses: string[];
    
    if (this.options.unknownClassHandling === 'ignore') {
      // When ignoring unknown classes, only use the processed classes (which filters out unknown ones)
      finalClasses = [...concepts.styling.staticClasses, ...processedOutput.classes];
      // Remove duplicates by converting to Set and back to array
      finalClasses = Array.from(new Set(finalClasses));
      
      // Filter out classes that were filtered out by processClasses
      const processedSet = new Set(processedOutput.classes);
      finalClasses = finalClasses.filter(cls => processedSet.has(cls) || this.utilityParser.validateUtility(cls).valid);
    } else {
      // For other configurations (warn, error), include both original and processed
      finalClasses = [...concepts.styling.staticClasses, ...processedOutput.classes];
    }
    
    // Update styling concepts with processed classes
    const updatedConcepts = { ...concepts };
    updatedConcepts.styling = {
      ...concepts.styling,
      staticClasses: finalClasses,
    };
    
    return updatedConcepts;
  }

  /**
   * Simple heuristic to check if a class looks like it could be a Tailwind class.
   * @param className - Class name to check
   * @returns True if it looks like a potential Tailwind class
   */
  private looksLikeTailwind(className: string): boolean {
    // Check for common Tailwind patterns
    const tailwindPatterns = [
      /^(bg|text|border|rounded|shadow|p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|w|h|max-w|max-h|min-w|min-h)-/,
      /^(flex|grid|block|hidden|inline|absolute|relative|fixed|sticky)$/,
      /^(top|right|bottom|left|z)-/,
      /^(opacity|scale|rotate|translate|skew|origin)-/,
      /^(overflow|cursor|pointer-events|select|resize)-/,
      /^(font|tracking|leading|list|placeholder|caret|accent)-/,
      /^(appearance|resize|scroll|snap|touch|will-change)-/,
      /^(outline|ring)-/,
      /^(sm|md|lg|xl|2xl):/,
      /:(hover|focus|active|disabled|first|last|odd|even|visited|checked|invalid|required|group-hover|group-focus|focus-within|focus-visible|motion-safe|motion-reduce|dark):/
    ];
    
    return tailwindPatterns.some(pattern => pattern.test(className));
  }

  /**
   * Process classes based on output strategy.
   * @param classes - Classes to process
   * @returns Processed output with classes
   */
  private processClasses(classes: string[]): { classes: string[] } {
    if (this.options.outputStrategy === 'pass-through') {
      return { classes };
    }
    
    // For CSS and SCSS strategies, validate classes and handle unknown ones
    const validatedClasses: string[] = [];
    
    for (const className of classes) {
      // Use synchronous validation 
      const validation = this.utilityParser.validateUtility(className);
      
      if (validation.valid) {
        validatedClasses.push(className);
      } else {
        // Handle unknown classes based on configuration
        switch (this.options.unknownClassHandling) {
          case 'warn':
            this.logger.warn(`Unknown Tailwind class: ${className}`);
            if (this.options.cssFallback === 'custom-class') {
              validatedClasses.push(`${this.options.customClassPrefix}-${className}`);
            }
            break;
          case 'error':
            throw new Error(`Unknown Tailwind class: ${className}`);
          case 'ignore':
            // Do nothing, skip the class
            break;
        }
      }
    }
    
    return { classes: validatedClasses };
  }

  /**
   * Convert between style formats.
   * @param from - Source format
   * @param to - Target format  
   * @returns Converted style output or null
   */
  convertFormat?(from: string, to: string): StyleOutput | null {
    // This would implement bi-directional conversion
    // For now, return null to indicate not implemented
    return null;
  }
}

// Export types
export type { TailwindExtensionOptions, TailwindNodeExtensions, ParsedUtility };
export { UtilityParser, CssGenerator };