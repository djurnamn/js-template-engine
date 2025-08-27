import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import type { Config } from 'tailwindcss';
import type { StyleOutput } from '@js-template-engine/core';

/**
 * Service for processing CSS with actual Tailwind CSS engine.
 */
export class TailwindProcessor {
  private postcssProcessor: postcss.Processor;
  private config: Config;

  constructor(config?: Config) {
    this.config = this.createDefaultConfig(config);
    this.postcssProcessor = postcss([tailwindcss(this.config)]);
  }

  /**
   * Process @apply directives using actual Tailwind CSS.
   * @param css - CSS with @apply directives
   * @returns Processed CSS output
   */
  async processApply(css: string): Promise<StyleOutput> {
    try {
      const result = await this.postcssProcessor.process(css, {
        from: undefined,
      });
      return {
        styles: result.css,
        imports: [],
      };
    } catch (error) {
      console.warn('Tailwind CSS processing failed:', error);
      return {
        styles: css, // Return original CSS on error
        imports: [],
      };
    }
  }

  /**
   * Generate CSS from utility classes using Tailwind's engine.
   * @param utilities - Utility class names
   * @param selector - CSS selector to wrap the utilities
   * @returns Generated CSS output
   */
  async generateCssFromUtilities(
    utilities: string[],
    selector: string = '.component'
  ): Promise<StyleOutput> {
    const applyDirective = `${selector} { @apply ${utilities.join(' ')}; }`;
    return this.processApply(applyDirective);
  }

  /**
   * Validate utility classes against Tailwind's actual definitions.
   * @param className - Class name to validate
   * @returns Whether the class is valid
   */
  async isValidUtility(className: string): Promise<boolean> {
    try {
      const testCSS = `.test { @apply ${className}; }`;
      const result = await this.postcssProcessor.process(testCSS, {
        from: undefined,
      });
      // If processing succeeds and generates CSS, the utility is valid
      return result.css.includes('test') && !result.css.includes('@apply');
    } catch (error) {
      return false;
    }
  }

  /**
   * Get all available utility classes (approximation).
   * @returns Set of valid utility prefixes
   */
  getValidUtilityPrefixes(): Set<string> {
    // Common Tailwind utility prefixes - in a real implementation,
    // you might extract these from Tailwind's internal configuration
    return new Set([
      'bg',
      'text',
      'border',
      'rounded',
      'shadow',
      'p',
      'px',
      'py',
      'pt',
      'pr',
      'pb',
      'pl',
      'm',
      'mx',
      'my',
      'mt',
      'mr',
      'mb',
      'ml',
      'w',
      'h',
      'max-w',
      'max-h',
      'min-w',
      'min-h',
      'flex',
      'grid',
      'block',
      'hidden',
      'inline',
      'absolute',
      'relative',
      'fixed',
      'sticky',
      'top',
      'right',
      'bottom',
      'left',
      'z',
      'opacity',
      'scale',
      'rotate',
      'translate',
      'skew',
      'origin',
      'overflow',
      'cursor',
      'pointer-events',
      'select',
      'resize',
      'font',
      'tracking',
      'leading',
      'list',
      'placeholder',
      'caret',
      'accent',
      'appearance',
      'resize',
      'scroll',
      'snap',
      'touch',
      'will-change',
      'outline',
      'ring',
      'space',
      'divide',
      'decoration',
      'underline',
      'overline',
      'line-through',
      'uppercase',
      'lowercase',
      'capitalize',
      'normal-case',
      'truncate',
      'break',
      'whitespace',
      'align',
      'vertical',
      'float',
      'clear',
      'object',
      'filter',
      'backdrop',
      'transition',
      'duration',
      'ease',
      'delay',
      'animate',
    ]);
  }

  /**
   * Get valid responsive breakpoints from Tailwind config.
   * @returns Record of breakpoint names to media query values
   */
  getBreakpoints(): Record<string, string> {
    const theme = this.config.theme as any;
    const screens = theme?.screens || {};

    // Default Tailwind breakpoints if none configured
    if (Object.keys(screens).length === 0) {
      return {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
      };
    }

    // Convert screen values to consistent format
    const breakpoints: Record<string, string> = {};
    for (const [name, value] of Object.entries(screens)) {
      if (typeof value === 'string') {
        breakpoints[name] = value;
      } else if (typeof value === 'object' && (value as any).min) {
        breakpoints[name] = (value as any).min;
      }
    }

    return breakpoints;
  }

  /**
   * Get color tokens from Tailwind config.
   * @returns Record of color names to hex values
   */
  getColorTokens(): Record<string, string> {
    const theme = this.config.theme as any;
    const colors = theme?.colors || {};

    const colorMap: Record<string, string> = {};

    // Default colors if none configured
    if (Object.keys(colors).length === 0) {
      return {
        'red-500': '#ef4444',
        'blue-500': '#3b82f6',
        'blue-600': '#2563eb',
        'green-500': '#10b981',
        'yellow-500': '#eab308',
        'purple-500': '#a855f7',
        'pink-500': '#ec4899',
        'indigo-500': '#6366f1',
        'gray-500': '#6b7280',
        'gray-800': '#1f2937',
        white: '#ffffff',
        black: '#000000',
      };
    }

    // Extract color values from theme
    for (const [colorName, colorValue] of Object.entries(colors)) {
      if (typeof colorValue === 'string') {
        colorMap[colorName] = colorValue;
      } else if (typeof colorValue === 'object' && colorValue !== null) {
        // Handle color scales like blue-500, red-600, etc.
        for (const [shade, hex] of Object.entries(
          colorValue as Record<string, string>
        )) {
          if (typeof hex === 'string') {
            colorMap[`${colorName}-${shade}`] = hex;
          }
        }
      }
    }

    return colorMap;
  }

