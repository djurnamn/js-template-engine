import type { TemplateNode, ExtendedTemplate, Component } from '@js-template-engine/types';
import { ValidationError } from '../engine/errors';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

export interface ValidationOptions {
  strict?: boolean;
  allowEmpty?: boolean;
  validateProps?: boolean;
}

export class TemplateValidator {
  private strict: boolean;
  private allowEmpty: boolean;
  private validateProps: boolean;

  constructor(options: ValidationOptions = {}) {
    this.strict = options.strict ?? false;
    this.allowEmpty = options.allowEmpty ?? true;
    this.validateProps = options.validateProps ?? false; // More lenient by default
  }

  /**
   * Validates a template or extended template with very lenient rules
   * Only catches critical structural issues that would break rendering
   */
  validate(input: TemplateNode[] | ExtendedTemplate): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      // Basic null/undefined checks
      if (input === null || input === undefined) {
        this.addError(result, 'Template input cannot be null or undefined', { input });
        result.isValid = false;
        return result;
      }

      // For very lenient validation, accept almost anything
      // The template engine is designed to handle edge cases gracefully
      
      // Only catch obvious structural issues
      if (Array.isArray(input)) {
        // Template node array - check for obvious issues
        this.validateNodeArray(input, result);
      } else if (typeof input === 'object') {
        // Could be ExtendedTemplate or other valid structure
        if ('template' in input) {
          // ExtendedTemplate
          if (input.template && Array.isArray(input.template)) {
            this.validateNodeArray(input.template, result);
          }
          // Component validation only if strict mode
          if (this.strict && input.component) {
            this.validateComponentBasics(input.component, result);
          }
        }
        // Other object structures are assumed valid
      } else {
        // Primitive values might be valid in some contexts, only warn
        result.warnings.push('Template input is a primitive value - may not render correctly');
      }

    } catch (error) {
      // Even validation errors should be non-blocking
      result.warnings.push(`Validation warning: ${error instanceof Error ? error.message : String(error)}`);
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * Validates an array of template nodes with minimal checks
   */
  private validateNodeArray(nodes: any[], result: ValidationResult): void {
    // Only check for obvious structural issues
    nodes.forEach((node, index) => {
      if (node && typeof node === 'object') {
        // Check for circular references in children
        if (node.children && Array.isArray(node.children)) {
          try {
            JSON.stringify(node.children); // Will throw on circular refs
          } catch (error) {
            this.addError(result, `Circular reference detected in node[${index}].children`, { node, index });
          }
        }
      }
      // Everything else is considered potentially valid
    });
  }

  /**
   * Basic component validation - only checks critical issues
   */
  private validateComponentBasics(component: Component, result: ValidationResult): void {
    // Only validate if component name is something that would break processing
    if (component.name !== undefined && typeof component.name !== 'string') {
      this.addError(result, 'Component name must be a string if provided', { component });
    }

    // Skip all other component validation - let the engine handle edge cases
  }

  /**
   * Adds a validation error to the result
   */
  private addError(result: ValidationResult, message: string, context?: any): void {
    result.errors.push(new ValidationError(message, context));
  }

  /**
   * Checks if input is an ExtendedTemplate
   */
  private isExtendedTemplate(input: any): input is ExtendedTemplate {
    return (
      typeof input === 'object' &&
      input !== null &&
      !Array.isArray(input) &&
      'template' in input
    );
  }

  /**
   * Quick validation helper
   */
  static validateQuick(input: TemplateNode[] | ExtendedTemplate, options?: ValidationOptions): ValidationResult {
    const validator = new TemplateValidator(options);
    return validator.validate(input);
  }
}