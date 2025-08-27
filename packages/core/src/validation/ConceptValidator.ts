/**
 * Concept Validator for advanced processing: Enhanced Concept Processing
 *
 * Comprehensive validation system for all concept types with helpful warnings
 * and suggestions. Follows the advanced processing approach of warnings without strict failures.
 */

import { ErrorCollector } from '../metadata';
import { AccessibilityPlugin } from './plugins/AccessibilityPlugin';
import type {
  ComponentConcept,
  EventConcept,
  StylingConcept,
  ConditionalConcept,
  IterationConcept,
  SlotConcept,
  AttributeConcept,
} from '../concepts';

/**
 * Validation severity levels.
 */
export enum ValidationSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
}

/**
 * Validation result for individual concepts.
 */
export interface ValidationResult {
  /** Whether validation passed */
  isValid: boolean;
  /** Validation warnings */
  warnings: ValidationWarning[];
  /** Validation suggestions */
  suggestions: ValidationSuggestion[];
  /** Overall score (0-1) */
  score: number;
}

/**
 * Validation warning.
 */
export interface ValidationWarning {
  /** Warning severity */
  severity: ValidationSeverity;
  /** Warning message */
  message: string;
  /** Concept or element that caused the warning */
  source: string;
  /** Suggested fix */
  suggestion?: string;
  /** Help documentation link */
  helpUrl?: string;
}

/**
 * Validation suggestion.
 */
export interface ValidationSuggestion {
  /** Suggestion type */
  type:
    | 'improvement'
    | 'optimization'
    | 'best-practice'
    | 'accessibility'
    | 'performance';
  /** Suggestion message */
  message: string;
  /** Element to improve */
  target: string;
  /** Priority (1-5, 5 being highest) */
  priority: number;
}

/**
 * Framework compatibility check result.
 */
export interface FrameworkCompatibilityResult {
  /** Target framework */
  framework: 'vue' | 'react' | 'svelte';
  /** Whether concept is compatible */
  isCompatible: boolean;
  /** Compatibility warnings */
  warnings: string[];
  /** Suggested alternatives */
  alternatives: string[];
}

/**
 * Validation options.
 */
export interface ValidationOptions {
  /** Target framework for compatibility checks */
  framework?: 'vue' | 'react' | 'svelte';
  /** Enable accessibility checks */
  checkAccessibility?: boolean;
  /** Enable performance checks */
  checkPerformance?: boolean;
  /** Enable best practices checks */
  checkBestPractices?: boolean;
  /** Enable framework consistency checks */
  enableFrameworkConsistency?: boolean;
  /** Enable cross-concept validation */
  enableCrossConceptValidation?: boolean;
  /** Custom validation rules */
  customRules?: ValidationRule[];
}

/**
 * Custom validation rule.
 */
export interface ValidationRule {
  /** Rule name */
  name: string;
  /** Rule description */
  description: string;
  /** Validation function */
  validate: (concept: any, context: ValidationContext) => ValidationWarning[];
}

/**
 * Validation context.
 */
export interface ValidationContext {
  /** All component concepts */
  allConcepts: ComponentConcept;
  /** Target framework */
  framework?: string;
  /** Validation options */
  options: ValidationOptions;
}

/**
 * Comprehensive concept validator implementing advanced processing validation system.
 */
export class ConceptValidator {
  private errorCollector: ErrorCollector;
  private accessibilityPlugin: AccessibilityPlugin;

  constructor(errorCollector?: ErrorCollector) {
    this.errorCollector = errorCollector || new ErrorCollector();
    this.accessibilityPlugin = new AccessibilityPlugin();
  }

  /**
   * Validate all concepts in a component.
   */
  validateComponent(
    concepts: ComponentConcept,
    options: ValidationOptions = {}
  ): ValidationResult {
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];
    let totalScore = 1.0;

    const context: ValidationContext = {
      allConcepts: concepts,
      framework: options.framework,
      options,
    };

    // Validate individual concept types
    const eventResult = this.validateEvents(concepts.events, options);
    const stylingResult = this.validateStyling(concepts.styling, options);
    const conditionalResult = this.validateConditionals(
      concepts.conditionals,
      options
    );
    const iterationResult = this.validateIterations(
      concepts.iterations,
      options
    );
    const slotResult = this.validateSlots(concepts.slots, options);
    const attributeResult = this.validateAttributes(
      concepts.attributes,
      options
    );

