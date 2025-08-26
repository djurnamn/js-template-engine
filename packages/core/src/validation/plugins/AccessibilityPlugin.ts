/**
 * Accessibility validation plugin for ConceptValidator
 */

import { ValidationWarning, ValidationSeverity } from '../ConceptValidator';

export interface ValidationResult {
  isValid: boolean;
  warnings: ValidationWarning[];
  suggestions: string[];
}

export class AccessibilityPlugin {
  checkAccessibility(concept: any): ValidationResult {
    return { 
      isValid: true, 
      warnings: [], 
      suggestions: [] 
    };
  }
}