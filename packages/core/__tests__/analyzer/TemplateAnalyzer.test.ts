/**
 * Tests for TemplateAnalyzer.
 */

import { TemplateAnalyzer } from '../../src/analyzer/TemplateAnalyzer';
import { ErrorCollector } from '../../src/metadata';

describe('TemplateAnalyzer', () => {
  let analyzer: TemplateAnalyzer;
  let errorCollector: ErrorCollector;

  beforeEach(() => {
    errorCollector = new ErrorCollector();
    analyzer = new TemplateAnalyzer({}, errorCollector);
  });

  describe('Basic Concept Extraction', () => {
    it('should extract concepts from simple template', () => {
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
              type: 'text' as const,
              content: 'Hello World'
            }
          ]
        }
      ];

      const concepts = analyzer.extractConcepts(template);

      expect(concepts.styling.staticClasses).toContain('container');
      expect(concepts.attributes).toHaveLength(1);
      expect(concepts.attributes[0].name).toBe('id');
      expect(concepts.attributes[0].value).toBe('main');
    });

    it('should handle empty template', () => {
      const concepts = analyzer.extractConcepts([]);

      expect(concepts.events).toEqual([]);
      expect(concepts.styling.staticClasses).toEqual([]);
      expect(concepts.conditionals).toEqual([]);
      expect(concepts.iterations).toEqual([]);
      expect(concepts.slots).toEqual([]);
      expect(concepts.attributes).toEqual([]);
    });
  });

  describe('Event Extraction', () => {
    it('should extract React-style events', () => {
      const template = [
        {
          type: 'element' as const,
          tag: 'button',
          expressionAttributes: {
            onClick: 'handleClick',
            onSubmit: 'handleSubmit($event, index)'
          }
        }
      ];

      const concepts = analyzer.extractConcepts(template);

      expect(concepts.events).toHaveLength(2);
      
      const clickEvent = concepts.events.find(e => e.name === 'Click');
      expect(clickEvent).toBeDefined();
      expect(clickEvent!.handler).toBe('handleClick');
      expect(clickEvent!.parameters).toEqual([]);

      const submitEvent = concepts.events.find(e => e.name === 'Submit');
      expect(submitEvent).toBeDefined();
      expect(submitEvent!.handler).toBe('handleSubmit($event, index)');
      expect(submitEvent!.parameters).toEqual(['$event', 'index']);
    });

    it('should extract Vue-style events', () => {
      const template = [
        {
          type: 'element' as const,
          tag: 'button',
          expressionAttributes: {
            '@click': 'handleClick',
            '@submit.prevent': 'handleSubmit'
          }
        }
      ];

      const concepts = analyzer.extractConcepts(template);

      expect(concepts.events).toHaveLength(2);
      
      const clickEvent = concepts.events.find(e => e.name === 'click');
      expect(clickEvent).toBeDefined();
      expect(clickEvent!.handler).toBe('handleClick');
      expect(clickEvent!.modifiers).toEqual([]);

      const submitEvent = concepts.events.find(e => e.name === 'submit');
      expect(submitEvent).toBeDefined();
      expect(submitEvent!.handler).toBe('handleSubmit');
      expect(submitEvent!.modifiers).toEqual(['prevent']);
    });

    it('should extract Svelte-style events', () => {
      const template = [
        {
          type: 'element' as const,
          tag: 'button',
          expressionAttributes: {
            'on:click': 'handleClick',
            'on:submit|preventDefault': 'handleSubmit'
          }
        }
      ];

      const concepts = analyzer.extractConcepts(template);

      expect(concepts.events).toHaveLength(2);
      
      const clickEvent = concepts.events.find(e => e.name === 'click');
      expect(clickEvent).toBeDefined();
      expect(clickEvent!.handler).toBe('handleClick');

      const submitEvent = concepts.events.find(e => e.name === 'submit');
      expect(submitEvent).toBeDefined();
      expect(submitEvent!.handler).toBe('handleSubmit');
      expect(submitEvent!.modifiers).toEqual(['preventDefault']);
    });
  });

  describe('Styling Extraction', () => {
    it('should extract static classes', () => {
      const template = [
        {
          type: 'element' as const,
          tag: 'div',
          attributes: {
            class: 'button button--primary active'
          }
        }
      ];

      const concepts = analyzer.extractConcepts(template);

      expect(concepts.styling.staticClasses).toEqual(['button', 'button--primary', 'active']);
    });

    it('should extract dynamic classes', () => {
      const template = [
        {
          type: 'element' as const,
          tag: 'div',
          attributes: {
            class: 'button'
          },
          expressionAttributes: {
            className: 'isActive ? "active" : ""',
            ':class': '{ primary: isPrimary }'
          }
        }
      ];

      const concepts = analyzer.extractConcepts(template);

      expect(concepts.styling.staticClasses).toEqual(['button']);
      expect(concepts.styling.dynamicClasses).toEqual([
        'isActive ? "active" : ""',
        '{ primary: isPrimary }'
      ]);
    });

    it('should extract inline styles', () => {
      const template = [
        {
          type: 'element' as const,
          tag: 'div',
          attributes: {
            style: 'color: red; font-size: 14px'
          }
        }
      ];

      const concepts = analyzer.extractConcepts(template);

      expect(concepts.styling.inlineStyles).toEqual({
        color: 'red',
        'font-size': '14px'
      });
    });

    it('should extract dynamic style bindings', () => {
      const template = [
        {
          type: 'element' as const,
          tag: 'div',
          expressionAttributes: {
            style: '{ color: textColor }',
            ':style': 'styleObject'
          }
        }
      ];

      const concepts = analyzer.extractConcepts(template);

      expect(concepts.styling.styleBindings).toEqual({
        style: 'styleObject' // Vue style takes precedence
      });
    });
  });

  describe('Conditional Extraction', () => {
    it('should extract if conditions', () => {
      const template = [
        {
          type: 'if' as const,
          condition: 'isVisible',
          then: [
            {
              type: 'element' as const,
              tag: 'div',
              children: [
                { type: 'text' as const, content: 'Visible content' }
              ]
            }
          ]
        }
      ];

      const concepts = analyzer.extractConcepts(template);

      expect(concepts.conditionals).toHaveLength(1);
      expect(concepts.conditionals[0].condition).toBe('isVisible');
      expect(concepts.conditionals[0].thenNodes).toHaveLength(1);
      expect(concepts.conditionals[0].elseNodes).toBeUndefined();
    });

    it('should extract if-else conditions', () => {
      const template = [
        {
          type: 'if' as const,
          condition: 'user.isLoggedIn',
          then: [
            { type: 'text' as const, content: 'Welcome back!' }
          ],
          else: [
            { type: 'text' as const, content: 'Please log in' }
          ]
        }
      ];

      const concepts = analyzer.extractConcepts(template);

      expect(concepts.conditionals).toHaveLength(1);
      expect(concepts.conditionals[0].condition).toBe('user.isLoggedIn');
      expect(concepts.conditionals[0].thenNodes).toHaveLength(1);
      expect(concepts.conditionals[0].elseNodes).toHaveLength(1);
    });

    it('should handle missing condition', () => {
      const template = [
        {
          type: 'if' as const,
          then: [
            { type: 'text' as const, content: 'Content' }
          ]
        }
      ];

      const concepts = analyzer.extractConcepts(template);

      expect(concepts.conditionals).toEqual([]);
      expect(errorCollector.hasWarnings()).toBe(true);
    });
  });

  describe('Iteration Extraction', () => {
    it('should extract for loops', () => {
      const template = [
        {
          type: 'for' as const,
          items: 'todos',
          item: 'todo',
          index: 'index',
          key: 'todo.id',
          children: [
            {
              type: 'element' as const,
              tag: 'li',
              children: [
                { type: 'text' as const, content: '{{ todo.title }}' }
              ]
            }
          ]
        }
      ];

      const concepts = analyzer.extractConcepts(template);

      expect(concepts.iterations).toHaveLength(1);
      expect(concepts.iterations[0].items).toBe('todos');
      expect(concepts.iterations[0].itemVariable).toBe('todo');
      expect(concepts.iterations[0].indexVariable).toBe('index');
      expect(concepts.iterations[0].keyExpression).toBe('todo.id');
      expect(concepts.iterations[0].childNodes).toHaveLength(1);
    });

    it('should extract minimal for loop', () => {
      const template = [
        {
          type: 'for' as const,
          items: 'items',
          item: 'item',
          children: []
        }
      ];

      const concepts = analyzer.extractConcepts(template);

      expect(concepts.iterations).toHaveLength(1);
      expect(concepts.iterations[0].indexVariable).toBeUndefined();
      expect(concepts.iterations[0].keyExpression).toBeUndefined();
    });

    it('should handle missing loop properties', () => {
      const template = [
        {
          type: 'for' as const,
          item: 'item',
          children: []
        }
      ];

      const concepts = analyzer.extractConcepts(template);

      expect(concepts.iterations).toEqual([]);
      expect(errorCollector.hasWarnings()).toBe(true);
    });
  });

  describe('Slot Extraction', () => {
    it('should extract slots', () => {
      const template = [
        {
          type: 'slot' as const,
          name: 'header',
          fallback: [
            { type: 'text' as const, content: 'Default header' }
          ]
        }
      ];

      const concepts = analyzer.extractConcepts(template);

      expect(concepts.slots).toHaveLength(1);
      expect(concepts.slots[0].name).toBe('header');
      expect(concepts.slots[0].fallback).toHaveLength(1);
    });

    it('should extract slot without fallback', () => {
      const template = [
        {
          type: 'slot' as const,
          name: 'default'
        }
      ];

      const concepts = analyzer.extractConcepts(template);

      expect(concepts.slots).toHaveLength(1);
      expect(concepts.slots[0].name).toBe('default');
      expect(concepts.slots[0].fallback).toBeUndefined();
    });

    it('should handle slot without name', () => {
      const template = [
        {
          type: 'slot' as const
        }
      ];

      const concepts = analyzer.extractConcepts(template);

      expect(concepts.slots).toEqual([]);
      expect(errorCollector.hasWarnings()).toBe(true);
    });
  });

  describe('Attribute Extraction', () => {
    it('should extract regular attributes', () => {
      const template = [
        {
          type: 'element' as const,
          tag: 'input',
          attributes: {
            type: 'text',
            placeholder: 'Enter text',
            disabled: true
          }
        }
      ];

      const concepts = analyzer.extractConcepts(template);

      expect(concepts.attributes).toHaveLength(3);
      
      const typeAttr = concepts.attributes.find(a => a.name === 'type');
      expect(typeAttr).toBeDefined();
      expect(typeAttr!.value).toBe('text');
      expect(typeAttr!.isExpression).toBe(false);

      const disabledAttr = concepts.attributes.find(a => a.name === 'disabled');
      expect(disabledAttr).toBeDefined();
      expect(disabledAttr!.value).toBe(true);
    });

    it('should extract expression attributes', () => {
      const template = [
        {
          type: 'element' as const,
          tag: 'input',
          expressionAttributes: {
            value: 'inputValue',
            disabled: 'isDisabled'
          }
        }
      ];

      const concepts = analyzer.extractConcepts(template);

      expect(concepts.attributes).toHaveLength(2);
      
      const valueAttr = concepts.attributes.find(a => a.name === 'value');
      expect(valueAttr).toBeDefined();
      expect(valueAttr!.value).toBe('inputValue');
      expect(valueAttr!.isExpression).toBe(true);
    });

    it('should ignore styling and event attributes', () => {
      const template = [
        {
          type: 'element' as const,
          tag: 'div',
          attributes: {
            id: 'content',
            class: 'container',
            style: 'color: red'
          },
          expressionAttributes: {
            onClick: 'handleClick',
            className: 'dynamicClass'
          }
        }
      ];

      const concepts = analyzer.extractConcepts(template);

      // Only id should be extracted as attribute
      expect(concepts.attributes).toHaveLength(1);
      expect(concepts.attributes[0].name).toBe('id');
      expect(concepts.attributes[0].value).toBe('content');
    });

    it('should respect ignored attributes option', () => {
      const customAnalyzer = new TemplateAnalyzer({
        ignoreAttributes: ['data-test', 'id']
      });

      const template = [
        {
          type: 'element' as const,
          tag: 'div',
          attributes: {
            id: 'test',
            'data-test': 'value',
            'aria-label': 'Label'
          }
        }
      ];

      const concepts = customAnalyzer.extractConcepts(template);

      // Only aria-label should be extracted
      expect(concepts.attributes).toHaveLength(1);
      expect(concepts.attributes[0].name).toBe('aria-label');
    });
  });

  describe('Complex Template', () => {
    it('should extract all concepts from complex template', () => {
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
                  attributes: {
                    class: 'title'
                  },
                  expressionAttributes: {
                    onClick: 'handleTitleClick'
                  },
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
              index: 'index',
              key: 'item.id',
              children: [
                {
                  type: 'element' as const,
                  tag: 'div',
                  attributes: {
                    class: 'item'
                  },
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

      const concepts = analyzer.extractConcepts(template);

      // Check all concept types are extracted
      expect(concepts.styling.staticClasses).toEqual(['container', 'title', 'item']);
      expect(concepts.events).toHaveLength(1);
      expect(concepts.events[0].name).toBe('Click');
      expect(concepts.conditionals).toHaveLength(1);
      expect(concepts.conditionals[0].condition).toBe('showHeader');
      expect(concepts.iterations).toHaveLength(1);
      expect(concepts.iterations[0].items).toBe('items');
      expect(concepts.slots).toHaveLength(1);
      expect(concepts.slots[0].name).toBe('item-content');
      expect(concepts.attributes).toHaveLength(1);
      expect(concepts.attributes[0].name).toBe('id');
    });
  });

  describe('Options and Configuration', () => {
    it('should respect extraction options', () => {
      const selectiveAnalyzer = new TemplateAnalyzer({
        extractEvents: false,
        extractStyling: false
      });

      const template = [
        {
          type: 'element' as const,
          tag: 'button',
          attributes: {
            class: 'btn',
            type: 'button'
          },
          expressionAttributes: {
            onClick: 'handleClick'
          }
        }
      ];

      const concepts = selectiveAnalyzer.extractConcepts(template);

      expect(concepts.events).toEqual([]);
      expect(concepts.styling.staticClasses).toEqual([]);
      expect(concepts.attributes).toHaveLength(1); // type attribute
    });

    it('should use custom event prefixes', () => {
      const customAnalyzer = new TemplateAnalyzer({
        eventPrefixes: ['bind:', 'handle-']
      });

      const template = [
        {
          type: 'element' as const,
          tag: 'div',
          expressionAttributes: {
            'bind:click': 'clickHandler',
            'handle-submit': 'submitHandler',
            'onClick': 'ignoredHandler' // Should be ignored
          }
        }
      ];

      const concepts = customAnalyzer.extractConcepts(template);

      expect(concepts.events).toHaveLength(2);
      expect(concepts.events.find(e => e.name === 'click')).toBeDefined();
      expect(concepts.events.find(e => e.name === 'submit')).toBeDefined();
      expect(concepts.events.find(e => e.handler === 'ignoredHandler')).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown node types', () => {
      const template = [
        {
          type: 'unknown' as any,
          tag: 'div'
        }
      ];

      const concepts = analyzer.extractConcepts(template);

      expect(errorCollector.hasWarnings()).toBe(true);
      const warnings = errorCollector.getErrorsBySeverity('warning');
      expect(warnings[0].message).toContain('Unknown node type for structural extraction: unknown');
    });

    it('should collect multiple errors', () => {
      const template = [
        {
          type: 'if' as const,
          // Missing condition
        },
        {
          type: 'slot' as const,
          // Missing name
        },
        {
          type: 'for' as const,
          item: 'item'
          // Missing items
        }
      ];

      analyzer.extractConcepts(template);

      expect(errorCollector.getErrorCount('warning')).toBe(3);
    });

    it('should clear errors between analyses', () => {
      const template = [
        {
          type: 'if' as const
        }
      ];

      analyzer.extractConcepts(template);
      expect(errorCollector.hasWarnings()).toBe(true);

      analyzer.clearErrors();
      expect(errorCollector.hasWarnings()).toBe(false);
    });
  });
});