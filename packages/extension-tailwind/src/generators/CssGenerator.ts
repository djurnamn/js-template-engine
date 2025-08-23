import type { ParsedUtility, CssGenerationOptions } from '../types';
import type { StyleOutput } from '@js-template-engine/core';
import { TailwindProcessor } from '../services/TailwindProcessor';

/**
 * CSS generator for Tailwind utility classes.
 */
export class CssGenerator {
  private tailwindProcessor: TailwindProcessor;
  private breakpoints: Record<string, string>;

  constructor(tailwindProcessor?: TailwindProcessor) {
    this.tailwindProcessor = tailwindProcessor || new TailwindProcessor();
    this.breakpoints = this.tailwindProcessor.getBreakpoints();
  }

  /**
   * Generate CSS from Tailwind utilities.
   * @param utilities - Parsed utilities to convert
   * @param options - Generation options
   * @returns Generated CSS output
   */
  generateCssFromUtilities(utilities: ParsedUtility[], options: CssGenerationOptions = { format: 'css' }): StyleOutput {
    if (options.format === 'pass-through') {
      return {
        styles: utilities.map(u => u.original).join(' '),
        imports: []
      };
    }

    if (options.format === 'scss-apply') {
      return this.generateScssWithApply(utilities);
    }

    // Try real Tailwind CSS first
    try {
      // Since interface requires sync, we'll use a synchronous wrapper approach
      // The generateTailwindCss method would normally be async but we adapt it
      return this.generateTailwindCssSync(utilities, options);
    } catch (error) {
      console.warn('Real Tailwind CSS generation failed, falling back to basic mappings:', error);
      // Only fall back to basic mappings on error
      return this.generateFallbackCss(utilities, options);
    }
  }

  /**
   * Generate SCSS with @apply directives.
   * @param utilities - Parsed utilities to convert
   * @returns SCSS with @apply output
   */
  generateScssWithApply(utilities: ParsedUtility[]): StyleOutput {
    const groupedUtilities = this.groupUtilitiesByScope(utilities);
    const scssLines: string[] = [];

    // Base styles
    if (groupedUtilities.base.length > 0) {
      scssLines.push('@apply ' + groupedUtilities.base.map(u => u.original).join(' ') + ';');
    }

    // Pseudo-class variants
    for (const [variant, variantUtilities] of Object.entries(groupedUtilities.variants)) {
      if (variantUtilities.length > 0) {
        scssLines.push(`&:${variant} {`);
        scssLines.push('  @apply ' + variantUtilities.map(u => u.original).join(' ') + ';');
        scssLines.push('}');
      }
    }

    // Responsive styles
    for (const [breakpoint, responsiveUtilities] of Object.entries(groupedUtilities.responsive)) {
      if (responsiveUtilities.length > 0) {
        const minWidth = this.breakpoints[breakpoint] || this.breakpoints.md || '768px';
        scssLines.push(`@media (min-width: ${minWidth}) {`);
        scssLines.push('  @apply ' + responsiveUtilities.map(u => u.original).join(' ') + ';');
        scssLines.push('}');
      }
    }

    return {
      styles: scssLines.join('\n'),
      imports: []
    };
  }

  /**
   * Generate CSS using actual Tailwind CSS processing (synchronous version).
   * @param utilities - Parsed utilities to convert
   * @param options - Generation options
   * @returns Generated CSS output
   */
  private generateTailwindCssSync(utilities: ParsedUtility[], options: CssGenerationOptions): StyleOutput {
    const groupedUtilities = this.groupUtilitiesByScope(utilities);
    const cssBlocks: string[] = [];
    const className = options.classPrefix || 'component';

    try {
      // Use PostCSS synchronously with a simple HTML template approach
      const allClasses = utilities.map(u => u.original);
      const htmlTemplate = `<div class="${allClasses.join(' ')}"></div>`;
      
      // Generate CSS by processing a simple template with Tailwind
      const result = this.tailwindProcessor.generateCssFromUtilities(allClasses, `.${className}`);
      
      // If it's a Promise (which it shouldn't be in sync mode), return fallback
      if (result instanceof Promise) {
        throw new Error('Async result in sync context');
      }
      
      return result;
    } catch (error) {
      throw new Error(`Tailwind CSS sync generation failed: ${error}`);
    }
  }

