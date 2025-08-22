/**
 * Advanced Styling Concept Extractor
 * 
 * Advanced styling extraction with cross-framework normalization and validation.
 * Supports static classes, dynamic classes, inline styles, and style bindings.
 */

import { ErrorCollector } from '../metadata';
import type { StylingConcept } from '../concepts';

/**
 * Template node interface for styling extraction.
 */
interface TemplateNode {
  type?: 'element' | 'text' | 'comment' | 'if' | 'for' | 'slot' | 'fragment';
  tag?: string;
  attributes?: Record<string, any>;
  expressionAttributes?: Record<string, any>;
  children?: TemplateNode[];
  extensions?: Record<string, any>;
}

/**
 * Styling extraction options.
 */
export interface StylingExtractionOptions {
  /** Framework for styling normalization */
  framework?: 'vue' | 'react' | 'svelte';
  /** Whether to normalize class names */
  normalizeClassNames?: boolean;
  /** Whether to validate CSS properties */
  validateCSS?: boolean;
  /** Whether to extract CSS variables */
  extractCSSVariables?: boolean;
  /** Whether to merge duplicate classes */
  mergeDuplicateClasses?: boolean;
  /** Custom class name patterns */
  customClassPatterns?: RegExp[];
  /** CSS framework detection (e.g., tailwind, bootstrap) */
  cssFrameworkDetection?: boolean;
}

/**
 * Styling extraction result with metadata.
 */
export interface StylingExtractionResult {
  /** Extracted styling concept */
  styling: StylingConcept;
  /** Detection metadata */
  metadata: {
    /** Total nodes processed */
    nodesProcessed: number;
    /** Styling attributes found */
    stylingAttributesFound: number;
    /** Detected CSS frameworks */
    detectedFrameworks: string[];
    /** CSS variables found */
    cssVariables: string[];
    /** Validation warnings */
    warnings: string[];
  };
}

/**
 * CSS property validation result.
 */
export interface CSSValidationResult {
  /** Whether property is valid */
  isValid: boolean;
  /** Property name */
  property: string;
  /** Property value */
  value: string;
  /** Warnings */
  warnings: string[];
  /** Suggested corrections */
  suggestions: string[];
}

/**
 * CSS framework detection patterns.
 */
const CSS_FRAMEWORK_PATTERNS = {
  tailwind: /^(bg-|text-|p-|m-|w-|h-|flex|grid|rounded|shadow|border)/,
  bootstrap: /^(btn|card|container|row|col|alert|badge|navbar)/,
  bulma: /^(button|box|content|title|subtitle|section|hero)/,
  foundation: /^(button|callout|grid-|cell|top-bar|menu)/,
  bem: /^[a-z]+(-[a-z]+)*(__[a-z]+(-[a-z]+)*)?(--[a-z]+(-[a-z]+)*)?$/
};

/**
 * Advanced styling concept extractor with comprehensive features.
 */
export class StylingExtractor {
  private errorCollector: ErrorCollector;

  constructor(errorCollector?: ErrorCollector) {
    this.errorCollector = errorCollector || new ErrorCollector();
  }

  /**
   * Extract styling from template nodes with advanced processing.
   */
  extractStyling(
    nodes: TemplateNode[],
    options: StylingExtractionOptions = {}
  ): StylingExtractionResult {
    const {
      framework = 'react',
      normalizeClassNames = true,
      validateCSS = true,
      extractCSSVariables = true,
      mergeDuplicateClasses = true,
      customClassPatterns = [],
      cssFrameworkDetection = true
    } = options;

    const styling: StylingConcept = {
      nodeId: 'root',
      staticClasses: [],
      dynamicClasses: [],
      inlineStyles: {},
      styleBindings: {}
    };

    const metadata = {
      nodesProcessed: 0,
      stylingAttributesFound: 0,
      detectedFrameworks: [] as string[],
      cssVariables: [] as string[],
      warnings: [] as string[]
    };

    // Process all nodes recursively
    this.processNodes(nodes, styling, metadata, options);

    // Post-processing
    if (mergeDuplicateClasses) {
      styling.staticClasses = [...new Set(styling.staticClasses)];
    }

    if (normalizeClassNames) {
      styling.staticClasses = this.normalizeClassNames(styling.staticClasses, framework);
    }

    if (cssFrameworkDetection) {
      metadata.detectedFrameworks = this.detectCSSFrameworks(styling.staticClasses);
    }

    if (extractCSSVariables) {
      metadata.cssVariables = this.extractCSSVariablesFromStyles(styling.inlineStyles);
    }

    return { styling, metadata };
  }

