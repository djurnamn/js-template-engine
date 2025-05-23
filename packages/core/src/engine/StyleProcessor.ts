import type { TemplateNode, StyleDefinition, RenderOptions, StyleProcessorPlugin } from '@js-template-engine/types';
import type { TemplateOptions } from '../types';
import { createLogger } from '../helpers/createLogger';

export class StyleProcessor {
  private logger: ReturnType<typeof createLogger>;
  private processedStyles: Map<string, StyleDefinition> = new Map();
  private plugins: StyleProcessorPlugin[] = [];

  constructor(verbose = false, plugins: StyleProcessorPlugin[] = []) {
    this.logger = createLogger(verbose, 'StyleProcessor');
    this.plugins = plugins;
  }

  processNode(node: TemplateNode): void {
    if (!node.attributes?.styles) {
      return;
    }

    let selector = this.getSelector(node);
    if (!selector) {
      this.logger.warn('Node has styles but no selector found');
      return;
    }

    // Allow plugins to transform the selector
    this.plugins.forEach(plugin => {
      if (selector) {  // Type guard to ensure selector is string
        const newSelector = plugin.onProcessNode?.(node);
        if (typeof newSelector === 'string') {
          this.logger.info(`Selector transformed by plugin: ${selector} -> ${newSelector}`);
          selector = newSelector;
        }
      }
    });

    // Merge with existing styles if any
    const existing = this.processedStyles.get(selector) || {};
    const newStyles = node.attributes.styles as StyleDefinition;
    
    // Deep merge styles, handling media queries and pseudo-selectors
    const mergedStyles = this.mergeStyleDefinitions(existing, newStyles);
    
    this.processedStyles.set(selector, mergedStyles);
    this.logger.info(`Processed styles for selector: ${selector}`);
  }

  private mergeStyleDefinitions(existing: StyleDefinition, newStyles: StyleDefinition): StyleDefinition {
    const merged: StyleDefinition = { ...existing };

    Object.entries(newStyles).forEach(([key, value]) => {
      if (key.startsWith('@media')) {
        // Merge media query styles
        const existingMedia = existing[key] as Record<string, string | number> || {};
        merged[key] = { ...existingMedia, ...value as Record<string, string | number> };
      } else if (key.startsWith(':')) {
        // Merge pseudo-selector styles
        const existingPseudo = existing[key] as Record<string, string | number> || {};
        merged[key] = { ...existingPseudo, ...value as Record<string, string | number> };
      } else {
        // Merge base styles
        merged[key] = value;
      }
    });

    return merged;
  }

  hasStyles(): boolean {
    return this.processedStyles.size > 0;
  }

  private getSelector(node: TemplateNode): string | null {
    if (node.attributes?.class) {
      // Use the first class name as the primary selector
      const classValue = node.attributes.class;
      if (typeof classValue === 'string') {
        const classes = classValue.split(/\s+/);
        return `.${classes[0]}`;
      }
    }
    if (node.tag) {
      return node.tag;
    }
    return null;
  }

  generateOutput(options: TemplateOptions, originalTemplateTree?: TemplateNode[]): string {
    if (!options.styles) {
      return '';
    }

    for (const plugin of this.plugins) {
      this.logger.info('Checking plugin for style generation...');
      const pluginOutput = plugin.generateStyles?.(this.processedStyles, options, originalTemplateTree);
      if (pluginOutput) {
        this.logger.info('Using style output from plugin');
        return pluginOutput;
      }
    }

    this.logger.info('No plugin generated output, using default formatter');
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
            .map(([k, v]) => `${this.camelToKebab(k)}: ${v};`)
            .join('\n');
          styleTagRules.push(`@media (${query}) {\n  ${selector} {\n${mediaStyles}\n  }\n}`);
        } else if (key.startsWith(':')) {
          const pseudoStyles = Object.entries(value as Record<string, string | number>)
            .map(([k, v]) => `${this.camelToKebab(k)}: ${v};`)
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
          // Handle media queries with proper nesting
          const query = key.replace('@media', '').trim();
          const mediaStyles = Object.entries(value as Record<string, string | number>)
            .map(([k, v]) => `      ${this.camelToKebab(k)}: ${v};`)
            .join('\n');
          rules.push(`  @media (${query}) {\n    & {\n${mediaStyles}\n    }\n  }`);
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