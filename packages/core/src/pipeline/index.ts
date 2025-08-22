/**
 * Processing Pipeline - Clean and Legacy
 * 
 * Export the main ProcessingPipeline and legacy versions for compatibility.
 */

export { LegacyProcessingPipeline } from './LegacyProcessingPipeline';
export { ProcessingPipeline } from './ProcessingPipeline'; // THE implementation

// Re-export types
export type {
  LegacyProcessingOptions,
  LegacyProcessingResult,
  ProcessedConcepts,
  ProcessingMetadata,
  ActiveExtensions
} from './LegacyProcessingPipeline';

export type {
  ProcessingOptions,
  ProcessingResult
} from './ProcessingPipeline';

