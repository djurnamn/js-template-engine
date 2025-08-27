import {
  createLogger,
  getExtensionOptions,
  DEFAULT_MERGE_STRATEGIES,
} from '@js-template-engine/core';
import type { ScriptMergeStrategy } from '@js-template-engine/core';
import type { TemplateNode, Extension } from '@js-template-engine/types';
import type {
  StylingExtension,
  ExtensionMetadata,
  StylingConcept,
  RenderContext,
  StyleOutput,
} from '@js-template-engine/core';
import { UtilityParser } from './parsers/UtilityParser';
import { CssGenerator } from './generators/CssGenerator';
import { TailwindProcessor } from './services/TailwindProcessor';
import type {
  TailwindExtensionOptions,
  TailwindNodeExtensions,
  ParsedUtility,
} from './types';

/**
 * Tailwind CSS styling extension providing comprehensive utility class processing.
 *
 * This extension transforms Tailwind utility classes into CSS styles and vice versa,
 * supporting responsive design, variants, and custom class handling. It integrates
 * with the template processing pipeline to provide production-ready styling output
 * with multiple format options.
 *
 * Key capabilities:
 * - Utility class validation and processing
 * - Responsive breakpoint handling
 * - Pseudo-class variant support
 * - CSS to Tailwind reverse mapping
 * - Multiple output formats (CSS, SCSS, pass-through)
 * - Custom class fallback strategies
 * - Performance-optimized caching
 *
 * @example
 * ```typescript
 * const extension = new TailwindStylingExtension();
 * const registry = new ExtensionRegistry();
 * registry.registerStyling(extension);
 *
 * // Process styling concepts
 * const stylingConcept: StylingConcept = {
 *   nodeId: 'root',
 *   staticClasses: ['bg-blue-500', 'text-white', 'p-4']
 * };
 *
 * const output = extension.processStyles(stylingConcept);
 * console.log(output.styles); // Generated CSS
 *
 * // Convert CSS to Tailwind
 * const { classes, remaining } = extension.convertCssToTailwind({
 *   'background-color': '#3b82f6',
 *   'color': '#ffffff'
 * });
 * console.log(classes); // ['bg-blue-500', 'text-white']
 * ```
 *
 * @since 2.0.0
 */