  /**
   * Generate CSS using actual Tailwind CSS processing (async version).
   * @param utilities - Parsed utilities to convert
   * @param options - Generation options
   * @returns Generated CSS output
   */
  private async generateTailwindCss(utilities: ParsedUtility[], options: CssGenerationOptions): Promise<StyleOutput> {
    const groupedUtilities = this.groupUtilitiesByScope(utilities);
    const cssBlocks: string[] = [];
    const className = options.classPrefix || 'component';

    try {
      // Base styles
      if (groupedUtilities.base.length > 0) {
        const baseClasses = groupedUtilities.base.map(u => u.original);
        const result = await this.tailwindProcessor.generateCssFromUtilities(baseClasses, `.${className}`);
        if (result.styles.trim()) {
          cssBlocks.push(result.styles);
        }
      }

      // Pseudo-class variants
      for (const [variant, variantUtilities] of Object.entries(groupedUtilities.variants)) {
        if (variantUtilities.length > 0) {
          const variantClasses = variantUtilities.map(u => u.original);
          const result = await this.tailwindProcessor.generateCssFromUtilities(variantClasses, `.${className}:${variant}`);
          if (result.styles.trim()) {
            cssBlocks.push(result.styles);
          }
        }
      }

      // Responsive styles
      for (const [breakpoint, responsiveUtilities] of Object.entries(groupedUtilities.responsive)) {
        if (responsiveUtilities.length > 0) {
          const responsiveClasses = responsiveUtilities.map(u => u.original);
          const minWidth = (options.breakpoints || this.breakpoints)[breakpoint] || '768px';
          
          // Handle mixed responsive + variant utilities
          const pureResponsive = responsiveUtilities.filter(u => u.variants.length === 0);
          const mixedUtilities = responsiveUtilities.filter(u => u.variants.length > 0);
          
          if (pureResponsive.length > 0) {
            const result = await this.tailwindProcessor.generateCssFromUtilities(
              pureResponsive.map(u => u.original),
              `.${className}`
            );
            if (result.styles.trim()) {
              cssBlocks.push(`@media (min-width: ${minWidth}) {\n${result.styles}\n}`);
            }
          }
          
          // Handle mixed responsive + variant utilities
          for (const mixedUtility of mixedUtilities) {
            for (const variant of mixedUtility.variants) {
              const result = await this.tailwindProcessor.generateCssFromUtilities(
                [mixedUtility.original],
                `.${className}:${variant}`
              );
              if (result.styles.trim()) {
                cssBlocks.push(`@media (min-width: ${minWidth}) {\n${result.styles}\n}`);
              }
            }
          }
        }
      }

      return {
        styles: cssBlocks.join('\n\n'),
        imports: []
      };
    } catch (error) {
      console.warn('Tailwind CSS generation failed:', error);
      // Fallback to original approach
      return this.generateFallbackCss(utilities, options);
    }
  }

