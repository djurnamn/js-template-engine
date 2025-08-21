/**
 * Metadata system for extensions and concept processing.
 */

import type { ExtensionMetadata } from '../extensions';

/**
 * Node identification system using path-based IDs.
 */
export class NodeIdGenerator {
  /**
   * Generate a path-based node ID for debugging.
   * Format: "root.children[0].children[1]"
   */
  static generateNodeId(path: number[]): string {
    if (path.length === 0) return 'root';
    
    let id = 'root';
    for (const index of path) {
      id += `.children[${index}]`;
    }
    return id;
  }

  /**
   * Parse a node ID back to path array.
   */
  static parseNodeId(nodeId: string): number[] {
    if (nodeId === 'root') return [];
    
    const matches = nodeId.match(/children\[(\d+)\]/g);
    if (!matches) return [];
    
    return matches.map(match => {
      const num = match.match(/\d+/);
      return num ? parseInt(num[0], 10) : 0;
    });
  }
}

/**
 * Error collection system for better developer experience.
 */
export interface ProcessingError {
  /** Error message */
  message: string;
  /** Node where error occurred */
  nodeId: string;
  /** Extension that caused the error */
  extension?: string;
  /** Error severity */
  severity: 'error' | 'warning' | 'info';
  /** Additional context */
  context?: Record<string, any>;
}

/**
 * Error collector for processing pipeline.
 */
export class ErrorCollector {
  private errors: ProcessingError[] = [];

  /**
   * Add an error to the collection.
   */
  addError(error: ProcessingError): void {
    this.errors.push(error);
  }

  /**
   * Add a simple error with message and node ID.
   */
  addSimpleError(message: string, nodeId: string, extension?: string): void {
    this.addError({
      message,
      nodeId,
      extension,
      severity: 'error'
    });
  }

  /**
   * Add a warning.
   */
  addWarning(message: string, nodeId: string, extension?: string): void {
    this.addError({
      message,
      nodeId,
      extension,
      severity: 'warning'
    });
  }

  /**
   * Add an info message.
   */
  addInfo(message: string, nodeId: string, extension?: string): void {
    this.addError({
      message,
      nodeId,
      extension,
      severity: 'info'
    });
  }

  /**
   * Get all collected errors.
   */
  getErrors(): ProcessingError[] {
    return [...this.errors];
  }

  /**
   * Get errors by severity.
   */
  getErrorsBySeverity(severity: 'error' | 'warning' | 'info'): ProcessingError[] {
    return this.errors.filter(error => error.severity === severity);
  }

  /**
   * Check if there are any errors.
   */
  hasErrors(): boolean {
    return this.errors.some(error => error.severity === 'error');
  }

  /**
   * Check if there are any warnings.
   */
  hasWarnings(): boolean {
    return this.errors.some(error => error.severity === 'warning');
  }

  /**
   * Clear all collected errors.
   */
  clear(): void {
    this.errors = [];
  }

  /**
   * Get error count by severity.
   */
  getErrorCount(severity?: 'error' | 'warning' | 'info'): number {
    if (severity) {
      return this.errors.filter(error => error.severity === severity).length;
    }
    return this.errors.length;
  }

  /**
   * Format errors for display.
   */
  formatErrors(): string {
    if (this.errors.length === 0) {
      return 'No errors or warnings';
    }

    const errorMessages: string[] = [];
    const errorsByNode = new Map<string, ProcessingError[]>();

    // Group errors by node
    for (const error of this.errors) {
      if (!errorsByNode.has(error.nodeId)) {
        errorsByNode.set(error.nodeId, []);
      }
      errorsByNode.get(error.nodeId)!.push(error);
    }

    // Format errors by node
    for (const [nodeId, nodeErrors] of errorsByNode) {
      errorMessages.push(`\nNode: ${nodeId}`);
      
      for (const error of nodeErrors) {
        const prefix = error.severity === 'error' ? '  ❌' : error.severity === 'warning' ? '  ⚠️' : '  ℹ️';
        const extension = error.extension ? ` [${error.extension}]` : '';
        errorMessages.push(`${prefix} ${error.message}${extension}`);
        
        if (error.context) {
          errorMessages.push(`     Context: ${JSON.stringify(error.context, null, 2).replace(/\n/g, '\n     ')}`);
        }
      }
    }

    return errorMessages.join('\n');
  }
}

