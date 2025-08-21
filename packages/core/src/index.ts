// Export legacy engine (will be deprecated)
export { TemplateEngine } from './engine/TemplateEngine';

// Export new concept-driven engine (recommended)
export { ConceptEngine } from './integration/ConceptEngine';

// Export core components for advanced usage
export { ExtensionRegistry } from './registry/ExtensionRegistry';
export { ProcessingPipeline } from './pipeline/ProcessingPipeline';
export { TemplateAnalyzer } from './analyzer/TemplateAnalyzer';
export { ErrorCollector, PerformanceTracker, NodeIdGenerator, MetadataValidator } from './metadata';

// Export type definitions
export * from './concepts';
export * from './extensions';

// Export handlers
export * from './handlers/FileHandler';

// Export helpers
export { createLogger } from './utils/logger';

// Export utils
export * from './utils/extension-helpers';