  /**
   * Fallback CSS generation with basic utility mappings.
   * @param utilities - Parsed utilities to convert
   * @param options - Generation options
   * @returns Fallback CSS output
   */
  private generateFallbackCss(utilities: ParsedUtility[], options: CssGenerationOptions): StyleOutput {
    const groupedUtilities = this.groupUtilitiesByScope(utilities);
    const cssRules: string[] = [];
    const className = options.classPrefix || 'component';

    // Base styles
    if (groupedUtilities.base.length > 0) {
      const baseStyles = this.generateBasicCssRules(groupedUtilities.base);
      if (baseStyles) {
        cssRules.push(`.${className} {\n${baseStyles}\n}`);
      }
    }

    // Pseudo-class variants
    for (const [variant, variantUtilities] of Object.entries(groupedUtilities.variants)) {
      if (variantUtilities.length > 0) {
        const variantStyles = this.generateBasicCssRules(variantUtilities);
        if (variantStyles) {
          cssRules.push(`.${className}:${variant} {\n${variantStyles}\n}`);
        }
      }
    }

    // Responsive styles
    for (const [breakpoint, responsiveUtilities] of Object.entries(groupedUtilities.responsive)) {
      if (responsiveUtilities.length > 0) {
        const minWidth = (options.breakpoints || this.breakpoints)[breakpoint] || '768px';
        
        // Separate pure responsive from mixed responsive+variant
        const pureResponsive = responsiveUtilities.filter(u => u.variants.length === 0);
        const mixedUtilities = responsiveUtilities.filter(u => u.variants.length > 0);
        
        // Pure responsive styles
        if (pureResponsive.length > 0) {
          const responsiveStyles = this.generateBasicCssRules(pureResponsive);
          if (responsiveStyles) {
            cssRules.push(`@media (min-width: ${minWidth}) {\n  .${className} {\n${responsiveStyles.split('\n').map(line => `  ${line}`).join('\n')}\n  }\n}`);
          }
        }
        
        // Mixed responsive + variant utilities
        for (const mixedUtility of mixedUtilities) {
          for (const variant of mixedUtility.variants) {
            const variantStyles = this.generateBasicCssRules([mixedUtility]);
            if (variantStyles) {
              cssRules.push(`@media (min-width: ${minWidth}) {\n  .${className}:${variant} {\n${variantStyles.split('\n').map(line => `  ${line}`).join('\n')}\n  }\n}`);
            }
          }
        }
      }
    }

    return {
      styles: cssRules.join('\n\n'),
      imports: []
    };
  }

  /**
   * Generate basic CSS rules from utilities using hardcoded mappings.
   * @param utilities - Utilities to convert
   * @returns CSS rule string
   */
  private generateBasicCssRules(utilities: ParsedUtility[]): string {
    const rules: string[] = [];

    for (const utility of utilities) {
      const cssRule = this.convertUtilityToBasicCss(utility);
      if (cssRule) {
        rules.push(`  ${cssRule}`);
      }
    }

    return rules.join('\n');
  }

