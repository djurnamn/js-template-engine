/**
 * Integration tests for Processing Pipeline and TemplateEngine
 */

import { TemplateEngine } from '../../src/engine/TemplateEngine';
import type { 
  TemplateNode, 
  RenderOptions, 
  TemplateEngineOptions 
} from '../../src/engine/TemplateEngine';
import type { ComponentDefinition } from '../../src/processors/ComponentPropertyProcessor';

describe('Processing Pipeline Integration', () => {
  let engine: TemplateEngine;

  beforeEach(() => {
    const options: TemplateEngineOptions = {
      enabled: true,
      defaultFramework: 'react',
      mergeStrategies: {
        script: { mode: 'append', includeComments: true },
        props: { mode: 'merge', conflictResolution: 'warn' },
        imports: { mode: 'merge', deduplication: true, grouping: true }
      },
      validation: {
        enableFrameworkConsistency: true,
        checkAccessibility: true,
        checkPerformance: true
      },
      normalization: {
        normalizeEventNames: true
      }
    };

    engine = new TemplateEngine(options);
  });

  describe('Complete Date Component Scenario', () => {
    it('should handle the key date/dayjs + React scenario', async () => {
      const template: TemplateNode[] = [
        {
          type: 'element',
          tag: 'div',
          attributes: { class: 'date-picker' },
          children: [
            {
              type: 'element',
              tag: 'input',
              attributes: { type: 'date' },
              expressionAttributes: {
                value: 'selectedDate',
                onChange: 'handleDateChange'
              }
            },
            {
              type: 'element', 
              tag: 'button',
              expressionAttributes: {
                onClick: 'addTwoDays'
              },
              children: [
                { type: 'text', content: 'Add 2 Days' }
              ]
            },
            {
              type: 'element',
              tag: 'p',
              children: [
                { type: 'text', content: 'Selected: ' },
                { type: 'text', content: '{{formattedDate}}' }
              ]
            }
          ]
        }
      ];

      const componentDefinition: ComponentDefinition = {
        common: {
          name: 'DatePicker',
          props: {
            date: 'Date',
            title: 'string'
          },
          imports: [
            { from: 'dayjs', default: 'dayjs' }
          ],
          script: `
            const twoDaysFromDate = (date) => {
              return dayjs(date).add(2, 'day').toDate();
            };
            
            const formatDate = (date) => {
              return dayjs(date).format('YYYY-MM-DD');
            };
          `
        },
        framework: {
          props: {
            onDateChange: '(date: Date) => void'
          },
          imports: [
            { from: 'react', named: ['useState', 'useEffect'] }
          ],
          script: `
            const [selectedDate, setSelectedDate] = useState(new Date());
            const [formattedDate, setFormattedDate] = useState('');
            
            const handleDateChange = (e) => {
              const newDate = new Date(e.target.value);
              setSelectedDate(newDate);
            };
            
            const addTwoDays = () => {
              const newDate = twoDaysFromDate(selectedDate);
              setSelectedDate(newDate);
            };
            
            useEffect(() => {
              setFormattedDate(formatDate(selectedDate));
            }, [selectedDate]);
          `
        }
      };

      const options: RenderOptions = {
        framework: 'react',
        component: componentDefinition
      };

      const result = await engine.render(template, options);

      // Verify successful processing
      expect(result.errors.hasErrors()).toBe(false);
      
      // Check that component properties were merged
      expect(result.metadata?.componentProperties).toBeDefined();
      const mergedProps = result.metadata.componentProperties;
      
      // Should have both common and framework props
      expect(mergedProps.props.date).toBe('Date');
      expect(mergedProps.props.title).toBe('string');
      expect(mergedProps.props.onDateChange).toBe('(date: Date) => void');
      
      // Should have merged imports (dayjs + react)
      expect(mergedProps.imports).toHaveLength(2);
      const sources = mergedProps.imports.map(imp => imp.from);
      expect(sources).toContain('dayjs');
      expect(sources).toContain('react');
      
      // Should have merged scripts
      expect(mergedProps.script).toContain('twoDaysFromDate');
      expect(mergedProps.script).toContain('useState');
      expect(mergedProps.script).toContain('// Merged: append');
      
      // Check event normalization
      const clickEvent = result.concepts.events.find(e => e.name === 'click');
      expect(clickEvent?.frameworkAttribute).toBe('onClick');
      
      // Check validation results
      expect(result.validation?.score).toBeGreaterThan(0.8);
    });
  });

  describe('Cross-Framework Event Normalization', () => {
    it('should normalize Vue events to React', async () => {
      const template: TemplateNode[] = [
        {
          type: 'element',
          tag: 'form',
          expressionAttributes: {
            '@submit.prevent': 'handleSubmit'
          },
          children: [
            {
              type: 'element',
              tag: 'input',
              expressionAttributes: {
                '@input': 'handleInput',
                '@blur': 'handleBlur'
              }
            }
          ]
        }
      ];

      const result = await engine.render(template, {
        framework: 'react'
      });

      const events = result.concepts.events;
      
      const submitEvent = events.find(e => e.name === 'submit');
      const inputEvent = events.find(e => e.name === 'input');
      const blurEvent = events.find(e => e.name === 'blur');

      expect(submitEvent?.frameworkAttribute).toBe('onSubmit');
      expect(inputEvent?.frameworkAttribute).toBe('onInput');  
      expect(blurEvent?.frameworkAttribute).toBe('onBlur');

      // Check modifiers were preserved
      expect(submitEvent?.modifiers).toContain('prevent');
    });

    it('should normalize React events to Vue', async () => {
      const template: TemplateNode[] = [
        {
          type: 'element',
          tag: 'button',
          expressionAttributes: {
            onClick: 'handleClick',
            onKeyDown: 'handleKeyDown'
          }
        }
      ];

      const result = await engine.render(template, {
        framework: 'vue'
      });

      const events = result.concepts.events;
      
      expect(events[0].frameworkAttribute).toBe('@click');
      expect(events[1].frameworkAttribute).toBe('@keydown');
    });
  });

  describe('Advanced Validation Features', () => {
    it('should provide comprehensive validation with suggestions', async () => {
      const template: TemplateNode[] = [
        {
          type: 'element',
          tag: 'div', // Non-interactive element
          expressionAttributes: {
            onClick: 'handleClick' // Should suggest button
          },
          attributes: {
            style: 'color: #fff; background-color: #eee;' // Poor contrast
          }
        },
        {
          type: 'for',
          items: 'items',
          item: 'item',
          // Missing key - performance issue
          children: [
            {
              type: 'element',
              tag: 'div',
              children: [
                { type: 'text', content: '{{item.name}}' }
              ]
            }
          ]
        }
      ];

      const result = await engine.render(template, {
        framework: 'react'
      });

      expect(result.validation?.warnings.length).toBeGreaterThan(0);
      expect(result.validation?.suggestions.length).toBeGreaterThan(0);
      
      // Should have accessibility warnings
      const accessibilityWarning = result.validation.warnings.find(
        w => w.message.includes('interactive element')
      );
      expect(accessibilityWarning).toBeDefined();
      
      // Should have performance suggestions
      const performanceSuggestion = result.validation.suggestions.find(
        s => s.message.includes('key')
      );
      expect(performanceSuggestion).toBeDefined();
    });

    it('should check framework consistency', async () => {
      const template: TemplateNode[] = [
        {
          type: 'element',
          tag: 'button',
          expressionAttributes: {
            '@click': 'handleClick', // Vue syntax
            className: 'btn'        // React syntax - inconsistent
          }
        }
      ];

      const result = await engine.render(template, {
        framework: 'react'
      });

      expect(result.consistencyReport).toBeDefined();
      expect(result.consistencyReport.overallScore).toBeLessThan(1.0);
    });
  });

  describe('Merge Strategy Configurations', () => {
    it('should respect prepend script merge strategy', async () => {
      engine.updateMergeStrategies({
        script: { mode: 'prepend', includeComments: true }
      });

      const componentDef: ComponentDefinition = {
        common: {
          script: 'const commonLogic = () => {};'
        },
        framework: {
          script: 'const frameworkLogic = () => {};'
        }
      };

      const result = await engine.render([], {
        framework: 'react',
        component: componentDef
      });

      const script = result.metadata?.componentProperties?.script;
      expect(script).toMatch(/frameworkLogic.*commonLogic/s);
    });

    it('should handle props conflict resolution strategies', async () => {
      engine.updateMergeStrategies({
        props: { mode: 'merge', conflictResolution: 'common-wins' }
      });

      const componentDef: ComponentDefinition = {
        common: {
          props: { type: 'string' }
        },
        framework: {
          props: { type: 'React.ComponentType' } // Conflict
        }
      };

      const result = await engine.render([], {
        framework: 'react',
        component: componentDef
      });

      const props = result.metadata?.componentProperties?.props;
      expect(props.type).toBe('string'); // Common should win
      expect(result.errors.hasWarnings()).toBe(true);
    });
  });

  describe('Performance and Metadata', () => {
    it('should track advanced processing metadata', async () => {
      const template: TemplateNode[] = [
        {
          type: 'element',
          tag: 'div',
          expressionAttributes: { onClick: 'handleClick' }
        }
      ];

      const result = await engine.render(template);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.processing).toBe(true);
      expect(result.metadata.processorsUsed).toContain('EventExtractor');
      expect(result.metadata.eventsNormalized).toBe(1);
      expect(result.metadata.validationScore).toBeGreaterThan(0);
    });

    it('should maintain performance with complex templates', async () => {
      // Create a complex template with many elements and events
      const complexTemplate: TemplateNode[] = Array.from({ length: 50 }, (_, i) => ({
        type: 'element',
        tag: 'button',
        expressionAttributes: {
          onClick: `handleClick${i}`,
          onFocus: `handleFocus${i}`
        },
        children: [
          { type: 'text', content: `Button ${i}` }
        ]
      }));

      const startTime = Date.now();
      const result = await engine.render(complexTemplate);
      const processingTime = Date.now() - startTime;

      expect(result.errors.hasErrors()).toBe(false);
      expect(result.concepts.events).toHaveLength(100); // 50 buttons × 2 events
      expect(processingTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Advanced Engine Configuration', () => {
    it('should allow runtime configuration updates', () => {
      const config = engine.getConfig();
      expect(config.enabled).toBe(true);
      
      engine.setEnabled(false);
      expect(engine.getConfig().enabled).toBe(false);
      
      engine.updateValidationOptions({
        checkAccessibility: false
      });
      expect(engine.getConfig().validation.checkAccessibility).toBe(false);
    });

    it('should provide access to advanced processors', () => {
      const processors = engine.getProcessors();
      
      expect(processors.componentPropertyProcessor).toBeDefined();
      expect(processors.importProcessor).toBeDefined(); 
      expect(processors.scriptMergeProcessor).toBeDefined();
      expect(processors.eventExtractor).toBeDefined();
      expect(processors.conceptValidator).toBeDefined();
    });

    it('should support engine cloning with advanced features', () => {
      const cloned = engine.clone({
        validation: {
          enableFrameworkConsistency: false
        }
      });

      const originalConfig = engine.getConfig();
      const clonedConfig = cloned.getConfig();

      expect(originalConfig.validation.enableFrameworkConsistency).toBe(true);
      expect(clonedConfig.validation.enableFrameworkConsistency).toBe(false);
    });
  });

  describe('Auto Enhancement Detection', () => {
    it('should automatically detect when advanced features are needed', async () => {
      const template: TemplateNode[] = [
        {
          type: 'element',
          tag: 'button',
          expressionAttributes: { '@click': 'handleClick' } // Vue syntax - needs normalization
        }
      ];

      const result = await engine.renderWithAutoEnhancement(template, {
        framework: 'react'
      });

      expect(result.metadata.processing).toBe(true);
      expect(result.metadata.processorsUsed).toContain('EventNormalizer');
    });
  });
});