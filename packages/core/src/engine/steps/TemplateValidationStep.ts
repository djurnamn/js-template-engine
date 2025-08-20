import type {
  RenderContext,
  PipelineStep,
  PipelineStepResult,
} from '../../types/renderContext';
import { TemplateValidator, ValidationOptions } from '../../validation/template';
import { ValidationError } from '../errors';

/**
 * Pipeline step that validates template structure and components before processing.
 * This catches issues early and provides helpful error messages.
 */
export class TemplateValidationStep implements PipelineStep {
  name = 'TemplateValidation';
  runForNonRoot = false; // Only validate at root level

  private validator: TemplateValidator;

  constructor(options: ValidationOptions = {}) {
    this.validator = new TemplateValidator({
      strict: false, // Don't be too strict by default
      allowEmpty: true, // Allow empty templates for some use cases
      validateProps: false, // Don't validate component props in pipeline (too strict)
      ...options
    });
  }

  /**
   * Executes template validation.
   * @param context - The rendering context containing the input to validate.
   * @returns A promise that resolves to the pipeline step result.
   */
  async execute(context: RenderContext): Promise<PipelineStepResult> {
    try {
      // Validate the input template
      const validationResult = this.validator.validate(context.input);

      // Add warnings to context if present
      if (validationResult.warnings.length > 0) {
        // Store warnings in context for other steps to access
        (context as any).warnings = [
          ...((context as any).warnings || []),
          ...validationResult.warnings
        ];
      }

      // If validation failed, return error result
      if (!validationResult.isValid) {
        const primaryError = validationResult.errors[0];
        const errorMessage = `Template validation failed: ${primaryError.message}`;
        
        // Include additional errors in context for detailed reporting
        const detailedContext = {
          validationErrors: validationResult.errors.map(err => ({
            message: err.message,
            context: err.context
          })),
          warnings: validationResult.warnings,
          originalInput: context.input
        };

        return {
          success: false,
          error: new ValidationError(errorMessage, detailedContext),
          context
        };
      }

      // Validation passed, continue with the same context
      return {
        success: true,
        context
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: new ValidationError(`Template validation step failed: ${errorMessage}`, {
          originalError: error,
          input: context.input
        }),
        context
      };
    }
  }
}