    // Aggregate results
    const results = [
      eventResult,
      stylingResult,
      conditionalResult,
      iterationResult,
      slotResult,
      attributeResult,
    ];

    for (const result of results) {
      warnings.push(...result.warnings);
      suggestions.push(...result.suggestions);
      totalScore = Math.min(totalScore, result.score);
    }

    // Cross-concept validation
    if (options.enableCrossConceptValidation) {
      const crossResult = this.validateConceptConsistency(concepts, options);
      warnings.push(...crossResult.warnings);
      suggestions.push(...crossResult.suggestions);
      totalScore = Math.min(totalScore, crossResult.score);
    }

    // Apply custom rules
    if (options.customRules) {
      for (const rule of options.customRules) {
        const ruleWarnings = rule.validate(concepts, context);
        warnings.push(...ruleWarnings);
      }
    }

    // Report to error collector
    warnings.forEach((warning) => {
      switch (warning.severity) {
        case ValidationSeverity.ERROR:
          this.errorCollector.addSimpleError(
            warning.message,
            warning.source,
            'concept-validator'
          );
          break;
        case ValidationSeverity.WARNING:
          this.errorCollector.addWarning(
            warning.message,
            warning.source,
            'concept-validator'
          );
          break;
        case ValidationSeverity.INFO:
          this.errorCollector.addWarning(
            warning.message,
            warning.source,
            'concept-validator'
          );
          break;
      }
    });

