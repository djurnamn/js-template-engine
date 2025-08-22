/**
 * Concept Validator for advanced processing: Enhanced Concept Processing
 * 
 * Comprehensive validation system for all concept types with helpful warnings
 * and suggestions. Follows the advanced processing approach of warnings without strict failures.
 */

import { ErrorCollector } from '../metadata';
import type {
  ComponentConcept,
  EventConcept,
  StylingConcept,
  ConditionalConcept,
  IterationConcept,
  SlotConcept,
  AttributeConcept
} from '../concepts';

/**
 * Validation severity levels.
 */
export enum ValidationSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
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
  /** Overall score (0-100) */
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
  type: 'improvement' | 'optimization' | 'best-practice' | 'accessibility' | 'performance';
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

  constructor(errorCollector?: ErrorCollector) {
    this.errorCollector = errorCollector || new ErrorCollector();
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
    let totalScore = 100;

    const context: ValidationContext = {
      allConcepts: concepts,
      framework: options.framework,
      options
    };

    // Validate individual concept types
    const eventResult = this.validateEvents(concepts.events, context);
    const stylingResult = this.validateStyling(concepts.styling, context);
    const conditionalResult = this.validateConditionals(concepts.conditionals, context);
    const iterationResult = this.validateIterations(concepts.iterations, context);
    const slotResult = this.validateSlots(concepts.slots, context);
    const attributeResult = this.validateAttributes(concepts.attributes, context);

    // Aggregate results
    const results = [eventResult, stylingResult, conditionalResult, iterationResult, slotResult, attributeResult];
    
    for (const result of results) {
      warnings.push(...result.warnings);
      suggestions.push(...result.suggestions);
      totalScore = Math.min(totalScore, result.score);
    }

    // Cross-concept validation
    if (options.enableCrossConceptValidation) {
      const crossResult = this.validateConceptConsistency(concepts, context);
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
    warnings.forEach(warning => {
      switch (warning.severity) {
        case ValidationSeverity.ERROR:
          this.errorCollector.addSimpleError(warning.message, warning.source, 'concept-validator');
          break;
        case ValidationSeverity.WARNING:
          this.errorCollector.addWarning(warning.message, warning.source, 'concept-validator');
          break;
        case ValidationSeverity.INFO:
          // Log info level separately if needed
          break;
      }
    });

    return {
      isValid: warnings.filter(w => w.severity === ValidationSeverity.ERROR).length === 0,
      warnings,
      suggestions,
      score: Math.max(0, totalScore)
    };
  }

  /**
   * Validate event concepts.
   */
  validateEvents(events: EventConcept[], context: ValidationContext): ValidationResult {
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];
    let score = 100;

    for (const event of events) {
      // Validate event name
      if (!this.isValidEventName(event.name)) {
        warnings.push({
          severity: ValidationSeverity.WARNING,
          message: `Invalid or uncommon event name: ${event.name}`,
          source: event.nodeId,
          suggestion: 'Use standard HTML event names (click, change, submit, etc.)'
        });
        score -= 5;
      }

      // Validate handler
      if (!event.handler || event.handler.trim() === '') {
        warnings.push({
          severity: ValidationSeverity.ERROR,
          message: 'Event handler is empty',
          source: event.nodeId,
          suggestion: 'Provide a valid handler function'
        });
        score -= 10;
      }

      // Framework-specific validation
      if (context.framework) {
        const frameworkWarnings = this.validateEventForFramework(event, context.framework);
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
        priority: 3
      });
    }

    return { isValid: score > 0, warnings, suggestions, score: Math.max(0, score) };
  }

  /**
   * Validate styling concepts.
   */
  validateStyling(styling: StylingConcept, context: ValidationContext): ValidationResult {
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];
    let score = 100;

    // Validate static classes
    for (const className of styling.staticClasses) {
      if (!this.isValidClassName(className)) {
        warnings.push({
          severity: ValidationSeverity.WARNING,
          message: `Invalid CSS class name: ${className}`,
          source: styling.nodeId,
          suggestion: 'Use valid CSS identifiers (alphanumeric, hyphen, underscore)'
        });
        score -= 3;
      }
    }

    // Validate inline styles
    for (const [property, value] of Object.entries(styling.inlineStyles)) {
      if (!this.isValidCSSProperty(property)) {
        warnings.push({
          severity: ValidationSeverity.WARNING,
          message: `Unknown CSS property: ${property}`,
          source: styling.nodeId,
          suggestion: 'Check CSS property spelling and browser support'
        });
        score -= 5;
      }

      if (!value || value.trim() === '') {
        warnings.push({
          severity: ValidationSeverity.ERROR,
          message: `Empty CSS value for property: ${property}`,
          source: styling.nodeId
        });
        score -= 8;
      }
    }

    // Performance suggestions
    if (context.options.checkPerformance) {
      if (Object.keys(styling.inlineStyles).length > 5) {
        suggestions.push({
          type: 'performance',
          message: 'Consider using CSS classes instead of many inline styles',
          target: styling.nodeId,
          priority: 3
        });
      }
    }

    // Best practices
    if (context.options.checkBestPractices) {
      suggestions.push(...this.suggestStylingBestPractices(styling));
    }

    return { isValid: score > 0, warnings, suggestions, score: Math.max(0, score) };
  }

  /**
   * Validate conditional concepts.
   */
  validateConditionals(conditionals: ConditionalConcept[], context: ValidationContext): ValidationResult {
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];
    let score = 100;

    for (const conditional of conditionals) {
      // Validate condition expression
      if (!conditional.condition || conditional.condition.trim() === '') {
        warnings.push({
          severity: ValidationSeverity.ERROR,
          message: 'Conditional missing condition expression',
          source: conditional.nodeId
        });
        score -= 15;
      }

      // Check for complex conditions
      if (conditional.condition && this.isComplexCondition(conditional.condition)) {
        suggestions.push({
          type: 'best-practice',
          message: 'Consider extracting complex condition to a computed property',
          target: conditional.nodeId,
          priority: 2
        });
      }

      // Validate branches
      if (!conditional.thenNodes || conditional.thenNodes.length === 0) {
        warnings.push({
          severity: ValidationSeverity.WARNING,
          message: 'Conditional has empty then branch',
          source: conditional.nodeId,
          suggestion: 'Provide content for when condition is true'
        });
        score -= 5;
      }
    }

    return { isValid: score > 0, warnings, suggestions, score: Math.max(0, score) };
  }

  /**
   * Validate iteration concepts.
   */
  validateIterations(iterations: IterationConcept[], context: ValidationContext): ValidationResult {
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];
    let score = 100;

    for (const iteration of iterations) {
      // Validate required fields
      if (!iteration.items || iteration.items.trim() === '') {
        warnings.push({
          severity: ValidationSeverity.ERROR,
          message: 'Iteration missing items expression',
          source: iteration.nodeId
        });
        score -= 15;
      }

      if (!iteration.itemVariable || iteration.itemVariable.trim() === '') {
        warnings.push({
          severity: ValidationSeverity.ERROR,
          message: 'Iteration missing item variable name',
          source: iteration.nodeId
        });
        score -= 15;
      }

      // Validate key expression for React
      if (context.framework === 'react' && !iteration.keyExpression) {
        warnings.push({
          severity: ValidationSeverity.WARNING,
          message: 'React iterations should have a key expression for performance',
          source: iteration.nodeId,
          suggestion: 'Add a unique key expression (e.g., item.id)'
        });
        score -= 8;
      }

      // Performance checks
      if (context.options.checkPerformance && !iteration.keyExpression) {
        suggestions.push({
          type: 'performance',
          message: 'Add key expression for better rendering performance',
          target: iteration.nodeId,
          priority: 4
        });
      }
    }

    return { isValid: score > 0, warnings, suggestions, score: Math.max(0, score) };
  }

  /**
   * Validate slot concepts.
   */
  validateSlots(slots: SlotConcept[], context: ValidationContext): ValidationResult {
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];
    let score = 100;

    const slotNames = new Set<string>();

    for (const slot of slots) {
      // Validate slot name
      if (!slot.name || slot.name.trim() === '') {
        warnings.push({
          severity: ValidationSeverity.ERROR,
          message: 'Slot missing name',
          source: slot.nodeId
        });
        score -= 10;
      } else {
        // Check for duplicate slot names
        if (slotNames.has(slot.name)) {
          warnings.push({
            severity: ValidationSeverity.WARNING,
            message: `Duplicate slot name: ${slot.name}`,
            source: slot.nodeId,
            suggestion: 'Use unique slot names within a component'
          });
          score -= 5;
        }
        slotNames.add(slot.name);
      }

      // Suggest fallback content
      if (!slot.fallback) {
        suggestions.push({
          type: 'best-practice',
          message: 'Consider providing fallback content for slots',
          target: slot.nodeId,
          priority: 2
        });
      }
    }

    return { isValid: score > 0, warnings, suggestions, score: Math.max(0, score) };
  }

  /**
   * Validate attribute concepts.
   */
  validateAttributes(attributes: AttributeConcept[], context: ValidationContext): ValidationResult {
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];
    let score = 100;

    const attributeNames = new Set<string>();

    for (const attr of attributes) {
      // Validate attribute name
      if (!attr.name || attr.name.trim() === '') {
        warnings.push({
          severity: ValidationSeverity.ERROR,
          message: 'Attribute missing name',
          source: attr.nodeId
        });
        score -= 10;
        continue;
      }

      // Check for duplicate attributes
      if (attributeNames.has(attr.name)) {
        warnings.push({
          severity: ValidationSeverity.WARNING,
          message: `Duplicate attribute: ${attr.name}`,
          source: attr.nodeId
        });
        score -= 3;
      }
      attributeNames.add(attr.name);

      // Validate HTML attribute name
      if (!this.isValidAttributeName(attr.name)) {
        warnings.push({
          severity: ValidationSeverity.WARNING,
          message: `Invalid HTML attribute name: ${attr.name}`,
          source: attr.nodeId,
          suggestion: 'Use valid HTML attribute names'
        });
        score -= 5;
      }

      // Accessibility checks
      if (context.options.checkAccessibility) {
        const a11yWarnings = this.validateAttributeAccessibility(attr);
        warnings.push(...a11yWarnings);
      }
    }

    return { isValid: score > 0, warnings, suggestions, score: Math.max(0, score) };
  }

  /**
   * Validate concept consistency across all concepts.
   */
  validateConceptConsistency(concepts: ComponentConcept, context: ValidationContext): ValidationResult {
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];
    let score = 100;

    // Check for conflicting patterns
    const hasInlineStyles = Object.keys(concepts.styling.inlineStyles).length > 0;
    const hasStyleClasses = concepts.styling.staticClasses.length > 0;

    if (hasInlineStyles && hasStyleClasses) {
      suggestions.push({
        type: 'best-practice',
        message: 'Mixing inline styles and CSS classes can impact maintainability',
        target: 'component',
        priority: 2
      });
    }

    // Check for proper accessibility
    if (context.options.checkAccessibility) {
      if (concepts.events.some(e => e.name === 'click') && 
          !concepts.attributes.some(a => a.name === 'role')) {
        suggestions.push({
          type: 'accessibility',
          message: 'Interactive elements should have appropriate ARIA roles',
          target: 'component',
          priority: 4
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
      'click', 'change', 'submit', 'input', 'focus', 'blur',
      'keydown', 'keyup', 'mousedown', 'mouseup', 'mouseover',
      'mouseout', 'load', 'error', 'resize', 'scroll'
    ];
    return commonEvents.includes(name.toLowerCase());
  }

  private isValidClassName(className: string): boolean {
    return /^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(className);
  }

  private isValidCSSProperty(property: string): boolean {
    // Simplified check - in real implementation, use a comprehensive CSS property list
    return /^[a-z-]+$/.test(property) && !property.startsWith('--invalid');
  }

  private isValidAttributeName(name: string): boolean {
    return /^[a-zA-Z_:][-a-zA-Z0-9_:.]*$/.test(name);
  }

  private isComplexCondition(condition: string): boolean {
    // Consider complex if it has multiple operators or function calls
    return condition.includes('&&') || condition.includes('||') || condition.includes('(');
  }

  private validateEventForFramework(event: EventConcept, framework: string): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    switch (framework) {
      case 'react':
        if (event.modifiers && event.modifiers.length > 0) {
          warnings.push({
            severity: ValidationSeverity.WARNING,
            message: 'React does not support event modifiers directly',
            source: event.nodeId,
            suggestion: 'Handle modifiers in the event handler function'
          });
        }
        break;
    }

    return warnings;
  }

  private validateEventAccessibility(event: EventConcept): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    if (event.name === 'click') {
      // Could suggest keyboard equivalent
      warnings.push({
        severity: ValidationSeverity.INFO,
        message: 'Consider adding keyboard event handlers for accessibility',
        source: event.nodeId,
        suggestion: 'Add onKeyDown handler with Enter/Space key checks'
      });
    }

    return warnings;
  }

  private validateAttributeAccessibility(attr: AttributeConcept): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    // Check for missing alt text on images
    if (attr.name === 'src' && !attr.value.toString().includes('alt')) {
      warnings.push({
        severity: ValidationSeverity.WARNING,
        message: 'Images should have alt text for accessibility',
        source: attr.nodeId,
        suggestion: 'Add alt attribute to describe the image'
      });
    }

    return warnings;
  }

  private suggestEventAccessibilityImprovements(event: EventConcept): ValidationSuggestion[] {
    const suggestions: ValidationSuggestion[] = [];

    if (event.name === 'click') {
      suggestions.push({
        type: 'accessibility',
        message: 'Add keyboard support for click events',
        target: event.nodeId,
        priority: 3
      });
    }

    return suggestions;
  }

  private suggestStylingBestPractices(styling: StylingConcept): ValidationSuggestion[] {
    const suggestions: ValidationSuggestion[] = [];

    if (styling.staticClasses.length > 8) {
      suggestions.push({
        type: 'best-practice',
        message: 'Consider using fewer, more semantic CSS classes',
        target: styling.nodeId,
        priority: 2
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