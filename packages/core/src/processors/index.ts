/**
 * advanced processing Processors - Template Properties Abstraction
 * 
 * Export all processors for template property merging and component resolution.
 */

export { ComponentPropertyProcessor } from './ComponentPropertyProcessor';
export { ImportProcessor } from './ImportProcessor';
export { ScriptMergeProcessor } from './ScriptMergeProcessor';
export { ComponentNameResolver } from './ComponentNameResolver';

// Re-export types and constants
export type {
  ImportDefinition,
  ComponentProperties,
  ScriptMergeStrategy,
  PropMergeStrategy,
  ImportMergeStrategy,
  ComponentResolutionStrategy,
  ComponentDefinition,
  RenderOptions
} from './ComponentPropertyProcessor';

export { DEFAULT_MERGE_STRATEGIES } from './ComponentPropertyProcessor';

export type {
  ImportString,
  ImportInput,
  ParsedImport,
  ImportProcessingOptions,
  ImportValidationResult
} from './ImportProcessor';

export type {
  ScriptElement,
  ScriptAnalysis,
  ScriptConflict,
  ScriptMergeResult
} from './ScriptMergeProcessor';

export type {
  ComponentNameContext,
  NameResolutionPriority,
  NameResolutionResult
} from './ComponentNameResolver';