  /**
   * Process nodes recursively to extract styling.
   */
  private processNodes(
    nodes: TemplateNode[],
    styling: StylingConcept,
    metadata: StylingExtractionResult['metadata'],
    options: StylingExtractionOptions
  ): void {
    for (const node of nodes) {
      metadata.nodesProcessed++;

      // Extract styling from current node
      this.extractStylingFromNode(node, styling, metadata, options);

      // Process children recursively
      if (node.children) {
        this.processNodes(node.children, styling, metadata, options);
      }

      // Handle special node types
      if (node.type === 'if') {
        const conditionalNode = node as any;
        if (conditionalNode.then) {
          this.processNodes(conditionalNode.then, styling, metadata, options);
        }
        if (conditionalNode.else) {
          this.processNodes(conditionalNode.else, styling, metadata, options);
        }
      }
    }
  }

  /**
   * Extract styling from a single node.
   */
  private extractStylingFromNode(
    node: TemplateNode,
    styling: StylingConcept,
    metadata: StylingExtractionResult['metadata'],
    options: StylingExtractionOptions
  ): void {
    if (!node.attributes && !node.expressionAttributes) {
      return;
    }

    const { framework = 'react', validateCSS = true } = options;

    // Extract static classes
    if (node.attributes?.class) {
      metadata.stylingAttributesFound++;
      const classValue = String(node.attributes.class);
      const classes = this.parseClassString(classValue);
      styling.staticClasses.push(...classes);
    }

    // Extract dynamic classes based on framework
    if (node.expressionAttributes) {
      const classAttrs = this.getClassAttributes(node.expressionAttributes, framework);
      for (const attr of classAttrs) {
        metadata.stylingAttributesFound++;
        styling.dynamicClasses.push(String(node.expressionAttributes[attr]));
      }

      // Extract style bindings
      const styleAttrs = this.getStyleAttributes(node.expressionAttributes, framework);
      for (const attr of styleAttrs) {
        metadata.stylingAttributesFound++;
        if (!styling.styleBindings) styling.styleBindings = {};
        styling.styleBindings[attr] = String(node.expressionAttributes[attr]);
      }
    }

    // Extract inline styles
    if (node.attributes?.style) {
      metadata.stylingAttributesFound++;
      const styleValue = String(node.attributes.style);
      const parsedStyles = this.parseInlineStyles(styleValue);
      
      if (validateCSS) {
        this.validateInlineStyles(parsedStyles, metadata);
      }
      
      Object.assign(styling.inlineStyles, parsedStyles);
    }
  }

  /**
   * Parse class string into individual classes.
   */
  private parseClassString(classStr: string): string[] {
    return classStr
      .split(/\s+/)
      .map(cls => cls.trim())
      .filter(Boolean);
  }

  /**
   * Get class attributes based on framework.
   */
  private getClassAttributes(expressionAttributes: Record<string, any>, framework: string): string[] {
    const attrs: string[] = [];

    switch (framework) {
      case 'react':
        if ('className' in expressionAttributes) attrs.push('className');
        break;
      case 'vue':
        if (':class' in expressionAttributes) attrs.push(':class');
        if ('v-bind:class' in expressionAttributes) attrs.push('v-bind:class');
        break;
      case 'svelte':
        if ('class:' in expressionAttributes) {
          // Svelte class: directives
          Object.keys(expressionAttributes)
            .filter(key => key.startsWith('class:'))
            .forEach(key => attrs.push(key));
        }
        break;
    }

    return attrs;
  }

  /**
   * Get style attributes based on framework.
   */
  private getStyleAttributes(expressionAttributes: Record<string, any>, framework: string): string[] {
    const attrs: string[] = [];

    switch (framework) {
      case 'react':
        if ('style' in expressionAttributes) attrs.push('style');
        break;
      case 'vue':
        if (':style' in expressionAttributes) attrs.push(':style');
        if ('v-bind:style' in expressionAttributes) attrs.push('v-bind:style');
        break;
      case 'svelte':
        if ('style:' in expressionAttributes) {
          // Svelte style: directives
          Object.keys(expressionAttributes)
            .filter(key => key.startsWith('style:'))
            .forEach(key => attrs.push(key));
        }
        break;
    }

    return attrs;
  }

  /**
   * Parse inline styles from style attribute.
   */
  private parseInlineStyles(styleStr: string): Record<string, string> {
    const styles: Record<string, string> = {};
    
    const declarations = styleStr.split(';').filter(Boolean);
    for (const declaration of declarations) {
      const colonIndex = declaration.indexOf(':');
      if (colonIndex > 0) {
        const property = declaration.substring(0, colonIndex).trim();
        const value = declaration.substring(colonIndex + 1).trim();
        if (property && value) {
          styles[property] = value;
        }
      }
    }
    
    return styles;
  }