  /**
   * Get spacing tokens from Tailwind config.
   * @returns Record of spacing names to values
   */
  getSpacingTokens(): Record<string, string> {
    const theme = this.config.theme as any;
    const spacing = theme?.spacing || {};

    // Default spacing if none configured
    if (Object.keys(spacing).length === 0) {
      return {
        '0': '0px',
        '1': '0.25rem',
        '2': '0.5rem',
        '3': '0.75rem',
        '4': '1rem',
        '5': '1.25rem',
        '6': '1.5rem',
        '8': '2rem',
        '10': '2.5rem',
        '12': '3rem',
      };
    }

    return spacing;
  }

  /**
   * Get font size tokens from Tailwind config.
   * @returns Record of font size names to values
   */
  getFontSizeTokens(): Record<string, string> {
    const theme = this.config.theme as any;
    const fontSize = theme?.fontSize || {};

    // Default font sizes if none configured
    if (Object.keys(fontSize).length === 0) {
      return {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
      };
    }

    // Handle both string values and array values [size, lineHeight]
    const fontSizeMap: Record<string, string> = {};
    for (const [name, value] of Object.entries(fontSize)) {
      if (typeof value === 'string') {
        fontSizeMap[name] = value;
      } else if (Array.isArray(value) && value.length > 0) {
        fontSizeMap[name] = value[0];
      }
    }

    return fontSizeMap;
  }

  /**
   * Get valid pseudo-class variants.
   * @returns Set of valid variant names
   */
  getValidVariants(): Set<string> {
    return new Set([
      'hover',
      'focus',
      'active',
      'disabled',
      'first',
      'last',
      'odd',
      'even',
      'visited',
      'checked',
      'invalid',
      'required',
      'group-hover',
      'group-focus',
      'focus-within',
      'focus-visible',
      'motion-safe',
      'motion-reduce',
      'dark',
      'print',
      'portrait',
      'landscape',
      'first-letter',
      'first-line',
      'selection',
      'file',
      'marker',
      'before',
      'after',
    ]);
  }

  /**
   * Convert CSS properties back to Tailwind utilities (approximation).
   * @param styles - CSS properties to convert
   * @returns Object with converted classes and remaining styles
   */
  async convertCssToTailwind(styles: Record<string, string>): Promise<{
    classes: string[];
    remaining: Record<string, string>;
  }> {
    const classes: string[] = [];
    const remaining: Record<string, string> = { ...styles };

    // Simple reverse mapping for common properties
    const reverseMap: Record<
      string,
      (value: string) => Promise<string | null>
    > = {
      'background-color': async (value) => {
        // Test common color utilities
        const colorTests = [
          'bg-red-500',
          'bg-blue-500',
          'bg-green-500',
          'bg-yellow-500',
          'bg-purple-500',
          'bg-pink-500',
          'bg-indigo-500',
          'bg-gray-500',
          'bg-white',
          'bg-black',
          'bg-transparent',
        ];

        for (const testClass of colorTests) {
          const testResult = await this.generateCssFromUtilities([testClass]);
          if (testResult.styles.includes(value)) {
            return testClass;
          }
        }
        return null;
      },
      color: async (value) => {
        const colorTests = [
          'text-red-500',
          'text-blue-500',
          'text-green-500',
          'text-yellow-500',
          'text-purple-500',
          'text-pink-500',
          'text-indigo-500',
          'text-gray-500',
          'text-white',
          'text-black',
        ];

        for (const testClass of colorTests) {
          const testResult = await this.generateCssFromUtilities([testClass]);
          if (testResult.styles.includes(value)) {
            return testClass;
          }
        }
        return null;
      },
      display: async (value) => {
        const displayMap: Record<string, string> = {
          flex: 'flex',
          block: 'block',
          inline: 'inline',
          none: 'hidden',
          grid: 'grid',
        };
        return displayMap[value] || null;
      },
    };

    for (const [property, value] of Object.entries(styles)) {
      const converter = reverseMap[property];
      if (converter) {
        const tailwindClass = await converter(value);
        if (tailwindClass) {
          classes.push(tailwindClass);
          delete remaining[property];
        }
      }
    }

    return { classes, remaining };
  }

  /**
   * Create default Tailwind configuration.
   * @param userConfig - User-provided configuration
   * @returns Complete Tailwind configuration
   */
  private createDefaultConfig(userConfig?: Config): Config {
    return {
      content: [], // No content scanning needed for our use case
      theme: {
        extend: {},
      },
      plugins: [],
      ...userConfig,
    };
  }
}
