export class TemplateEngineError extends Error {
  context?: any;
  constructor(message: string, context?: any) {
    super(message);
    this.name = 'TemplateEngineError';
    this.context = context;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class ValidationError extends TemplateEngineError {
  constructor(message: string, context?: any) {
    super(message, context);
    this.name = 'ValidationError';
  }
}

export class ExtensionError extends TemplateEngineError {
  constructor(message: string, context?: any) {
    super(message, context);
    this.name = 'ExtensionError';
  }
}

export class FileOutputError extends TemplateEngineError {
  constructor(message: string, context?: any) {
    super(message, context);
    this.name = 'FileOutputError';
  }
}

export class RenderError extends TemplateEngineError {
  constructor(message: string, context?: any) {
    super(message, context);
    this.name = 'RenderError';
  }
} 