  /**
   * Validate inline styles.
   */
  private validateInlineStyles(
    styles: Record<string, string>,
    metadata: StylingExtractionResult['metadata']
  ): void {
    for (const [property, value] of Object.entries(styles)) {
      const validation = this.validateCSSProperty(property, value);
      if (!validation.isValid) {
        metadata.warnings.push(`Invalid CSS: ${property}: ${value}`);
      }
      metadata.warnings.push(...validation.warnings);
    }
  }

  /**
   * Validate CSS property and value.
   */
  validateCSSProperty(property: string, value: string): CSSValidationResult {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let isValid = true;

    // Check for common CSS property typos
    const commonTypos: Record<string, string> = {
      'colour': 'color',
      'boarder': 'border',
      'postion': 'position',
      'heigth': 'height',
      'widht': 'width',
      'margain': 'margin',
      'paddng': 'padding'
    };

    if (commonTypos[property]) {
      warnings.push(`Did you mean '${commonTypos[property]}'?`);
      suggestions.push(commonTypos[property]);
      isValid = false;
    }

    // Check for vendor prefixes without standard property
    if (property.startsWith('-webkit-') || property.startsWith('-moz-') || property.startsWith('-ms-')) {
      const standardProperty = property.replace(/^-\w+-/, '');
      suggestions.push(`Consider adding standard property: ${standardProperty}`);
    }

    // Check for deprecated properties
    const deprecatedProperties = ['text-decoration-line', 'text-decoration-style', 'text-decoration-color'];
    if (deprecatedProperties.includes(property)) {
      warnings.push(`Property '${property}' is deprecated`);
      suggestions.push('text-decoration');
    }

    // Basic value validation
    if (!value || value.trim() === '') {
      warnings.push('Empty CSS value');
      isValid = false;
    }

    return {
      isValid,
      property,
      value,
      warnings,
      suggestions
    };
  }

  /**
   * Normalize class names for framework consistency.
   */
  private normalizeClassNames(classes: string[], framework: string): string[] {
    return classes.map(className => {
      // Convert camelCase to kebab-case for Vue/Svelte
      if (framework !== 'react' && /[A-Z]/.test(className)) {
        return className.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
      }
      return className;
    });
  }

  /**
   * Detect CSS frameworks from class names.
   */
  private detectCSSFrameworks(classes: string[]): string[] {
    const frameworks: string[] = [];

    for (const [framework, pattern] of Object.entries(CSS_FRAMEWORK_PATTERNS)) {
      const hasFrameworkClasses = classes.some(cls => pattern.test(cls));
      if (hasFrameworkClasses) {
        frameworks.push(framework);
      }
    }

    return frameworks;
  }

  /**
   * Extract CSS variables from inline styles.
   */
  private extractCSSVariablesFromStyles(styles: Record<string, string>): string[] {
    const cssVariables: string[] = [];

    for (const [property, value] of Object.entries(styles)) {
      // Extract CSS custom properties (--variable-name)
      if (property.startsWith('--')) {
        cssVariables.push(property);
      }

      // Extract var() usage
      const varMatches = value.match(/var\(([^)]+)\)/g);
      if (varMatches) {
        for (const match of varMatches) {
          const varName = match.replace(/var\(([^,)]+).*\)/, '$1').trim();
          if (!cssVariables.includes(varName)) {
            cssVariables.push(varName);
          }
        }
      }
    }

    return cssVariables;
  }

  /**
   * Extract styling from a single node (public API).
   */
  extractStylingFromSingleNode(
    node: TemplateNode,
    nodeId: string,
    options: StylingExtractionOptions = {}
  ): StylingConcept {
    const styling: StylingConcept = {
      nodeId,
      staticClasses: [],
      dynamicClasses: [],
      inlineStyles: {},
      styleBindings: {}
    };

    const metadata = {
      nodesProcessed: 0,
      stylingAttributesFound: 0,
      detectedFrameworks: [],
      cssVariables: [],
      warnings: []
    };

    this.extractStylingFromNode(node, styling, metadata, options);

    return styling;
  }

  /**
   * Merge styling concepts.
   */
  mergeStyling(base: StylingConcept, additional: StylingConcept): StylingConcept {
    return {
      nodeId: base.nodeId,
      staticClasses: [...base.staticClasses, ...additional.staticClasses],
      dynamicClasses: [...base.dynamicClasses, ...additional.dynamicClasses],
      inlineStyles: { ...base.inlineStyles, ...additional.inlineStyles },
      styleBindings: { ...base.styleBindings, ...additional.styleBindings }
    };
  }

  /**
   * Get collected errors from processing.
   */
  getErrors(): ErrorCollector {
    return this.errorCollector;
  }

  /**
   * Clear errors from previous processing.
   */
  clearErrors(): void {
    this.errorCollector.clear();
  }
}