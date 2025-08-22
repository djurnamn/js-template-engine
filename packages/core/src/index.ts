// Core processing pipeline

// Export core components for advanced usage
export { ExtensionRegistry } from './registry/ExtensionRegistry';
export * from './pipeline';
export { TemplateAnalyzer } from './analyzer/TemplateAnalyzer';
export { ErrorCollector, PerformanceTracker, NodeIdGenerator, MetadataValidator } from './metadata';

// Export type definitions
export * from './concepts';
export * from './extensions';

// Core processing exports - Processing capabilities
export * from './processors';
export * from './extractors';
export * from './validation';
export * from './normalization';
export * from './examples/TemplateProcessingExamples';

// Export handlers
export * from './handlers/FileHandler';

// Export helpers
export { createLogger } from './utils/logger';

// Export utils
export * from './utils/extension-helpers';