/**
 * Extension metadata validator.
 */
export class MetadataValidator {
  /**
   * Validate extension metadata.
   */
  static validateExtensionMetadata(metadata: ExtensionMetadata): string[] {
    const errors: string[] = [];

    if (!metadata.key || typeof metadata.key !== 'string') {
      errors.push('Extension key is required and must be a string');
    } else if (!/^[a-z][a-z0-9\-]*[a-z0-9]$|^[a-z]$/.test(metadata.key)) {
      errors.push('Extension key must be lowercase alphanumeric with hyphens, starting with a letter');
    }

    if (!metadata.name || typeof metadata.name !== 'string') {
      errors.push('Extension name is required and must be a string');
    }

    if (!metadata.version || typeof metadata.version !== 'string') {
      errors.push('Extension version is required and must be a string');
    } else if (!/^\d+\.\d+\.\d+$/.test(metadata.version)) {
      errors.push('Extension version must follow semantic versioning (e.g., "1.0.0")');
    }

    if (!metadata.type || !['framework', 'styling', 'utility'].includes(metadata.type)) {
      errors.push('Extension type must be one of: framework, styling, utility');
    }

    return errors;
  }

  /**
   * Validate concept node ID.
   */
  static validateNodeId(nodeId: string): boolean {
    if (!nodeId || typeof nodeId !== 'string') {
      return false;
    }

    // Allow 'root' or path-based IDs
    return nodeId === 'root' || /^root(\.children\[\d+\])*$/.test(nodeId);
  }
}

/**
 * Performance tracking for concept processing.
 */
export interface PerformanceMetrics {
  /** Total processing time in milliseconds */
  totalTime: number;
  /** Time spent per extension */
  extensionTimes: Record<string, number>;
  /** Number of concepts processed */
  conceptCount: number;
  /** Memory usage if available */
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
  };
}

/**
 * Performance tracker for debugging and optimization.
 */
export class PerformanceTracker {
  private startTime: number = 0;
  private extensionTimes: Record<string, number> = {};
  private extensionStarts: Record<string, number> = {};
  private conceptCount: number = 0;

  /**
   * Start tracking overall performance.
   */
  start(): void {
    this.startTime = performance.now();
    this.extensionTimes = {};
    this.extensionStarts = {};
    this.conceptCount = 0;
  }

  /**
   * Start tracking an extension's performance.
   */
  startExtension(extensionKey: string): void {
    this.extensionStarts[extensionKey] = performance.now();
  }

  /**
   * End tracking an extension's performance.
   */
  endExtension(extensionKey: string): void {
    const startTime = this.extensionStarts[extensionKey];
    if (startTime) {
      const duration = performance.now() - startTime;
      this.extensionTimes[extensionKey] = (this.extensionTimes[extensionKey] || 0) + duration;
      delete this.extensionStarts[extensionKey];
    }
  }

  /**
   * Increment concept count.
   */
  incrementConceptCount(): void {
    this.conceptCount++;
  }

  /**
   * Get performance metrics.
   */
  getMetrics(): PerformanceMetrics {
    const totalTime = performance.now() - this.startTime;
    
    let memoryUsage;
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memory = process.memoryUsage();
      memoryUsage = {
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal
      };
    }

    return {
      totalTime,
      extensionTimes: { ...this.extensionTimes },
      conceptCount: this.conceptCount,
      memoryUsage
    };
  }

  /**
   * Format metrics for display.
   */
  formatMetrics(): string {
    const metrics = this.getMetrics();
    const lines: string[] = [];

    lines.push(`Total Processing Time: ${metrics.totalTime.toFixed(2)}ms`);
    lines.push(`Concepts Processed: ${metrics.conceptCount}`);
    
    if (Object.keys(metrics.extensionTimes).length > 0) {
      lines.push('\nExtension Performance:');
      for (const [extension, time] of Object.entries(metrics.extensionTimes)) {
        const percentage = ((time / metrics.totalTime) * 100).toFixed(1);
        lines.push(`  ${extension}: ${time.toFixed(2)}ms (${percentage}%)`);
      }
    }

    if (metrics.memoryUsage) {
      const heapMB = (metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
      lines.push(`\nMemory Usage: ${heapMB}MB`);
    }

    return lines.join('\n');
  }
}