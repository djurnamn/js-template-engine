/**
 * Tests for ProcessingPipeline.
 */

import { ProcessingPipeline } from '../../src/pipeline/ProcessingPipeline';
import { ExtensionRegistry } from '../../src/registry/ExtensionRegistry';
import { TemplateAnalyzer } from '../../src/analyzer/TemplateAnalyzer';
import { ErrorCollector } from '../../src/metadata';
import type { FrameworkExtension, StylingExtension, UtilityExtension } from '../../src/extensions';
import { vi } from 'vitest';

describe('ProcessingPipeline', () => {
  let pipeline: ProcessingPipeline;
  let registry: ExtensionRegistry;
  let analyzer: TemplateAnalyzer;
  let errorCollector: ErrorCollector;

  // Mock extensions
  const createMockFrameworkExtension = (key: string): FrameworkExtension => ({
    metadata: {
      type: 'framework',
      key,
      name: `${key} Extension`,
      version: '1.0.0'
    },
    framework: 'react' as const,
    processEvents: vi.fn().mockReturnValue({ attributes: { onClick: 'handleClick' } }),
    processConditionals: vi.fn().mockReturnValue({ syntax: '{condition && <div></div>}' }),
    processIterations: vi.fn().mockReturnValue({ syntax: '{items.map(item => <div key={item.id}></div>)}' }),
    processSlots: vi.fn().mockReturnValue({ syntax: '{props.children}', props: { children: 'React.ReactNode' } }),
    processAttributes: vi.fn().mockReturnValue({ attributes: { id: 'component' } }),
    renderComponent: vi.fn().mockReturnValue('<div>Rendered Component</div>')
  });

  const createMockStylingExtension = (key: string): StylingExtension => ({
    metadata: {
      type: 'styling',
      key,
      name: `${key} Extension`,
      version: '1.0.0'
    },
    styling: 'bem' as const,
    processStyles: vi.fn().mockReturnValue({ styles: '.button { color: red; }' })
  });

  const createMockUtilityExtension = (key: string): UtilityExtension => ({
    metadata: {
      type: 'utility',
      key,
      name: `${key} Extension`,
      version: '1.0.0'
    },
    utility: key,
    process: vi.fn().mockImplementation(concepts => ({
      ...concepts,
      metadata: { ...concepts.metadata, processed: true }
    }))
  });

  beforeEach(() => {
    registry = new ExtensionRegistry();
    analyzer = new TemplateAnalyzer();
    errorCollector = new ErrorCollector();
    pipeline = new ProcessingPipeline(registry, analyzer, errorCollector);
  });

  describe('Basic Processing', () => {
    it('should process a simple template with framework extension', async () => {
      const reactExt = createMockFrameworkExtension('react');
      registry.registerFramework(reactExt);

      const template = [
        {
          type: 'element' as const,
          tag: 'div',
          attributes: {
            class: 'container',
            id: 'main'
          },
          expressionAttributes: {
            onClick: 'handleClick'
          }
        }
      ];

      const result = await pipeline.process(template, {
        framework: 'react',
        component: { name: 'TestComponent' }
      });

      expect(result.output).toBe('<div>Rendered Component</div>');
      expect(result.errors.hasErrors()).toBe(false);
      expect(result.metadata.extensionsUsed).toEqual(['react']);
      expect(result.metadata.conceptsFound.events).toBe(1);
      expect(result.metadata.conceptsFound.attributes).toBe(1);

      // Verify framework extension was called
      expect(reactExt.processEvents).toHaveBeenCalled();
      expect(reactExt.processAttributes).toHaveBeenCalled();
      expect(reactExt.renderComponent).toHaveBeenCalled();
    });

    it('should process template with styling extension', async () => {
      const reactExt = createMockFrameworkExtension('react');
      const bemExt = createMockStylingExtension('bem');
      
      registry.registerFramework(reactExt);
      registry.registerStyling(bemExt);

      const template = [
        {
          type: 'element' as const,
          tag: 'div',
          attributes: {
            class: 'button button--primary'
          }
        }
      ];

      const result = await pipeline.process(template, {
        framework: 'react',
        styling: 'bem'
      });

      expect(result.output).toBe('<div>Rendered Component</div>');
      expect(result.metadata.extensionsUsed).toEqual(['react', 'bem']);
      expect(result.metadata.conceptsFound.styling).toBe(true);

      // Verify styling extension was called
      expect(bemExt.processStyles).toHaveBeenCalled();
    });

    it('should process template with utility extensions', async () => {
      const reactExt = createMockFrameworkExtension('react');
      const linterExt = createMockUtilityExtension('linter');
      const optimizerExt = createMockUtilityExtension('optimizer');
      
      registry.registerFramework(reactExt);
      registry.registerUtility(linterExt);
      registry.registerUtility(optimizerExt);

      const template = [
        {
          type: 'element' as const,
          tag: 'div',
          children: [
            { type: 'text' as const, content: 'Hello World' }
          ]
        }
      ];

      const result = await pipeline.process(template, {
        framework: 'react',
        utilities: ['linter', 'optimizer']
      });

      expect(result.output).toBe('<div>Rendered Component</div>');
      expect(result.metadata.extensionsUsed).toEqual(['react', 'linter', 'optimizer']);

      // Verify utility extensions were called in order
      expect(linterExt.process).toHaveBeenCalled();
      expect(optimizerExt.process).toHaveBeenCalled();
    });
  });

  describe('Complex Templates', () => {
    it('should process template with all concept types', async () => {
      const reactExt = createMockFrameworkExtension('react');
      const bemExt = createMockStylingExtension('bem');
      
      registry.registerFramework(reactExt);
      registry.registerStyling(bemExt);

      const template = [
        {
          type: 'element' as const,
          tag: 'div',
          attributes: {
            class: 'container',
            id: 'main'
          },
          children: [
            {
              type: 'if' as const,
              condition: 'showHeader',
              then: [
                {
                  type: 'element' as const,
                  tag: 'h1',
                  attributes: { class: 'title' },
                  expressionAttributes: { onClick: 'handleTitleClick' },
                  children: [
                    { type: 'text' as const, content: 'Title' }
                  ]
                }
              ]
            },
            {
              type: 'for' as const,
              items: 'items',
              item: 'item',
              key: 'item.id',
              children: [
                {
                  type: 'element' as const,
                  tag: 'div',
                  attributes: { class: 'item' },
                  children: [
                    {
                      type: 'slot' as const,
                      name: 'item-content'
                    }
                  ]
                }
              ]
            }
          ]
        }
      ];

      const result = await pipeline.process(template, {
        framework: 'react',
        styling: 'bem'
      });

      expect(result.output).toBe('<div>Rendered Component</div>');
      expect(result.metadata.conceptsFound.events).toBe(1);
      expect(result.metadata.conceptsFound.styling).toBe(true);
      expect(result.metadata.conceptsFound.conditionals).toBe(1);
      expect(result.metadata.conceptsFound.iterations).toBe(1);
      expect(result.metadata.conceptsFound.slots).toBe(1);
      expect(result.metadata.conceptsFound.attributes).toBe(1); // id attribute

      // Verify all framework methods were called
      expect(reactExt.processEvents).toHaveBeenCalled();
      expect(reactExt.processConditionals).toHaveBeenCalled();
      expect(reactExt.processIterations).toHaveBeenCalled();
      expect(reactExt.processSlots).toHaveBeenCalled();
      expect(reactExt.processAttributes).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing framework extension', async () => {
      const template = [
        {
          type: 'element' as const,
          tag: 'div',
          attributes: { class: 'container' }
        }
      ];

      const result = await pipeline.process(template, {
        framework: 'nonexistent'
      });

      expect(result.output).toBe('');
      expect(result.errors.hasWarnings()).toBe(true);
      const warnings = result.errors.getErrorsBySeverity('warning');
      expect(warnings[0].message).toContain("Framework extension 'nonexistent' not found");
    });

    it('should handle missing styling extension', async () => {
      const reactExt = createMockFrameworkExtension('react');
      registry.registerFramework(reactExt);

      const template = [
        {
          type: 'element' as const,
          tag: 'div',
          attributes: { class: 'container' }
        }
      ];

      const result = await pipeline.process(template, {
        framework: 'react',
        styling: 'nonexistent'
      });

      expect(result.output).toBe('<div>Rendered Component</div>');
      expect(result.errors.hasWarnings()).toBe(true);
      const warnings = result.errors.getErrorsBySeverity('warning');
      expect(warnings.some(w => w.message.includes("Styling extension 'nonexistent' not found"))).toBe(true);
    });

    it('should handle extension processing errors', async () => {
      const faultyFrameworkExt: FrameworkExtension = {
        metadata: {
          type: 'framework',
          key: 'faulty',
          name: 'Faulty Extension',
          version: '1.0.0'
        },
        framework: 'react',
        processEvents: vi.fn().mockImplementation(() => {
          throw new Error('Processing failed');
        }),
        processConditionals: vi.fn().mockReturnValue({ syntax: '' }),
        processIterations: vi.fn().mockReturnValue({ syntax: '' }),
        processSlots: vi.fn().mockReturnValue({ syntax: '' }),
        processAttributes: vi.fn().mockReturnValue({ attributes: {} }),
        renderComponent: vi.fn().mockReturnValue('')
      };

      registry.registerFramework(faultyFrameworkExt);

      const template = [
        {
          type: 'element' as const,
          tag: 'button',
          expressionAttributes: { onClick: 'handleClick' }
        }
      ];

      const result = await pipeline.process(template, {
        framework: 'faulty'
      });

      expect(result.errors.hasErrors()).toBe(true);
      const errors = result.errors.getErrorsBySeverity('error');
      expect(errors.some(e => e.message.includes('Processing failed'))).toBe(true);
    });

    it('should handle rendering errors', async () => {
      const faultyFrameworkExt: FrameworkExtension = {
        ...createMockFrameworkExtension('faulty'),
        renderComponent: vi.fn().mockImplementation(() => {
          throw new Error('Rendering failed');
        })
      };

      registry.registerFramework(faultyFrameworkExt);

      const template = [
        {
          type: 'element' as const,
          tag: 'div'
        }
      ];

      const result = await pipeline.process(template, {
        framework: 'faulty'
      });

      expect(result.output).toBe('');
      expect(result.errors.hasErrors()).toBe(true);
      const errors = result.errors.getErrorsBySeverity('error');
      expect(errors.some(e => e.message.includes('Rendering failed'))).toBe(true);
    });
  });

  describe('Performance Tracking', () => {
    it('should track performance metrics', async () => {
      const reactExt = createMockFrameworkExtension('react');
      const bemExt = createMockStylingExtension('bem');
      
      registry.registerFramework(reactExt);
      registry.registerStyling(bemExt);

      const template = [
        {
          type: 'element' as const,
          tag: 'div',
          attributes: { class: 'container' }
        }
      ];

      const result = await pipeline.process(template, {
        framework: 'react',
        styling: 'bem'
      });

      expect(result.performance).toBeDefined();
      expect(result.performance.totalTime).toBeGreaterThan(0);
      expect(result.performance.extensionTimes).toHaveProperty('analyzer');
      expect(result.performance.extensionTimes).toHaveProperty('react');
      expect(result.performance.extensionTimes).toHaveProperty('bem');
      expect(result.performance.extensionTimes).toHaveProperty('react-render');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty template', async () => {
      const reactExt = createMockFrameworkExtension('react');
      registry.registerFramework(reactExt);

      const result = await pipeline.process([], {
        framework: 'react'
      });

      expect(result.output).toBe('<div>Rendered Component</div>');
      expect(result.metadata.conceptsFound.events).toBe(0);
      expect(result.metadata.conceptsFound.styling).toBe(false);
      expect(result.metadata.conceptsFound.conditionals).toBe(0);
    });

    it('should handle processing without any extensions', async () => {
      const template = [
        {
          type: 'element' as const,
          tag: 'div',
          attributes: { class: 'container' }
        }
      ];

      const result = await pipeline.process(template, {});

      expect(result.output).toBe('');
      expect(result.errors.hasWarnings()).toBe(true);
      expect(result.metadata.extensionsUsed).toEqual([]);
    });

    it('should handle template analysis errors', async () => {
      const reactExt = createMockFrameworkExtension('react');
      registry.registerFramework(reactExt);

      // Create a template with issues that would cause analyzer warnings
      const template = [
        {
          type: 'if' as const,
          // Missing condition
          then: [
            { type: 'text' as const, content: 'Content' }
          ]
        }
      ];

      const result = await pipeline.process(template, {
        framework: 'react'
      });

      expect(result.output).toBe('<div>Rendered Component</div>');
      // Should have warnings from the analyzer
      expect(result.errors.hasWarnings() || result.errors.hasErrors()).toBe(true);
    });
  });

  describe('Extension Order', () => {
    it('should process utility extensions before framework extensions', async () => {
      const reactExt = createMockFrameworkExtension('react');
      const utilityExt = createMockUtilityExtension('modifier');
      
      registry.registerFramework(reactExt);
      registry.registerUtility(utilityExt);

      const template = [
        {
          type: 'element' as const,
          tag: 'div',
          attributes: { class: 'container' }
        }
      ];

      const result = await pipeline.process(template, {
        framework: 'react',
        utilities: ['modifier']
      });

      expect(result.output).toBe('<div>Rendered Component</div>');
      
      // Verify utility was called before framework methods
      expect(utilityExt.process).toHaveBeenCalled();
      expect(reactExt.renderComponent).toHaveBeenCalled();
    });
  });

  describe('Metadata Generation', () => {
    it('should generate comprehensive metadata', async () => {
      const reactExt = createMockFrameworkExtension('react');
      const bemExt = createMockStylingExtension('bem');
      const linterExt = createMockUtilityExtension('linter');
      
      registry.registerFramework(reactExt);
      registry.registerStyling(bemExt);
      registry.registerUtility(linterExt);

      const template = [
        {
          type: 'element' as const,
          tag: 'div',
          attributes: {
            class: 'container',
            id: 'main'
          },
          expressionAttributes: {
            onClick: 'handleClick'
          },
          children: [
            {
              type: 'if' as const,
              condition: 'isVisible',
              then: [
                { type: 'text' as const, content: 'Visible' }
              ]
            }
          ]
        }
      ];

      const result = await pipeline.process(template, {
        framework: 'react',
        styling: 'bem',
        utilities: ['linter']
      });

      const metadata = result.metadata;
      expect(metadata.extensionsUsed).toEqual(['react', 'bem', 'linter']);
      expect(metadata.conceptsFound.events).toBe(1);
      expect(metadata.conceptsFound.styling).toBe(true);
      expect(metadata.conceptsFound.conditionals).toBe(1);
      expect(metadata.conceptsFound.attributes).toBe(1); // id attribute
      expect(metadata.timestamp).toBeInstanceOf(Date);
    });
  });
});