  /**
   * Convert a single utility to basic CSS rule using Tailwind config tokens.
   * @param utility - Utility to convert
   * @returns CSS rule string or null
   */
  private convertUtilityToBasicCss(utility: ParsedUtility): string | null {
    const parts = utility.base.split('-');
    const prefix = parts[0];
    const value = parts.slice(1).join('-');

    // Get tokens from actual Tailwind configuration
    const colorMap = this.tailwindProcessor.getColorTokens();
    const spacingMap = this.tailwindProcessor.getSpacingTokens();
    const fontSizeMap = this.tailwindProcessor.getFontSizeTokens();

    switch (prefix) {
      case 'bg':
        return colorMap[value] ? `background-color: ${colorMap[value]};` : null;
      case 'text':
        if (colorMap[value]) {
          return `color: ${colorMap[value]};`;
        }
        return fontSizeMap[value] ? `font-size: ${fontSizeMap[value]};` : null;
      case 'p':
        return spacingMap[value] ? `padding: ${spacingMap[value]};` : null;
      case 'px':
        return spacingMap[value] ? `padding-left: ${spacingMap[value]}; padding-right: ${spacingMap[value]};` : null;
      case 'py':
        return spacingMap[value] ? `padding-top: ${spacingMap[value]}; padding-bottom: ${spacingMap[value]};` : null;
      case 'm':
        return spacingMap[value] ? `margin: ${spacingMap[value]};` : null;
      case 'mx':
        if (value === 'auto') {
          return 'margin-left: auto; margin-right: auto;';
        }
        return spacingMap[value] ? `margin-left: ${spacingMap[value]}; margin-right: ${spacingMap[value]};` : null;
      case 'my':
        return spacingMap[value] ? `margin-top: ${spacingMap[value]}; margin-bottom: ${spacingMap[value]};` : null;
      case 'w':
        // Try spacing first for numeric values
        if (spacingMap[value]) {
          return `width: ${spacingMap[value]};`;
        }
        // Common fraction and keyword values
        const widthMap: Record<string, string> = {
          'auto': 'auto',
          'full': '100%',
          '1/2': '50%',
          '1/3': '33.333333%',
          '2/3': '66.666667%',
          '1/4': '25%',
          '3/4': '75%'
        };
        return widthMap[value] ? `width: ${widthMap[value]};` : null;
      case 'h':
        // Try spacing first for numeric values
        if (spacingMap[value]) {
          return `height: ${spacingMap[value]};`;
        }
        // Common keyword values
        const heightMap: Record<string, string> = {
          'auto': 'auto',
          'full': '100%',
          'screen': '100vh'
        };
        if (heightMap[value]) {
          return `height: ${heightMap[value]};`;
        }
        // Handle numeric values (like h-64 -> height: 16rem)
        const numericValue = parseInt(value, 10);
        if (!isNaN(numericValue)) {
          return `height: ${numericValue * 0.25}rem;`;
        }
        return null;
      case 'flex':
        if (!value) return 'display: flex;';
        const flexMap: Record<string, string> = {
          'col': 'display: flex; flex-direction: column;',
          'row': 'display: flex; flex-direction: row;',
          'wrap': 'flex-wrap: wrap;',
          '1': 'flex: 1 1 0%;'
        };
        return flexMap[value] || 'display: flex;';
      case 'hidden':
        return 'display: none;';
      case 'block':
        return 'display: block;';
      case 'inline':
        return 'display: inline;';
      case 'rounded':
        const radiusMap: Record<string, string> = {
          '': '0.25rem',
          'sm': '0.125rem',
          'md': '0.375rem',
          'lg': '0.5rem',
          'xl': '0.75rem',
          'full': '9999px'
        };
        return `border-radius: ${radiusMap[value] || '0.25rem'};`;
      case 'border':
        if (!value) {
          return 'border-width: 1px;';
        }
        return colorMap[value] ? `border-color: ${colorMap[value]};` : null;
      case 'shadow':
        const shadowMap: Record<string, string> = {
          '': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
          'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
          'md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
          'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)'
        };
        return `box-shadow: ${shadowMap[value] || shadowMap['']};`;
      case 'outline':
        return value === 'none' ? 'outline: none;' : null;
      case 'ring':
        const ringMap: Record<string, string> = {
          '': '0 0 0 3px rgb(59 130 246 / 0.5)',
          '1': '0 0 0 1px rgb(59 130 246 / 0.5)',
          '2': '0 0 0 2px rgb(59 130 246 / 0.5)',
          '4': '0 0 0 4px rgb(59 130 246 / 0.5)'
        };
        return `box-shadow: ${ringMap[value] || ringMap['']};`;
      default:
        return null;
    }
  }

  /**
   * Group utilities by their scope (base, variants, responsive).
   * @param utilities - Utilities to group
   * @returns Grouped utilities
   */
  private groupUtilitiesByScope(utilities: ParsedUtility[]) {
    const grouped = {
      base: [] as ParsedUtility[],
      variants: {} as Record<string, ParsedUtility[]>,
      responsive: {} as Record<string, ParsedUtility[]>
    };

    for (const utility of utilities) {
      if (utility.responsive && utility.variants.length === 0) {
        // Pure responsive utilities
        if (!grouped.responsive[utility.responsive]) {
          grouped.responsive[utility.responsive] = [];
        }
        grouped.responsive[utility.responsive].push(utility);
      } else if (utility.variants.length > 0 && !utility.responsive) {
        // Pure variant utilities
        for (const variant of utility.variants) {
          if (!grouped.variants[variant]) {
            grouped.variants[variant] = [];
          }
          grouped.variants[variant].push(utility);
        }
      } else if (utility.responsive && utility.variants.length > 0) {
        // Mixed responsive + variant utilities
        // For now, treat as responsive with variants applied within media query
        if (!grouped.responsive[utility.responsive]) {
          grouped.responsive[utility.responsive] = [];
        }
        grouped.responsive[utility.responsive].push(utility);
      } else if (!utility.responsive && utility.variants.length === 0) {
        // Base utilities
        grouped.base.push(utility);
      }
    }

    return grouped;
  }
}