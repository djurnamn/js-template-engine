import { StyleDefinition } from '../types/styles';
import { TemplateNode, TemplateOptions } from '../types';
import createLogger from '../helpers/createLogger';

export class StyleProcessor {
  private logger: ReturnType<typeof createLogger>;
  private processedStyles: Map<string, StyleDefinition> = new Map();

  constructor(verbose = false) {
    this.logger = createLogger(verbose, 'StyleProcessor');
  }

  processNode(node: TemplateNode): void {
    if (!node.attributes?.styles) {
      return;
    }

    const selector = this.getSelector(node);
    if (!selector) {
      this.logger.warn('Node has styles but no selector found');
      return;
    }

    this.processedStyles.set(selector, node.attributes.styles as StyleDefinition);
    this.logger.info(`Processed styles for selector: ${selector}`);
  }

  hasStyles(): boolean {
    return this.processedStyles.size > 0;
  }

  private getSelector(node: TemplateNode): string | null {
    if (node.attributes?.class) {
      return `.${node.attributes.class}`;
    }
    if (node.tag) {
      return node.tag;
    }
    return null;
  }

  generateOutput(options: TemplateOptions): string {
    if (!options.styles) {
      return '';
    }

    switch (options.styles.outputFormat) {
      case 'inline':
        return this.generateInlineStyles();
      case 'css':
        return this.generateCss();
      case 'scss':
        return this.generateScss();
      default:
        throw new Error(`Unsupported output format: ${options.styles.outputFormat}`);
    }
  }

  private generateInlineStyles(): string {
    const styleTagRules: string[] = [];
    
    this.processedStyles.forEach((styleDef, selector) => {
      // Process pseudo selectors and media queries for style tag
      Object.entries(styleDef).forEach(([key, value]) => {
        if (key.startsWith('@media')) {
          const query = key.replace('@media', '').trim();
          const mediaStyles = Object.entries(value as Record<string, string | number>)
            .map(([k, v]) => `    ${this.camelToKebab(k)}: ${v};`)
            .join('\n');
          styleTagRules.push(`@media (${query}) {\n  ${selector} {\n${mediaStyles}\n  }\n}`);
        } else if (key.startsWith(':')) {
          const pseudoStyles = Object.entries(value as Record<string, string | number>)
            .map(([k, v]) => `    ${this.camelToKebab(k)}: ${v};`)
            .join('\n');
          styleTagRules.push(`${selector}${key} {\n${pseudoStyles}\n}`);
        }
      });
    });

    // Only return the style tag if there are rules
    return styleTagRules.length > 0 
      ? `\n<style>\n${styleTagRules.join('\n\n')}\n</style>`
      : '';
  }

  private generateCss(): string {
    const styles: string[] = [];
    const mediaQueries: Map<string, string[]> = new Map();
    const pseudoSelectors: string[] = [];
    
    this.processedStyles.forEach((styleDef, selector) => {
      const baseStyles: string[] = [];

      // Process all style rules
      Object.entries(styleDef).forEach(([key, value]) => {
        if (key.startsWith('@media')) {
          // Handle media queries
          const query = key.replace('@media', '').trim();
          if (!mediaQueries.has(query)) {
            mediaQueries.set(query, []);
          }
          const mediaStyles = Object.entries(value as Record<string, string | number>)
            .map(([k, v]) => `    ${this.camelToKebab(k)}: ${v};`)
            .join('\n');
          mediaQueries.get(query)?.push(`  ${selector} {\n${mediaStyles}\n  }`);
        } else if (key.startsWith(':')) {
          // Handle pseudo selectors
          const pseudoStyles = Object.entries(value as Record<string, string | number>)
            .map(([k, v]) => `  ${this.camelToKebab(k)}: ${v};`)
            .join('\n');
          pseudoSelectors.push(`${selector}${key} {\n${pseudoStyles}\n}`);
        } else {
          // Handle base styles
          baseStyles.push(`  ${this.camelToKebab(key)}: ${value};`);
        }
      });

      if (baseStyles.length > 0) {
        styles.push(`${selector} {\n${baseStyles.join('\n')}\n}`);
      }
    });

    // Add pseudo selectors
    styles.push(...pseudoSelectors);

    // Add media queries at the root level
    mediaQueries.forEach((rules, query) => {
      styles.push(`@media (${query}) {\n${rules.join('\n')}\n}`);
    });

    return styles.join('\n\n');
  }

  private generateScss(): string {
    const styles: string[] = [];
    
    this.processedStyles.forEach((styleDef, selector) => {
      const rules: string[] = [];

      // Process all style rules
      Object.entries(styleDef).forEach(([key, value]) => {
        if (key.startsWith('@media')) {
          // Handle media queries
          const query = key.replace('@media', '').trim();
          const mediaStyles = Object.entries(value as Record<string, string | number>)
            .map(([k, v]) => `    ${this.camelToKebab(k)}: ${v};`)
            .join('\n');
          rules.push(`  @media (${query}) {\n${mediaStyles}\n  }`);
        } else if (key.startsWith(':')) {
          // Handle pseudo selectors
          const pseudoStyles = Object.entries(value as Record<string, string | number>)
            .map(([k, v]) => `    ${this.camelToKebab(k)}: ${v};`)
            .join('\n');
          rules.push(`  &${key} {\n${pseudoStyles}\n  }`);
        } else {
          // Handle base styles
          rules.push(`  ${this.camelToKebab(key)}: ${value};`);
        }
      });

      if (rules.length > 0) {
        styles.push(`${selector} {\n${rules.join('\n')}\n}`);
      }
    });

    return styles.join('\n\n');
  }

  private camelToKebab(str: string): string {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }

  // Add a new method to get inline styles for a specific node
  getInlineStyles(node: TemplateNode): string | null {
    if (!node.attributes?.styles) {
      return null;
    }

    const selector = this.getSelector(node);
    if (!selector) {
      return null;
    }

    const styleDef = this.processedStyles.get(selector);
    if (!styleDef) {
      return null;
    }

    // Convert base styles to inline format
    return Object.entries(styleDef)
      .filter(([key]) => !key.startsWith('@media') && !key.startsWith(':'))
      .map(([key, value]) => `${this.camelToKebab(key)}: ${value}`)
      .join('; ');
  }
} 