import type { ParsedUtility, ValidationResult } from '../types';
import { TailwindProcessor } from '../services/TailwindProcessor';

/**
 * Parser for Tailwind utility classes.
 */
export class UtilityParser {
  private tailwindProcessor: TailwindProcessor;
  private breakpoints: Record<string, string>;
  private validUtilities: Set<string>;
  private validVariants: Set<string>;

  constructor(tailwindProcessor?: TailwindProcessor) {
    this.tailwindProcessor = tailwindProcessor || new TailwindProcessor();
    this.breakpoints = this.tailwindProcessor.getBreakpoints();
    this.validUtilities = this.tailwindProcessor.getValidUtilityPrefixes();
    this.validVariants = this.tailwindProcessor.getValidVariants();
  }

  /**
   * Parse a single Tailwind utility class.
   * @param className - The class name to parse (e.g., 'md:hover:bg-blue-500')
   * @returns Parsed utility information
   */
  parseUtilityClass(className: string): ParsedUtility {
    const parts = className.split(':');
    const base = parts[parts.length - 1];
    const prefixes = parts.slice(0, -1);

    let responsive: string | undefined;
    const variants: string[] = [];

    // Process prefixes from right to left to handle breakpoint precedence correctly
    for (let i = prefixes.length - 1; i >= 0; i--) {
      const prefix = prefixes[i];
      if (prefix in this.breakpoints && !responsive) {
        responsive = prefix;
      } else if (this.validVariants.has(prefix)) {
        variants.unshift(prefix); // Add to beginning to maintain order
      } else {
        // Still include unknown prefixes for parsing, but they'll fail validation
        variants.unshift(prefix);
      }
    }

    return {
      base,
      responsive,
      variants,
      original: className,
    };
  }

  /**
   * Parse multiple Tailwind utility classes.
   * @param classNames - Array of class names or space-separated string
   * @returns Array of parsed utilities
   */
  parseUtilities(classNames: string | string[]): ParsedUtility[] {
    const classes = Array.isArray(classNames)
      ? classNames.map((c) => c.trim()).filter(Boolean)
      : classNames.split(/\s+/).filter(Boolean);

    return classes.map((className) => this.parseUtilityClass(className.trim()));
  }

  /**
   * Validate a Tailwind utility class.
   * @param className - The class name to validate
   * @returns Validation result
   */
  validateUtility(className: string): ValidationResult {
    const parsed = this.parseUtilityClass(className);

    // Check if base utility is recognized
    const basePrefix = parsed.base.split('-')[0];
    if (!this.validUtilities.has(basePrefix)) {
      return {
        valid: false,
        error: `Unknown utility prefix: ${basePrefix}`,
      };
    }

    // Check responsive breakpoint first
    if (parsed.responsive && !(parsed.responsive in this.breakpoints)) {
      return {
        valid: false,
        error: `Unknown breakpoint: ${parsed.responsive}`,
      };
    }

    // Check variants
    for (const variant of parsed.variants) {
      if (!this.validVariants.has(variant)) {
        // Check if it looks like a breakpoint (ending with common breakpoint names)
        if (
          variant.includes('breakpoint') ||
          variant.match(/^(xs|sm|md|lg|xl|2xl|unknown-breakpoint)$/)
        ) {
          return {
            valid: false,
            error: `Unknown breakpoint: ${variant}`,
          };
        }
        return {
          valid: false,
          error: `Unknown variant: ${variant}`,
        };
      }
    }

    return {
      valid: true,
      properties: this.getAffectedProperties(parsed.base),
    };
  }

  /**
   * Validate utility class using actual Tailwind CSS processing.
   * @param className - The class name to validate
   * @returns Promise resolving to validation result
   */
  async validateUtilityWithTailwind(
    className: string
  ): Promise<ValidationResult> {
    const isValid = await this.tailwindProcessor.isValidUtility(className);

    if (!isValid) {
      const parsed = this.parseUtilityClass(className);

      // Check specific error types
      if (parsed.responsive && !(parsed.responsive in this.breakpoints)) {
        return {
          valid: false,
          error: `Unknown breakpoint: ${parsed.responsive}`,
        };
      }

      for (const variant of parsed.variants) {
        if (!this.validVariants.has(variant)) {
          return {
            valid: false,
            error: `Unknown variant: ${variant}`,
          };
        }
      }

      return {
        valid: false,
        error: `Invalid Tailwind utility: ${className}`,
      };
    }

    return {
      valid: true,
      properties: this.getAffectedProperties(className),
    };
  }

  /**
   * Get CSS properties affected by a utility class.
   * @param utility - The utility class (can be base or full class)
   * @returns Array of CSS property names
   */
  private getAffectedProperties(utility: string): string[] {
    // Extract base utility from full class name
    const baseUtility = utility.includes(':')
      ? utility.split(':').pop()!
      : utility;
    const prefix = baseUtility.split('-')[0];

    const propertyMap: Record<string, string[]> = {
      bg: ['background-color', 'background-image', 'background-size'],
      text: ['color', 'font-size', 'text-align', 'text-decoration'],
      border: ['border-width', 'border-color', 'border-style'],
      rounded: ['border-radius'],
      shadow: ['box-shadow'],
      p: ['padding'],
      px: ['padding-left', 'padding-right'],
      py: ['padding-top', 'padding-bottom'],
      pt: ['padding-top'],
      pr: ['padding-right'],
      pb: ['padding-bottom'],
      pl: ['padding-left'],
      m: ['margin'],
      mx: ['margin-left', 'margin-right'],
      my: ['margin-top', 'margin-bottom'],
      mt: ['margin-top'],
      mr: ['margin-right'],
      mb: ['margin-bottom'],
      ml: ['margin-left'],
      w: ['width'],
      h: ['height'],
      'max-w': ['max-width'],
      'max-h': ['max-height'],
      'min-w': ['min-width'],
      'min-h': ['min-height'],
      flex: [
        'display',
        'flex-direction',
        'flex-wrap',
        'flex-grow',
        'flex-shrink',
      ],
      grid: ['display', 'grid-template-columns', 'grid-template-rows'],
      block: ['display'],
      hidden: ['display'],
      inline: ['display'],
      absolute: ['position'],
      relative: ['position'],
      fixed: ['position'],
      sticky: ['position'],
      top: ['top'],
      right: ['right'],
      bottom: ['bottom'],
      left: ['left'],
      z: ['z-index'],
      opacity: ['opacity'],
      font: ['font-family', 'font-weight', 'font-size'],
    };

    return propertyMap[prefix] || [prefix];
  }
}
