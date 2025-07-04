/**
 * Base error class for all template engine errors.
 * Provides context information and proper error handling.
 */
export class TemplateEngineError extends Error {
  /**
   * Additional context information for debugging.
   */
  context?: any;

  /**
   * Creates a new TemplateEngineError instance.
   * @param message - The error message.
   * @param context - Optional context information for debugging.
   */
  constructor(message: string, context?: any) {
    super(message);
    this.name = 'TemplateEngineError';
    this.context = context;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Error thrown when template validation fails.
 * Used for invalid template structure, missing required fields, or type mismatches.
 */
export class ValidationError extends TemplateEngineError {
  /**
   * Creates a new ValidationError instance.
   * @param message - The validation error message.
   * @param context - Optional context information for debugging.
   */
  constructor(message: string, context?: any) {
    super(message, context);
    this.name = 'ValidationError';
  }
}

/**
 * Error thrown when extension processing fails.
 * Used for extension initialization, hook execution, or configuration errors.
 */
export class ExtensionError extends TemplateEngineError {
  /**
   * Creates a new ExtensionError instance.
   * @param message - The extension error message.
   * @param context - Optional context information for debugging.
   */
  constructor(message: string, context?: any) {
    super(message, context);
    this.name = 'ExtensionError';
  }
}

/**
 * Error thrown when file output operations fail.
 * Used for file writing, directory creation, or path resolution errors.
 */
export class FileOutputError extends TemplateEngineError {
  /**
   * Creates a new FileOutputError instance.
   * @param message - The file output error message.
   * @param context - Optional context information for debugging.
   */
  constructor(message: string, context?: any) {
    super(message, context);
    this.name = 'FileOutputError';
  }
}

/**
 * Error thrown when template rendering fails.
 * Used for rendering pipeline errors, node processing failures, or output generation issues.
 */
export class RenderError extends TemplateEngineError {
  /**
   * Creates a new RenderError instance.
   * @param message - The rendering error message.
   * @param context - Optional context information for debugging.
   */
  constructor(message: string, context?: any) {
    super(message, context);
    this.name = 'RenderError';
  }
}