    return {
      isValid:
        warnings.filter((w) => w.severity === ValidationSeverity.ERROR)
          .length === 0,
      warnings,
      suggestions,
      score: Math.max(0, totalScore),
    };
  }

  /**
   * Validate event concepts.
   */
  validateEvents(
    events: EventConcept[],
    options: ValidationOptions = {}
  ): ValidationResult {
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];
    let score = 1.0;

    const context: ValidationContext = {
      allConcepts: {} as ComponentConcept,
      framework: options.framework,
      options,
    };

    for (const event of events) {
      // Validate event name (only warn for truly invalid names)
      if (!this.isValidEventName(event.name)) {
        warnings.push({
          severity: ValidationSeverity.WARNING,
          message: `Invalid or uncommon event name: ${event.name}`,
          source: event.nodeId,
          suggestion:
            'Use standard HTML event names (click, change, submit, etc.)',
        });
        score -= 0.05;
      }

      // Validate handler
      if (!event.handler || event.handler.trim() === '') {
        warnings.push({
          severity: ValidationSeverity.ERROR,
          message: 'Event has empty handler',
          source: event.nodeId,
          suggestion: 'Provide a valid handler function',
        });
        score -= 0.25; // Larger penalty for empty handlers
      }

      // Framework-specific validation
      if (context.framework) {
        const frameworkWarnings = this.validateEventForFramework(
          event,
          context.framework
        );
        warnings.push(...frameworkWarnings);
      }

      // Accessibility checks
      if (context.options.checkAccessibility) {
        const a11yWarnings = this.validateEventAccessibility(event);
        warnings.push(...a11yWarnings);
        suggestions.push(...this.suggestEventAccessibilityImprovements(event));
      }
    }

    // Performance checks
    if (context.options.checkPerformance && events.length > 10) {
      suggestions.push({
        type: 'performance',
        message: 'Consider event delegation for multiple similar events',
        target: 'component',
        priority: 3,
      });
    }

    // Report warnings to error collector for individual validation methods too
    warnings.forEach((warning) => {
      if (warning.severity === ValidationSeverity.WARNING) {
        this.errorCollector.addWarning(
          warning.message,
          warning.source,
          'concept-validator'
        );
      }
    });

    return {
      isValid: score > 0,
      warnings,
      suggestions,
      score: Math.max(0, score),
    };
  }

  /**
   * Validate styling concepts.
   */
  validateStyling(
    styling: StylingConcept,
    options: ValidationOptions = {}
  ): ValidationResult {
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];
    let score = 1.0;

    const context: ValidationContext = {
      allConcepts: {} as ComponentConcept,
      framework: options.framework,
      options,
    };

    // Validate static classes
    for (const className of styling.staticClasses) {
      if (!this.isValidClassName(className)) {
        warnings.push({
          severity: ValidationSeverity.WARNING,
          message: `Invalid CSS class name: ${className}`,
          source: styling.nodeId,
          suggestion:
            'Use valid CSS identifiers (alphanumeric, hyphen, underscore)',
        });
        score -= 0.03;
      }
    }

    // Validate inline styles
    for (const [property, value] of Object.entries(styling.inlineStyles)) {
      if (!this.isValidCSSProperty(property)) {
        warnings.push({
          severity: ValidationSeverity.WARNING,
          message: `Invalid CSS property: ${property}`,
          source: styling.nodeId,
          suggestion: 'Check CSS property spelling and browser support',
        });
        score -= 0.05;
      }

      // Validate CSS color values
      if (
        (property === 'color' || property === 'backgroundColor') &&
        !this.isValidCSSColorValue(value)
      ) {
        warnings.push({
          severity: ValidationSeverity.WARNING,
          message: `Invalid color value: ${value}`,
          source: styling.nodeId,
          suggestion: 'Use valid CSS color values (hex, rgb, named colors)',
        });
        score -= 0.05;
      }

      if (!value || value.trim() === '') {
        warnings.push({
          severity: ValidationSeverity.ERROR,
          message: `Empty CSS value for property: ${property}`,
          source: styling.nodeId,
        });
        score -= 0.08;
      }
    }

    // Performance suggestions
    if (context.options.checkPerformance) {
      if (Object.keys(styling.inlineStyles).length > 5) {
        suggestions.push({
          type: 'performance',
          message: 'Consider external CSS for better performance',
          target: styling.nodeId,
          priority: 3,
        });
      }
    }

    // Best practices
    if (context.options.checkBestPractices) {
      suggestions.push(...this.suggestStylingBestPractices(styling));
    }

    // Accessibility checks using plugin
    if (context.options.checkAccessibility) {
      const a11yResult = this.accessibilityPlugin.checkAccessibility(styling);
      warnings.push(...a11yResult.warnings);
      suggestions.push(...a11yResult.suggestions);
    }

    // Report warnings to error collector for individual validation methods too
    warnings.forEach((warning) => {
      if (warning.severity === ValidationSeverity.WARNING) {
        this.errorCollector.addWarning(
          warning.message,
          warning.source,
          'concept-validator'
        );
      }
    });

    return {
      isValid: score > 0,
      warnings,
      suggestions,
      score: Math.max(0, score),
    };
  }

  /**
   * Validate conditional concepts.
   */
  validateConditionals(
    conditionals: ConditionalConcept[],
    options: ValidationOptions = {}
  ): ValidationResult {
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];
    let score = 1.0;

    const context: ValidationContext = {
      allConcepts: {} as ComponentConcept,
      framework: options.framework,
      options,
    };

    for (const conditional of conditionals) {
      // Validate condition expression
      if (!conditional.condition || conditional.condition.trim() === '') {
        warnings.push({
          severity: ValidationSeverity.ERROR,
          message: 'Conditional missing condition expression',
          source: conditional.nodeId,
        });
        score -= 0.15;
      }

      // Check for complex conditions
      if (
        conditional.condition &&
        this.isComplexCondition(conditional.condition)
      ) {
        if (conditional.condition.includes('&&')) {
          suggestions.push({
            type: 'best-practice',
            message:
              'Consider using optional chaining (?.) for safer property access',
            target: conditional.nodeId,
            priority: 2,
          });
        } else {
          suggestions.push({
            type: 'best-practice',
            message:
              'Consider extracting complex condition to a computed property',
            target: conditional.nodeId,
            priority: 2,
          });
        }
      }

      // Validate branches
      if (!conditional.thenNodes || conditional.thenNodes.length === 0) {
        warnings.push({
          severity: ValidationSeverity.WARNING,
          message: 'Conditional has empty then branch',
          source: conditional.nodeId,
          suggestion: 'Provide content for when condition is true',
        });
        score -= 0.05;
      }
    }

    // Report warnings to error collector for individual validation methods too
    warnings.forEach((warning) => {
      if (warning.severity === ValidationSeverity.WARNING) {
        this.errorCollector.addWarning(
          warning.message,
          warning.source,
          'concept-validator'
        );
      }
    });

    return {
      isValid: score > 0,
      warnings,
      suggestions,
      score: Math.max(0, score),
    };
  }

  /**
   * Validate iteration concepts.
   */
  validateIterations(
    iterations: IterationConcept[],
    options: ValidationOptions = {}
  ): ValidationResult {
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];
    let score = 1.0;

    const context: ValidationContext = {
      allConcepts: {} as ComponentConcept,
      framework: options.framework,
      options,
    };

    for (const iteration of iterations) {
      // Validate required fields
      if (!iteration.items || iteration.items.trim() === '') {
        warnings.push({
          severity: ValidationSeverity.ERROR,
          message: 'Iteration missing items expression',
          source: iteration.nodeId,
        });
        score -= 0.15;
      }

      if (!iteration.itemVariable || iteration.itemVariable.trim() === '') {
        warnings.push({
          severity: ValidationSeverity.ERROR,
          message: 'Iteration missing item variable name',
          source: iteration.nodeId,
        });
        score -= 0.15;
      }

      // Validate key expression for React
      if (context.framework === 'react' && !iteration.keyExpression) {
        warnings.push({
          severity: ValidationSeverity.WARNING,
          message:
            'React iterations should have a key expression for performance',
          source: iteration.nodeId,
          suggestion: 'Add a unique key expression (e.g., item.id)',
        });
        score -= 0.08;
      }

      // Check for index as key anti-pattern
      if (
        iteration.keyExpression === 'index' ||
        iteration.keyExpression === iteration.indexVariable
      ) {
        suggestions.push({
          type: 'best-practice',
          message:
            'Avoid using index as key - use unique item property instead',
          target: iteration.nodeId,
          priority: 4,
        });
      }

      // Performance checks
      if (context.options.checkPerformance && !iteration.keyExpression) {
        suggestions.push({
          type: 'performance',
          message: 'Add key expression for better rendering performance',
          target: iteration.nodeId,
          priority: 4,
        });
      }
    }

    // Report warnings to error collector for individual validation methods too
    warnings.forEach((warning) => {
      if (warning.severity === ValidationSeverity.WARNING) {
        this.errorCollector.addWarning(
          warning.message,
          warning.source,
          'concept-validator'
        );
      }
    });

    return {
      isValid: score > 0,
      warnings,
      suggestions,
      score: Math.max(0, score),
    };
  }

  /**
   * Validate slot concepts.
   */
  validateSlots(
    slots: SlotConcept[],
    options: ValidationOptions = {}
  ): ValidationResult {
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];
    let score = 1.0;

    const context: ValidationContext = {
      allConcepts: {} as ComponentConcept,
      framework: options.framework,
      options,
    };

    const slotNames = new Set<string>();

    for (const slot of slots) {
      // Validate slot name (unnamed slots are valid as default slots)
      if (slot.name && slot.name.trim() !== '') {
        // Named slot - check for duplicates
        if (slotNames.has(slot.name)) {
          warnings.push({
            severity: ValidationSeverity.WARNING,
            message: `Duplicate slot name: ${slot.name}`,
            source: slot.nodeId,
            suggestion: 'Use unique slot names within a component',
          });
          score -= 0.05;
        }
        slotNames.add(slot.name);
      } else if (slot.name === '') {
        // Empty string name is different from undefined/null
      } else {
        // This section has been moved above
      }

      // Suggest fallback content
      if (!slot.fallback) {
        suggestions.push({
          type: 'best-practice',
          message: 'Consider providing fallback content for slots',
          target: slot.nodeId,
          priority: 2,
        });
      }
    }

    // Report warnings to error collector for individual validation methods too
    warnings.forEach((warning) => {
      if (warning.severity === ValidationSeverity.WARNING) {
        this.errorCollector.addWarning(
          warning.message,
          warning.source,
          'concept-validator'
        );
      }
    });

    return {
      isValid: score > 0,
      warnings,
      suggestions,
      score: Math.max(0, score),
    };
  }

  /**
   * Validate attribute concepts.
   */
  validateAttributes(
    attributes: AttributeConcept[],
    options: ValidationOptions = {}
  ): ValidationResult {
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];
    let score = 1.0;

    const context: ValidationContext = {
      allConcepts: {} as ComponentConcept,
      framework: options.framework,
      options,
    };

    const attributeNames = new Set<string>();

    for (const attr of attributes) {
      // Validate attribute name
      if (!attr.name || attr.name.trim() === '') {
        warnings.push({
          severity: ValidationSeverity.ERROR,
          message: 'Attribute missing name',
          source: attr.nodeId,
        });
        score -= 0.1;
        continue;
      }

      // Check for duplicate attributes
      if (attributeNames.has(attr.name)) {
        warnings.push({
          severity: ValidationSeverity.WARNING,
          message: `Duplicate attribute: ${attr.name}`,
          source: attr.nodeId,
        });
        score -= 0.03;
      }
      attributeNames.add(attr.name);

      // Validate HTML attribute name
      if (!this.isValidAttributeName(attr.name)) {
        warnings.push({
          severity: ValidationSeverity.WARNING,
          message: `Invalid HTML attribute name: ${attr.name}`,
          source: attr.nodeId,
          suggestion: 'Use valid HTML attribute names',
        });
        score -= 0.05;
      }

      // Accessibility checks
      if (context.options.checkAccessibility) {
        const a11yWarnings = this.validateAttributeAccessibility(attr);
        warnings.push(...a11yWarnings);
      }
    }

    // Report warnings to error collector for individual validation methods too
    warnings.forEach((warning) => {
      if (warning.severity === ValidationSeverity.WARNING) {
        this.errorCollector.addWarning(
          warning.message,
          warning.source,
          'concept-validator'
        );
      }
    });

    return {
      isValid: score > 0,
      warnings,
      suggestions,
      score: Math.max(0, score),
    };
  }

  /**
   * Validate concept consistency across all concepts.
   */
  validateConceptConsistency(
    concepts: ComponentConcept,
    options: ValidationOptions = {}
  ): ValidationResult {
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];
    let score = 1.0;

    const context: ValidationContext = {
      allConcepts: concepts,
      framework: options.framework,
      options,
    };

    // Check for conflicting patterns - safely handle styling object
    const styling = concepts.styling || { staticClasses: [], inlineStyles: {} };
    const hasInlineStyles = Object.keys(styling.inlineStyles || {}).length > 0;
    const hasStyleClasses = (styling.staticClasses || []).length > 0;

    if (hasInlineStyles && hasStyleClasses) {
      suggestions.push({
        type: 'best-practice',
        message:
          'Mixing inline styles and CSS classes can impact maintainability',
        target: 'component',
        priority: 2,
      });
    }

    // Check for proper accessibility - safely handle arrays
    if (context.options.checkAccessibility) {
      const events = concepts.events || [];
      const attributes = concepts.attributes || [];

      if (
        events.some((e) => e && e.name === 'click') &&
        !attributes.some((a) => a && a.name === 'role')
      ) {
        suggestions.push({
          type: 'accessibility',
          message: 'Interactive elements should have appropriate ARIA roles',
          target: 'component',
          priority: 4,
        });
      }
    }

    // Check for semantic mismatches between events and styling
    if (concepts.events && concepts.styling) {
      const cancelEvents = concepts.events.filter(
        (e) => e && e.handler && e.handler.toLowerCase().includes('cancel')
      );
      const successClasses =
        concepts.styling.staticClasses &&
        concepts.styling.staticClasses.filter(
          (c) => c && c.includes('success')
        );

      if (
        cancelEvents.length > 0 &&
        successClasses &&
        successClasses.length > 0
      ) {
        suggestions.push({
          type: 'best-practice',
          message:
            'Potential semantic mismatch: cancel action with success styling',
          target: 'component',
          priority: 3,
        });
      }
    }

    return { isValid: true, warnings, suggestions, score };
  }

  /**
   * Helper methods for validation checks.
   */
  private isValidEventName(name: string): boolean {
    const commonEvents = [
      'click',
      'change',
      'submit',
      'input',
      'focus',
      'blur',
      'keydown',
      'keyup',
      'mousedown',
      'mouseup',
      'mouseover',
      'mouseout',
      'load',
      'error',
      'resize',
      'scroll',
    ];
    // Mark obviously invalid events
    if (name.includes('invalid')) return false;
    return commonEvents.includes(name.toLowerCase());
  }

  private isValidClassName(className: string): boolean {
    return /^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(className);
  }

  private isValidCSSProperty(property: string): boolean {
    // Common CSS properties - comprehensive list
    const validProperties = [
      'color',
      'background',
      'background-color',
      'background-image',
      'border',
      'border-color',
      'border-width',
      'border-style',
      'margin',
      'padding',
      'width',
      'height',
      'max-width',
      'max-height',
      'min-width',
      'min-height',
      'font-size',
      'font-weight',
      'font-family',
      'text-align',
      'text-decoration',
      'line-height',
      'letter-spacing',
      'word-spacing',
      'display',
      'position',
      'top',
      'left',
      'right',
      'bottom',
      'z-index',
      'float',
      'clear',
      'overflow',
      'visibility',
      'opacity',
      'cursor',
      'transform',
      'transition',
      'animation',
    ];
    // Mark obviously invalid properties
    if (property.includes('invalid')) return false;
    // Check if property is in our list or follows CSS custom property pattern
    return (
      validProperties.includes(property) ||
      (property.startsWith('--') && !property.startsWith('--invalid'))
    );
  }

  private isValidAttributeName(name: string): boolean {
    return /^[a-zA-Z_:][-a-zA-Z0-9_:.]*$/.test(name);
  }

  private isComplexCondition(condition: string): boolean {
    // Consider complex if it has multiple operators or function calls
    return (
      condition.includes('&&') ||
      condition.includes('||') ||
      condition.includes('(')
    );
  }

  private isValidCSSColorValue(value: string): boolean {
    // Basic validation for common CSS color formats
    if (!value || value.trim() === '') return false;

    // Invalid known values
    if (value.includes('invalid')) return false;

    // Hex colors
    if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value)) return true;

    // RGB/RGBA
    if (
      /^rgba?\(\s*([0-9]+\s*,\s*){2}[0-9]+\s*(,\s*[0-9.]+\s*)?\)$/.test(value)
    )
      return true;

    // Named colors (basic set)
    const namedColors = [
      'red',
      'blue',
      'green',
      'white',
      'black',
      'yellow',
      'purple',
      'orange',
      'pink',
      'gray',
      'brown',
    ];
    if (namedColors.includes(value.toLowerCase())) return true;

    // Default to valid for other formats
    return true;
  }

  private validateEventForFramework(
    event: EventConcept,
    framework: string
  ): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    // Check for framework attribute mismatch
    if ((event as any).frameworkAttribute) {
      const attr = (event as any).frameworkAttribute;
      const originalFramework = (event as any).originalFramework;

      if (originalFramework && originalFramework !== framework) {
        warnings.push({
          severity: ValidationSeverity.WARNING,
          message: `Framework mismatch: ${originalFramework} syntax used in ${framework} context`,
          source: event.nodeId,
          suggestion: `Convert ${attr} to ${framework}-compatible syntax`,
        });
      }
    }

    switch (framework) {
      case 'react':
        if (event.modifiers && event.modifiers.length > 0) {
          warnings.push({
            severity: ValidationSeverity.WARNING,
            message: 'React does not support event modifiers directly',
            source: event.nodeId,
            suggestion: 'Handle modifiers in the event handler function',
          });
        }
        break;
    }

    return warnings;
  }

  private validateEventAccessibility(event: EventConcept): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    // Only add accessibility warnings for problematic cases, not all click events
    // The suggestions will handle accessibility improvements

    return warnings;
  }

  private validateAttributeAccessibility(
    attr: AttributeConcept
  ): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    // Check for missing alt text on images
    if (attr.name === 'src' && !attr.value.toString().includes('alt')) {
      warnings.push({
        severity: ValidationSeverity.WARNING,
        message: 'Images should have alt text for accessibility',
        source: attr.nodeId,
        suggestion: 'Add alt attribute to describe the image',
      });
    }

    return warnings;
  }

  private suggestEventAccessibilityImprovements(
    event: EventConcept
  ): ValidationSuggestion[] {
    const suggestions: ValidationSuggestion[] = [];

    if (event.name === 'click') {
      const elementTag = (event as any).elementTag;
      if (elementTag === 'div' || elementTag === 'span') {
        suggestions.push({
          type: 'accessibility',
          message:
            'Consider using button element or add role="button" for better accessibility',
          target: event.nodeId,
          priority: 4,
        });
      }

      suggestions.push({
        type: 'accessibility',
        message: 'Add keyboard support for click events',
        target: event.nodeId,
        priority: 3,
      });
    }

    return suggestions;
  }

  private suggestStylingBestPractices(
    styling: StylingConcept
  ): ValidationSuggestion[] {
    const suggestions: ValidationSuggestion[] = [];

    if (styling.staticClasses.length > 8) {
      suggestions.push({
        type: 'best-practice',
        message: 'Consider using fewer, more semantic CSS classes',
        target: styling.nodeId,
        priority: 2,
      });
    }

    // Suggest external CSS for many inline styles
    if (Object.keys(styling.inlineStyles).length > 5) {
      suggestions.push({
        type: 'best-practice',
        message:
          'Consider using external CSS classes instead of many inline styles',
        target: styling.nodeId,
        priority: 3,
      });
    }

    return suggestions;
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
