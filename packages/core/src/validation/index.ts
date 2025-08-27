/**
 * advanced processing Validation - Concept Validation with Warnings
 *
 * Export all validation utilities for comprehensive concept validation.
 */

export { ConceptValidator } from './ConceptValidator';
export { FrameworkConsistencyChecker } from './FrameworkConsistencyChecker';

// Re-export types
export type {
  ValidationResult,
  ValidationWarning,
  ValidationSuggestion,
  FrameworkCompatibilityResult,
  ValidationOptions,
  ValidationRule,
  ValidationContext,
  ValidationSeverity,
} from './ConceptValidator';

export type {
  ConsistencyReport,
  ConsistencyRecommendation,
} from './FrameworkConsistencyChecker';
