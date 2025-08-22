/**
 * advanced processing Normalization - Cross-Framework Consistency
 * 
 * Export all normalization utilities for cross-framework compatibility.
 */

export { EventNormalizer, defaultEventNormalizer } from './EventNormalizer';

// Re-export types
export type {
  FrameworkEventMapping,
  EventNormalization,
  NormalizedEvent,
  EventNormalizationOptions
} from './EventNormalizer';

// Export constants
export { EVENT_NORMALIZATION } from './EventNormalizer';