export class TailwindStylingExtension
  implements
    Extension<TailwindExtensionOptions, TailwindNodeExtensions>,
    StylingExtension
{
  /** Extension metadata */
  public metadata: ExtensionMetadata & { type: 'styling' } = {
    type: 'styling',
    key: 'tailwind',
    name: 'Tailwind Extension',
    version: '2.0.0',
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
    customClassPrefix: 'custom',
  };

  /** Tailwind processor */
  private tailwindProcessor: TailwindProcessor;

  /** Utility parser */
  private utilityParser: UtilityParser;

  /** CSS generator */
  private cssGenerator: CssGenerator;

  /** Script merge strategy */
  private scriptMergeStrategy: ScriptMergeStrategy =
    DEFAULT_MERGE_STRATEGIES.script;

  /**
   * Creates a new TailwindStylingExtension instance with optional configuration.
   *
   * @param verbose - Enables detailed logging for debugging purposes
   * @param tailwindConfig - Optional Tailwind CSS configuration object
   *
   * @example
   * ```typescript
   * // Basic extension
   * const extension = new TailwindStylingExtension();
   *
   * // With custom Tailwind config
   * const extension = new TailwindStylingExtension(false, {
   *   theme: {
   *     colors: { brand: '#123456' },
   *     spacing: { huge: '10rem' }
   *   }
   * });
   *
   * // With verbose logging
   * const extension = new TailwindStylingExtension(true);
   * ```
   */
  constructor(verbose = false, tailwindConfig?: any) {
    this.logger = createLogger(verbose, 'TailwindStylingExtension');

    this.tailwindProcessor = new TailwindProcessor(tailwindConfig);
    this.utilityParser = new UtilityParser(this.tailwindProcessor);
    this.cssGenerator = new CssGenerator(this.tailwindProcessor);
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
    return template.map((node) => this.processNode(node, context));
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
    const tailwindExtensions = getExtensionOptions<TailwindNodeExtensions>(
      node,
      'tailwind'
    );

    if (tailwindExtensions) {
      const classes = this.extractTailwindClasses(tailwindExtensions);
      const processedClasses = this.processTailwindClasses(classes);

      // Update node attributes with processed classes
      processedNode.attributes = {
        ...processedNode.attributes,
        class: processedClasses.join(' '),
      };
    }

    // Process children recursively
    if (processedNode.children) {
      processedNode.children = processedNode.children.map((child) =>
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
      for (const [breakpoint, breakpointClasses] of Object.entries(
        extensions.responsive
      )) {
        if (breakpointClasses) {
          const classArray = Array.isArray(breakpointClasses)
            ? breakpointClasses
            : breakpointClasses.split(/\s+/);

          classes.push(...classArray.map((cls) => `${breakpoint}:${cls}`));
        }
      }
    }

    if (extensions.variants) {
      for (const [variant, variantClasses] of Object.entries(
        extensions.variants
      )) {
        if (variantClasses) {
          const classArray = Array.isArray(variantClasses)
            ? variantClasses
            : variantClasses.split(/\s+/);

          classes.push(...classArray.map((cls) => `${variant}:${cls}`));
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
   * Processes styling concepts containing Tailwind utility classes into CSS output.
   *
   * This is the primary method for converting Tailwind utility classes into CSS styles.
   * It extracts classes from the styling concept, validates them, and generates
   * appropriate CSS output based on the configured output strategy.
   *
   * @param concept - Styling concept containing Tailwind utility classes
   * @returns Style output with generated CSS and any required imports
   *
   * @example
   * ```typescript
   * const stylingConcept: StylingConcept = {
   *   nodeId: 'button-1',
   *   staticClasses: ['bg-blue-500', 'hover:bg-blue-600', 'text-white', 'px-4', 'py-2'],
   *   dynamicClasses: ['${isActive ? "ring-2" : ""}'],
   *   inlineStyles: {}
   * };
   *
   * const output = extension.processStyles(stylingConcept);
   * console.log(output.styles);
   * // Output: CSS for background colors, hover states, text color, padding
   * ```
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
        classPrefix: this.options.customClassPrefix,
      });

      // If it's a Promise, we need to handle it differently
      if (result instanceof Promise) {
        // Return fallback CSS with utility class names as comments
        this.logger.warn(
          'Async CSS generation not supported in synchronous interface'
        );
        return {
          styles: utilities.map((u) => `/* ${u.original} */`).join('\n'),
          imports: [],
        };
      }

      return result;
    } catch (error) {
      this.logger.warn('CSS generation failed:', error);
      return {
        styles: utilities.map((u) => `/* ${u.original} */`).join('\n'),
        imports: [],
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
    const validation =
      await this.utilityParser.validateUtilityWithTailwind(className);
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
      format: 'css',
    });
  }

  /**
   * Converts CSS property-value pairs into equivalent Tailwind utility classes.
   *
   * This method performs reverse mapping from CSS to Tailwind utilities, attempting
   * to find the most appropriate utility classes for given CSS properties. Any
   * properties that cannot be converted remain in the 'remaining' object.
   *
   * @param styles - CSS property-value pairs to convert
   * @returns Object containing converted Tailwind classes and unconverted CSS properties
   *
   * @example
   * ```typescript
   * const cssStyles = {
   *   'background-color': '#3b82f6',
   *   'color': '#ffffff',
   *   'padding': '1rem',
   *   'border-radius': '0.5rem', // Not in simple mapping
   *   'display': 'flex'
   * };
   *
   * const { classes, remaining } = extension.convertCssToTailwind(cssStyles);
   * console.log(classes); // ['bg-blue-500', 'text-white', 'p-4', 'flex']
   * console.log(remaining); // { 'border-radius': '0.5rem' }
   * ```
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
          '#000000': 'bg-black',
        };
        return colorMap[value.toLowerCase()] || null;
      },
      color: (value) => {
        const colorMap: Record<string, string> = {
          '#ef4444': 'text-red-500',
          '#3b82f6': 'text-blue-500',
          '#ffffff': 'text-white',
          '#000000': 'text-black',
        };
        return colorMap[value.toLowerCase()] || null;
      },
      display: (value) => {
        const displayMap: Record<string, string> = {
          flex: 'flex',
          block: 'block',
          inline: 'inline',
          none: 'hidden',
        };
        return displayMap[value] || null;
      },
      padding: (value) => {
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
          '3rem': 'p-12',
        };
        return spacingMap[value] || null;
      },
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
      /:(hover|focus|active|disabled|first|last|odd|even|visited|checked|invalid|required|group-hover|group-focus|focus-within|focus-visible|motion-safe|motion-reduce|dark):/,
    ];

    return tailwindPatterns.some((pattern) => pattern.test(className));
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
              validatedClasses.push(
                `${this.options.customClassPrefix}-${className}`
              );
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
    // Return null to indicate format conversion not available
    return null;
  }
}

// Export types
export type { TailwindExtensionOptions, TailwindNodeExtensions, ParsedUtility };

// Export with alias for backward compatibility
export default TailwindStylingExtension;
export { TailwindStylingExtension as TailwindExtension };
export { UtilityParser, CssGenerator };
