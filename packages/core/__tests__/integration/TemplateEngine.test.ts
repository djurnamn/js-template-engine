/**
 * Tests for TemplateEngine integration layer.
 */

import { TemplateEngine } from '../../src/engine/TemplateEngine';
import type { FrameworkExtension, StylingExtension, UtilityExtension } from '../../src/extensions';
import { vi } from 'vitest';

describe('TemplateEngine Integration', () => {
  let engine: TemplateEngine;

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
    renderComponent: vi.fn().mockReturnValue('<div className="rendered">Rendered Component</div>')
  });

  const createMockStylingExtension = (key: string): StylingExtension => ({
    metadata: {
      type: 'styling',
      key,
      name: `${key} Extension`,
      version: '1.0.0'
    },
    styling: 'bem' as const,
    processStyles: vi.fn().mockReturnValue({ styles: `.${key} { color: red; }` })
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
      metadata: { ...concepts.metadata, processedBy: key }
    }))
  });

  beforeEach(() => {
    engine = new TemplateEngine();
  });

  describe('Extension Registration', () => {
    it('should register framework extensions', () => {
      const reactExt = createMockFrameworkExtension('react');
      
      engine.registerFramework(reactExt);
      
      expect(engine.hasExtension('react', 'framework')).toBe(true);
      expect(engine.getFrameworkExtension('react')).toBe(reactExt);
    });

    it('should register styling extensions', () => {
      const bemExt = createMockStylingExtension('bem');
      
      engine.registerStyling(bemExt);
      
      expect(engine.hasExtension('bem', 'styling')).toBe(true);
      expect(engine.getStylingExtension('bem')).toBe(bemExt);
    });

    it('should register utility extensions', () => {
      const linterExt = createMockUtilityExtension('linter');
      
      engine.registerUtility(linterExt);
      
      expect(engine.hasExtension('linter', 'utility')).toBe(true);
      expect(engine.getUtilityExtension('linter')).toBe(linterExt);
    });

    it('should throw error for invalid extensions', () => {
      const invalidExtension = {
        metadata: {
          type: 'framework' as const,
          key: '',
          name: '',
          version: '1.0'
        },
        framework: 'react' as const
      } as any;

      expect(() => {
        engine.registerFramework(invalidExtension);
      }).toThrow('Failed to register framework extension');
    });
  });

  describe('Template Rendering', () => {
    it('should render a simple template', async () => {
      const reactExt = createMockFrameworkExtension('react');
      engine.registerFramework(reactExt);

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

      const result = await engine.render(template, {
        framework: 'react',
        component: { name: 'TestComponent' }
      });

      expect(result.output).toBe('<div className="rendered">Rendered Component</div>');
      expect(result.errors.hasErrors()).toBe(false);
      expect(result.metadata.extensionsUsed).toEqual(['react']);
    });

    it('should use default framework when configured', async () => {
      const engine = new TemplateEngine({ defaultFramework: 'react' });
      const reactExt = createMockFrameworkExtension('react');
      engine.registerFramework(reactExt);

      const template = [
        {
          type: 'element' as const,
          tag: 'div',
          attributes: { class: 'container' }
        }
      ];

      const result = await engine.render(template);

      expect(result.output).toBe('<div className="rendered">Rendered Component</div>');
      expect(result.metadata.extensionsUsed).toEqual(['react']);
    });

    it('should override defaults with render options', async () => {
      const engine = new TemplateEngine({ 
        defaultFramework: 'react',
        defaultStyling: 'bem'
      });
      
      const reactExt = createMockFrameworkExtension('react');
      const vueExt = createMockFrameworkExtension('vue');
      const bemExt = createMockStylingExtension('bem');
      const tailwindExt = createMockStylingExtension('tailwind');

      engine.registerFramework(reactExt);
      engine.registerFramework(vueExt);
      engine.registerStyling(bemExt);
      engine.registerStyling(tailwindExt);

      const template = [
        {
          type: 'element' as const,
          tag: 'div',
          attributes: { class: 'container' }
        }
      ];

      const result = await engine.render(template, {
        framework: 'vue',
        styling: 'tailwind'
      });

      expect(result.metadata.extensionsUsed).toEqual(['vue', 'tailwind']);
    });

    it('should render with multiple utility extensions', async () => {
      const engine = new TemplateEngine({
        defaultFramework: 'react',
        defaultUtilities: ['linter', 'optimizer']
      });

      const reactExt = createMockFrameworkExtension('react');
      const linterExt = createMockUtilityExtension('linter');
      const optimizerExt = createMockUtilityExtension('optimizer');

      engine.registerFramework(reactExt);
      engine.registerUtility(linterExt);
      engine.registerUtility(optimizerExt);

      const template = [
        {
          type: 'element' as const,
          tag: 'div',
          children: [
            { type: 'text' as const, content: 'Hello' }
          ]
        }
      ];

      const result = await engine.render(template);

      expect(result.metadata.extensionsUsed).toEqual(['react', 'linter', 'optimizer']);
      expect(linterExt.process).toHaveBeenCalled();
      expect(optimizerExt.process).toHaveBeenCalled();
    });
  });

  describe('Engine Status and Management', () => {
    it('should provide engine status', () => {
      const reactExt = createMockFrameworkExtension('react');
      const bemExt = createMockStylingExtension('bem');
      const linterExt = createMockUtilityExtension('linter');

      engine.registerFramework(reactExt);
      engine.registerStyling(bemExt);
      engine.registerUtility(linterExt);

      const status = engine.getStatus();

      expect(status.frameworks).toEqual(['react']);
      expect(status.styling).toEqual(['bem']);
      expect(status.utilities).toEqual(['linter']);
      expect(status.config).toBeDefined();
    });

    it('should manage extension counts', () => {
      const reactExt = createMockFrameworkExtension('react');
      const vueExt = createMockFrameworkExtension('vue');
      const bemExt = createMockStylingExtension('bem');

      engine.registerFramework(reactExt);
      engine.registerFramework(vueExt);
      engine.registerStyling(bemExt);

      expect(engine.getExtensionCount()).toBe(3);
      expect(engine.getExtensionCount('framework')).toBe(2);
      expect(engine.getExtensionCount('styling')).toBe(1);
      expect(engine.getExtensionCount('utility')).toBe(0);
    });

    it('should remove extensions', () => {
      const reactExt = createMockFrameworkExtension('react');
      engine.registerFramework(reactExt);

      expect(engine.hasExtension('react')).toBe(true);
      
      const removed = engine.removeExtension('react', 'framework');
      expect(removed).toBe(true);
      expect(engine.hasExtension('react')).toBe(false);
    });

    it('should clear all extensions', () => {
      const reactExt = createMockFrameworkExtension('react');
      const bemExt = createMockStylingExtension('bem');

      engine.registerFramework(reactExt);
      engine.registerStyling(bemExt);

      expect(engine.getExtensionCount()).toBe(2);

      engine.clearExtensions();
      expect(engine.getExtensionCount()).toBe(0);
    });
  });

  describe('Default Settings', () => {
    it('should set and use default framework', async () => {
      const reactExt = createMockFrameworkExtension('react');
      const vueExt = createMockFrameworkExtension('vue');

      engine.registerFramework(reactExt);
      engine.registerFramework(vueExt);

      engine.setDefaultFramework('vue');

      const template = [
        { type: 'element' as const, tag: 'div' }
      ];

      const result = await engine.render(template);
      expect(result.metadata.extensionsUsed).toEqual(['vue']);
    });

    it('should set and use default styling', async () => {
      const reactExt = createMockFrameworkExtension('react');
      const bemExt = createMockStylingExtension('bem');
      const tailwindExt = createMockStylingExtension('tailwind');

      engine.registerFramework(reactExt);
      engine.registerStyling(bemExt);
      engine.registerStyling(tailwindExt);

      engine.setDefaultFramework('react');
      engine.setDefaultStyling('tailwind');

      const template = [
        {
          type: 'element' as const,
          tag: 'div',
          attributes: { class: 'container' }
        }
      ];

      const result = await engine.render(template);
      expect(result.metadata.extensionsUsed).toEqual(['react', 'tailwind']);
    });

    it('should set and use default utilities', async () => {
      const reactExt = createMockFrameworkExtension('react');
      const linterExt = createMockUtilityExtension('linter');
      const optimizerExt = createMockUtilityExtension('optimizer');

      engine.registerFramework(reactExt);
      engine.registerUtility(linterExt);
      engine.registerUtility(optimizerExt);

      engine.setDefaultFramework('react');
      engine.setDefaultUtilities(['linter', 'optimizer']);

      const template = [
        { type: 'element' as const, tag: 'div' }
      ];

      const result = await engine.render(template);
      expect(result.metadata.extensionsUsed).toEqual(['react', 'linter', 'optimizer']);
    });

    it('should throw error when setting unregistered defaults', () => {
      expect(() => {
        engine.setDefaultFramework('nonexistent');
      }).toThrow("Framework extension 'nonexistent' is not registered");

      expect(() => {
        engine.setDefaultStyling('nonexistent');
      }).toThrow("Styling extension 'nonexistent' is not registered");

      expect(() => {
        engine.setDefaultUtilities(['nonexistent']);
      }).toThrow("Utility extension 'nonexistent' is not registered");
    });
  });

  describe('Template Analysis', () => {
    it('should analyze template without rendering', async () => {
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

      const result = await engine.analyze(template);

      expect(result.concepts).toBeDefined();
      expect(result.concepts.events).toHaveLength(1);
      expect(result.concepts.conditionals).toHaveLength(1);
      expect(result.concepts.attributes).toHaveLength(1); // id attribute
      expect(result.errors).toBeDefined();
      expect(result.performance).toBeDefined();
    });

    it('should handle analysis errors gracefully', async () => {
      // Mock analyzer to throw error
      const originalAnalyzer = (engine as any).analyzer;
      (engine as any).analyzer = {
        ...originalAnalyzer,
        extractConcepts: vi.fn().mockImplementation(() => {
          throw new Error('Analysis failed');
        }),
        clearErrors: vi.fn(),
        getErrors: vi.fn().mockReturnValue({ getErrors: () => [] })
      };

      const template = [
        { type: 'element' as const, tag: 'div' }
      ];

      const result = await engine.analyze(template);

      expect(result.concepts).toBeNull();
      expect(result.errors.hasErrors()).toBe(true);
    });
  });

  describe('Extension Validation', () => {
    it('should validate extensions without registering', () => {
      const validExtension = createMockFrameworkExtension('test');
      const result = engine.validateExtension(validExtension);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should detect invalid extensions', () => {
      const invalidExtension = {
        metadata: {
          type: 'framework' as const,
          key: '',
          name: '',
          version: '1.0'
        }
      } as any;

      const result = engine.validateExtension(invalidExtension);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Engine Cloning', () => {
    it('should clone engine with same configuration', () => {
      const reactExt = createMockFrameworkExtension('react');
      const bemExt = createMockStylingExtension('bem');

      engine.registerFramework(reactExt);
      engine.registerStyling(bemExt);
      engine.setDefaultFramework('react');

      const clonedEngine = engine.clone();

      expect(clonedEngine.hasExtension('react', 'framework')).toBe(true);
      expect(clonedEngine.hasExtension('bem', 'styling')).toBe(true);
      expect(clonedEngine.getStatus().config.defaultFramework).toBe('react');
    });

    it('should clone engine with override options', () => {
      const engine = new TemplateEngine({
        defaultFramework: 'react',
        verboseErrors: false
      });

      const reactExt = createMockFrameworkExtension('react');
      engine.registerFramework(reactExt);

      const clonedEngine = engine.clone({
        verboseErrors: true,
        defaultStyling: 'bem'
      });

      expect(clonedEngine.getStatus().config.defaultFramework).toBe('react');
      expect(clonedEngine.getStatus().config.verboseErrors).toBe(true);
      expect(clonedEngine.getStatus().config.defaultStyling).toBe('bem');
      expect(clonedEngine.hasExtension('react', 'framework')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should provide access to error collector', () => {
      const errorCollector = engine.getErrorCollector();
      expect(errorCollector).toBeDefined();
      expect(typeof errorCollector.addError).toBe('function');
    });

    it('should provide access to performance tracker', () => {
      const performanceTracker = engine.getPerformanceTracker();
      expect(performanceTracker).toBeDefined();
    });

    it('should handle rendering errors gracefully', async () => {
      const faultyExt: FrameworkExtension = {
        ...createMockFrameworkExtension('faulty'),
        renderComponent: vi.fn().mockImplementation(() => {
          throw new Error('Render failed');
        })
      };

      engine.registerFramework(faultyExt);

      const template = [
        { type: 'element' as const, tag: 'div' }
      ];

      const result = await engine.render(template, { framework: 'faulty' });
      
      expect(result.output).toBe('');
      expect(result.errors.hasErrors()).toBe(true);
      const errors = result.errors.getErrorsBySeverity('error');
      expect(errors.some(e => e.message.includes('Render failed'))).toBe(true);
    });
  });

  describe('Configuration Options', () => {
    it('should initialize with custom analyzer options', () => {
      const customEngine = new TemplateEngine({
        analyzerOptions: {
          extractEvents: false,
          extractStyling: false,
          eventPrefixes: ['custom:']
        }
      });

      expect(customEngine.getStatus().config.analyzerOptions?.extractEvents).toBe(false);
      expect(customEngine.getStatus().config.analyzerOptions?.eventPrefixes).toEqual(['custom:']);
    });

    it('should handle verbose error reporting', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const engine = new TemplateEngine({ verboseErrors: true });
      const reactExt = createMockFrameworkExtension('react');
      engine.registerFramework(reactExt);

      const template = [
        {
          type: 'if' as const,
          // Missing condition - should generate warnings
          then: [{ type: 'text' as const, content: 'content' }]
        }
      ];

      await engine.render(template, { framework: 'react' });

      // Should have logged warnings due to verbose mode
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should handle performance tracking configuration', () => {
      const engineWithTracking = new TemplateEngine({ enablePerformanceTracking: true });
      const engineWithoutTracking = new TemplateEngine({ enablePerformanceTracking: false });

      expect(engineWithTracking.getStatus().config.enablePerformanceTracking).toBe(true);
      expect(engineWithoutTracking.getStatus().config.enablePerformanceTracking).toBe(false);
    });
  });
});