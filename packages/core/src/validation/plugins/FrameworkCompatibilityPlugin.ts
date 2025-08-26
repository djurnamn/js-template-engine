/**
 * Framework compatibility validation plugin for ConceptValidator
 */

import { ValidationWarning, ValidationSeverity } from '../ConceptValidator';

export interface ValidationResult {
  isValid: boolean;
  warnings: ValidationWarning[];
  suggestions: string[];
}

export class FrameworkCompatibilityPlugin {
  checkFrameworkCompatibility(concept: any): ValidationResult {
    return { 
      isValid: true, 
      warnings: [], 
      suggestions: [] 
    };
  }
}