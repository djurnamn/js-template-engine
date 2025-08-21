/**
 * Tests for metadata system.
 */

import {
  NodeIdGenerator,
  ErrorCollector,
  MetadataValidator,
  PerformanceTracker,
  ProcessingError
} from '../../src/metadata';
import { vi } from 'vitest';

describe('Metadata System', () => {
  describe('NodeIdGenerator', () => {
    it('should generate root node ID', () => {
      const nodeId = NodeIdGenerator.generateNodeId([]);
      expect(nodeId).toBe('root');
    });

    it('should generate path-based node IDs', () => {
      expect(NodeIdGenerator.generateNodeId([0])).toBe('root.children[0]');
      expect(NodeIdGenerator.generateNodeId([0, 1])).toBe('root.children[0].children[1]');
      expect(NodeIdGenerator.generateNodeId([2, 0, 3])).toBe('root.children[2].children[0].children[3]');
    });

    it('should parse node IDs back to paths', () => {
      expect(NodeIdGenerator.parseNodeId('root')).toEqual([]);
      expect(NodeIdGenerator.parseNodeId('root.children[0]')).toEqual([0]);
      expect(NodeIdGenerator.parseNodeId('root.children[0].children[1]')).toEqual([0, 1]);
      expect(NodeIdGenerator.parseNodeId('root.children[2].children[0].children[3]')).toEqual([2, 0, 3]);
    });

    it('should handle invalid node IDs when parsing', () => {
      expect(NodeIdGenerator.parseNodeId('invalid')).toEqual([]);
      expect(NodeIdGenerator.parseNodeId('root.invalid')).toEqual([]);
    });
  });

  describe('ErrorCollector', () => {
    let collector: ErrorCollector;

    beforeEach(() => {
      collector = new ErrorCollector();
    });

    it('should add and retrieve errors', () => {
      const error: ProcessingError = {
        message: 'Test error',
        nodeId: 'root.children[0]',
        extension: 'test-ext',
        severity: 'error'
      };

      collector.addError(error);
      const errors = collector.getErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual(error);
    });

    it('should add simple errors', () => {
      collector.addSimpleError('Simple error', 'root', 'test');

      const errors = collector.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('Simple error');
      expect(errors[0].nodeId).toBe('root');
      expect(errors[0].extension).toBe('test');
      expect(errors[0].severity).toBe('error');
    });

    it('should add warnings and info messages', () => {
      collector.addWarning('Warning message', 'root.children[0]', 'test');
      collector.addInfo('Info message', 'root.children[1]');

      const warnings = collector.getErrorsBySeverity('warning');
      const infos = collector.getErrorsBySeverity('info');

      expect(warnings).toHaveLength(1);
      expect(warnings[0].severity).toBe('warning');
      expect(infos).toHaveLength(1);
      expect(infos[0].severity).toBe('info');
    });

    it('should check for errors and warnings', () => {
      expect(collector.hasErrors()).toBe(false);
      expect(collector.hasWarnings()).toBe(false);

      collector.addSimpleError('Error', 'root');
      collector.addWarning('Warning', 'root');

      expect(collector.hasErrors()).toBe(true);
      expect(collector.hasWarnings()).toBe(true);
    });

    it('should get error counts', () => {
      collector.addSimpleError('Error 1', 'root');
      collector.addSimpleError('Error 2', 'root');
      collector.addWarning('Warning', 'root');
      collector.addInfo('Info', 'root');

      expect(collector.getErrorCount()).toBe(4);
      expect(collector.getErrorCount('error')).toBe(2);
      expect(collector.getErrorCount('warning')).toBe(1);
      expect(collector.getErrorCount('info')).toBe(1);
    });

    it('should clear errors', () => {
      collector.addSimpleError('Error', 'root');
      collector.addWarning('Warning', 'root');

      expect(collector.getErrorCount()).toBe(2);

      collector.clear();

      expect(collector.getErrorCount()).toBe(0);
      expect(collector.hasErrors()).toBe(false);
      expect(collector.hasWarnings()).toBe(false);
    });

    it('should format errors for display', () => {
      collector.addSimpleError('First error', 'root.children[0]', 'extension1');
      collector.addWarning('Warning message', 'root.children[0]', 'extension2');
      collector.addInfo('Info message', 'root.children[1]');

      const formatted = collector.formatErrors();

      expect(formatted).toContain('Node: root.children[0]');
      expect(formatted).toContain('Node: root.children[1]');
      expect(formatted).toContain('❌ First error [extension1]');
      expect(formatted).toContain('⚠️ Warning message [extension2]');
      expect(formatted).toContain('ℹ️ Info message');
    });

    it('should handle empty error collection', () => {
      const formatted = collector.formatErrors();
      expect(formatted).toBe('No errors or warnings');
    });

    it('should format errors with context', () => {
      collector.addError({
        message: 'Error with context',
        nodeId: 'root',
        severity: 'error',
        context: { key: 'value', number: 42 }
      });

      const formatted = collector.formatErrors();
      expect(formatted).toContain('Context:');
      expect(formatted).toContain('"key": "value"');
      expect(formatted).toContain('"number": 42');
    });
  });

  describe('MetadataValidator', () => {
    describe('Extension Metadata Validation', () => {
      it('should validate valid extension metadata', () => {
        const metadata = {
          key: 'react-ext',
          name: 'React Extension',
          version: '1.2.3',
          type: 'framework' as const
        };

        const errors = MetadataValidator.validateExtensionMetadata(metadata);
        expect(errors).toEqual([]);
      });

      it('should validate extension key format', () => {
        const invalidKeys = ['', 'React', 'react_ext', '123react', 'react-'];
        
        invalidKeys.forEach(key => {
          const metadata = {
            key,
            name: 'Test Extension',
            version: '1.0.0',
            type: 'framework' as const
          };

          const errors = MetadataValidator.validateExtensionMetadata(metadata);
          expect(errors.length).toBeGreaterThan(0);
        });

        const validKeys = ['react', 'vue-ext', 'bem-styling', 'a', 'a1', 'test-123'];
        
        validKeys.forEach(key => {
          const metadata = {
            key,
            name: 'Test Extension',
            version: '1.0.0',
            type: 'framework' as const
          };

          const errors = MetadataValidator.validateExtensionMetadata(metadata);
          expect(errors.filter(e => e.includes('key'))).toEqual([]);
        });
      });

      it('should validate version format', () => {
        const invalidVersions = ['1.0', '1', 'v1.0.0', '1.0.0-alpha'];
        
        invalidVersions.forEach(version => {
          const metadata = {
            key: 'test',
            name: 'Test Extension',
            version,
            type: 'framework' as const
          };

          const errors = MetadataValidator.validateExtensionMetadata(metadata);
          expect(errors.some(e => e.includes('semantic versioning'))).toBe(true);
        });

        const validVersions = ['1.0.0', '10.20.30', '0.0.1'];
        
        validVersions.forEach(version => {
          const metadata = {
            key: 'test',
            name: 'Test Extension',
            version,
            type: 'framework' as const
          };

          const errors = MetadataValidator.validateExtensionMetadata(metadata);
          expect(errors.filter(e => e.includes('version'))).toEqual([]);
        });
      });

      it('should validate extension type', () => {
        const invalidType = {
          key: 'test',
          name: 'Test Extension',
          version: '1.0.0',
          type: 'invalid' as any
        };

        const errors = MetadataValidator.validateExtensionMetadata(invalidType);
        expect(errors).toContain('Extension type must be one of: framework, styling, utility');

        ['framework', 'styling', 'utility'].forEach(type => {
          const validMetadata = {
            key: 'test',
            name: 'Test Extension',
            version: '1.0.0',
            type: type as any
          };

          const errors = MetadataValidator.validateExtensionMetadata(validMetadata);
          expect(errors.filter(e => e.includes('type'))).toEqual([]);
        });
      });

      it('should validate required fields', () => {
        const missingFields = {
          key: undefined as any,
          name: undefined as any,
          version: undefined as any,
          type: undefined as any
        };

        const errors = MetadataValidator.validateExtensionMetadata(missingFields);
        expect(errors).toContain('Extension key is required and must be a string');
        expect(errors).toContain('Extension name is required and must be a string');
        expect(errors).toContain('Extension version is required and must be a string');
        expect(errors).toContain('Extension type must be one of: framework, styling, utility');
      });
    });

    describe('Node ID Validation', () => {
      it('should validate valid node IDs', () => {
        const validIds = [
          'root',
          'root.children[0]',
          'root.children[0].children[1]',
          'root.children[10].children[20].children[30]'
        ];

        validIds.forEach(nodeId => {
          expect(MetadataValidator.validateNodeId(nodeId)).toBe(true);
        });
      });

      it('should invalidate invalid node IDs', () => {
        const invalidIds = [
          '',
          null as any,
          undefined as any,
          'invalid',
          'root.invalid',
          'root.children',
          'root.children[a]',
          'root.children[-1]',
          '.root',
          'root.'
        ];

        invalidIds.forEach(nodeId => {
          expect(MetadataValidator.validateNodeId(nodeId)).toBe(false);
        });
      });
    });
  });

  describe('PerformanceTracker', () => {
    let tracker: PerformanceTracker;
    let mockPerformanceNow: any;

    beforeEach(() => {
      tracker = new PerformanceTracker();
      mockPerformanceNow = vi.spyOn(performance, 'now');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should track overall performance', () => {
      mockPerformanceNow
        .mockReturnValueOnce(0)   // start()
        .mockReturnValueOnce(100); // getMetrics()

      tracker.start();
      tracker.incrementConceptCount();
      tracker.incrementConceptCount();

      const metrics = tracker.getMetrics();

      expect(metrics.totalTime).toBe(100);
      expect(metrics.conceptCount).toBe(2);
    });

    it('should track extension performance', () => {
      mockPerformanceNow
        .mockReturnValueOnce(0)   // start()
        .mockReturnValueOnce(10)  // startExtension('react')
        .mockReturnValueOnce(25)  // endExtension('react')
        .mockReturnValueOnce(100); // getMetrics()

      tracker.start();
      tracker.startExtension('react');
      tracker.endExtension('react');

      const metrics = tracker.getMetrics();

      expect(metrics.extensionTimes.react).toBe(15); // 25 - 10
    });

    it('should handle multiple extension timings', () => {
      mockPerformanceNow
        .mockReturnValueOnce(0)    // start()
        .mockReturnValueOnce(10)   // startExtension('react')
        .mockReturnValueOnce(30)   // endExtension('react')
        .mockReturnValueOnce(40)   // startExtension('vue')
        .mockReturnValueOnce(70)   // endExtension('vue')
        .mockReturnValueOnce(80)   // startExtension('react') again
        .mockReturnValueOnce(90)   // endExtension('react') again
        .mockReturnValueOnce(100); // getMetrics()

      tracker.start();
      
      tracker.startExtension('react');
      tracker.endExtension('react');
      
      tracker.startExtension('vue');
      tracker.endExtension('vue');
      
      tracker.startExtension('react');
      tracker.endExtension('react');

      const metrics = tracker.getMetrics();

      expect(metrics.extensionTimes.react).toBe(30); // (30-10) + (90-80)
      expect(metrics.extensionTimes.vue).toBe(30);   // (70-40)
    });

    it('should format metrics for display', () => {
      // Mock process.memoryUsage for memory tracking
      const originalProcess = global.process;
      global.process = {
        ...originalProcess,
        memoryUsage: vi.fn().mockReturnValue({
          heapUsed: 1024 * 1024 * 50, // 50MB
          heapTotal: 1024 * 1024 * 100 // 100MB
        })
      } as any;

      mockPerformanceNow
        .mockReturnValueOnce(0)   // start()
        .mockReturnValueOnce(10)  // startExtension('react')
        .mockReturnValueOnce(25)  // endExtension('react')
        .mockReturnValueOnce(100); // getMetrics()

      tracker.start();
      tracker.startExtension('react');
      tracker.endExtension('react');
      tracker.incrementConceptCount();

      const formatted = tracker.formatMetrics();

      expect(formatted).toContain('Total Processing Time: 100.00ms');
      expect(formatted).toContain('Concepts Processed: 1');
      expect(formatted).toContain('Extension Performance:');
      expect(formatted).toContain('react: 15.00ms (15.0%)');
      expect(formatted).toContain('Memory Usage: 50.00MB');

      global.process = originalProcess;
    });

    it('should handle metrics without extensions', () => {
      mockPerformanceNow
        .mockReturnValueOnce(0)   // start()
        .mockReturnValueOnce(100); // getMetrics()

      tracker.start();
      tracker.incrementConceptCount();
      tracker.incrementConceptCount();

      const formatted = tracker.formatMetrics();

      expect(formatted).toContain('Total Processing Time: 100.00ms');
      expect(formatted).toContain('Concepts Processed: 2');
      expect(formatted).not.toContain('Extension Performance:');
    });

    it('should handle missing memory usage', () => {
      // Remove process.memoryUsage
      const originalProcess = global.process;
      global.process = undefined as any;

      mockPerformanceNow
        .mockReturnValueOnce(0)   // start()
        .mockReturnValueOnce(100); // getMetrics()

      tracker.start();
      const metrics = tracker.getMetrics();

      expect(metrics.memoryUsage).toBeUndefined();

      const formatted = tracker.formatMetrics();
      expect(formatted).not.toContain('Memory Usage:');

      global.process = originalProcess;
    });
  });
});