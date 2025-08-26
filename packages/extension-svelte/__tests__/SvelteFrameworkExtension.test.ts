/**
 * Svelte Framework Extension Tests
 * 
 * Tests all concept processing methods and Svelte component generation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SvelteFrameworkExtension } from '../src/index';
import type {
  EventConcept,
  ConditionalConcept,
  IterationConcept,
  SlotConcept,
  AttributeConcept,
  ComponentConcept,
  RenderContext
} from '@js-template-engine/core';

describe('SvelteFrameworkExtension', () => {
  let extension: SvelteFrameworkExtension;

  beforeEach(() => {
    extension = new SvelteFrameworkExtension();
  });

  describe('metadata', () => {
    it('should have correct extension metadata', () => {
      expect(extension.metadata.type).toBe('framework');
      expect(extension.metadata.key).toBe('svelte');
      expect(extension.metadata.name).toBe('Svelte Framework Extension');
      expect(extension.metadata.version).toBe('1.0.0');
      expect(extension.framework).toBe('svelte');
    });
  });

  describe('processEvents', () => {
    it('should normalize events to Svelte directive format', () => {
      const events: EventConcept[] = [
        { name: 'click', handler: 'handleClick', nodeId: 'node1', modifiers: [], parameters: [] }
      ];
      
      const result = extension.processEvents(events);
      
      expect(result.attributes['on:click']).toBe('handleClick');
      expect(result.imports).toEqual([]);
    });

    it('should handle event modifiers', () => {
      const events: EventConcept[] = [
        { 
          name: 'click', 
          handler: 'handleClick', 
          modifiers: ['preventDefault', 'stopPropagation'], 
          nodeId: 'node1', 
          parameters: [] 
        }
      ];
      
      const result = extension.processEvents(events);
      
      expect(result.attributes['on:click']).toBe('handleClick');
    });

    it('should handle multiple events', () => {
      const events: EventConcept[] = [
        { name: 'click', handler: 'handleClick', nodeId: 'node1', modifiers: [], parameters: [] },
        { name: 'change', handler: 'handleChange', nodeId: 'node2', modifiers: [], parameters: [] }
      ];
      
      const result = extension.processEvents(events);
      
      expect(result.attributes['on:click']).toBe('handleClick');
      expect(result.attributes['on:change']).toBe('handleChange');
    });

    it('should handle events with parameters', () => {
      const events: EventConcept[] = [
        { 
          name: 'click', 
          handler: 'handleClick', 
          parameters: ['$event', 'item'], 
          nodeId: 'node1',
          modifiers: []
        }
      ];
      
      const result = extension.processEvents(events);
      
      expect(result.attributes['on:click']).toBe('handleClick');
    });

    it('should generate proper event syntax with modifiers', () => {
      const events: EventConcept[] = [
        { 
          name: 'click', 
          handler: 'handleClick', 
          modifiers: ['preventDefault', 'once'], 
          nodeId: 'node1',
          parameters: []
        }
      ];
      
      const result = extension.processEvents(events);
      
      // Internal syntax generation test
      const processedEvents = events.map(event => {
        const normalizedEvent = (extension as any).eventNormalizer.normalizeEvent(event, {
          framework: 'svelte',
          preserveModifiers: true
        });
        return (extension as any).generateEventSyntax(event.name, event.handler, event.modifiers);
      });
      
      expect(processedEvents[0]).toBe('on:click|preventDefault|once={handleClick}');
    });
  });

  describe('processConditionals', () => {
    it('should generate if block for conditionals', () => {
      const conditionals: ConditionalConcept[] = [
        {
          condition: 'isVisible',
          thenNodes: [{ type: 'text', content: 'Visible content' }],
          nodeId: 'node1',
          elseNodes: []
        }
      ];
      
      const result = extension.processConditionals(conditionals);
      
      expect(result.syntax).toContain('{#if isVisible}');
      expect(result.syntax).toContain('Visible content');
      expect(result.syntax).toContain('{/if}');
      expect(result.imports).toEqual([]);
    });

    it('should generate if-else block for conditionals with else', () => {
      const conditionals: ConditionalConcept[] = [
        {
          condition: 'isVisible',
          thenNodes: [{ type: 'text', content: 'Visible content' }],
          elseNodes: [{ type: 'text', content: 'Hidden content' }],
          nodeId: 'node1'
        }
      ];
      
      const result = extension.processConditionals(conditionals);
      
      expect(result.syntax).toContain('{#if isVisible}');
      expect(result.syntax).toContain('Visible content');
      expect(result.syntax).toContain('{:else}');
      expect(result.syntax).toContain('Hidden content');
      expect(result.syntax).toContain('{/if}');
    });

    it('should handle multiple conditionals', () => {
      const conditionals: ConditionalConcept[] = [
        {
          condition: 'showFirst',
          thenNodes: [{ type: 'text', content: 'First' }],
          nodeId: 'node1',
          elseNodes: []
        },
        {
          condition: 'showSecond',
          thenNodes: [{ type: 'text', content: 'Second' }],
          nodeId: 'node2',
          elseNodes: []
        }
      ];
      
      const result = extension.processConditionals(conditionals);
      
      expect(result.syntax).toContain('{#if showFirst}');
      expect(result.syntax).toContain('{#if showSecond}');
    });

    it('should properly indent conditional content', () => {
      const conditionals: ConditionalConcept[] = [
        {
          condition: 'isVisible',
          thenNodes: [{ type: 'element', tag: 'div', content: 'Test content', attributes: {} }],
          nodeId: 'node1',
          elseNodes: []
        }
      ];
      
      const result = extension.processConditionals(conditionals);
      
      expect(result.syntax).toMatch(/\{\#if isVisible\}\n  .+\n\{\/if\}/);
    });
  });

  describe('processIterations', () => {
    it('should generate each block for iterations', () => {
      const iterations: IterationConcept[] = [
        {
          items: 'todos',
          itemVariable: 'todo',
          childNodes: [{ type: 'text', content: '{todo.text}' }],
          nodeId: 'node1'
        }
      ];
      
      const result = extension.processIterations(iterations);
      
      expect(result.syntax).toContain('{#each todos as todo}');
      expect(result.syntax).toContain('{todo.text}');
      expect(result.syntax).toContain('{/each}');
      expect(result.imports).toEqual([]);
    });

    it('should handle iterations with index', () => {
      const iterations: IterationConcept[] = [
        {
          items: 'users',
          itemVariable: 'user',
          indexVariable: 'i',
          childNodes: [{ type: 'text', content: '{user.name} - {i}' }],
          nodeId: 'node1'
        }
      ];
      
      const result = extension.processIterations(iterations);
      
      expect(result.syntax).toContain('{#each users as user, i}');
      expect(result.syntax).toContain('{user.name} - {i}');
      expect(result.syntax).toContain('{/each}');
    });

    it('should handle iterations with key expression', () => {
      const iterations: IterationConcept[] = [
        {
          items: 'todos',
          itemVariable: 'todo',
          keyExpression: 'todo.id',
          childNodes: [{ type: 'text', content: '{todo.text}' }],
          nodeId: 'node1'
        }
      ];
      
      const result = extension.processIterations(iterations);
      
      expect(result.syntax).toContain('{#each todos as todo (todo.id)}');
      expect(result.syntax).toContain('{todo.text}');
      expect(result.syntax).toContain('{/each}');
    });

    it('should handle iterations with both index and key', () => {
      const iterations: IterationConcept[] = [
        {
          items: 'items',
          itemVariable: 'item',
          indexVariable: 'index',
          keyExpression: 'item.uuid',
          childNodes: [{ type: 'text', content: '{item.name}' }],
          nodeId: 'node1'
        }
      ];
      
      const result = extension.processIterations(iterations);
      
      expect(result.syntax).toContain('{#each items as item, index (item.uuid)}');
    });

    it('should properly indent iteration content', () => {
      const iterations: IterationConcept[] = [
        {
          items: 'todos',
          itemVariable: 'todo',
          childNodes: [{ type: 'element', tag: 'li', content: '{todo.text}', attributes: {} }],
          nodeId: 'node1'
        }
      ];
      
      const result = extension.processIterations(iterations);
      
      expect(result.syntax).toMatch(/\{\#each todos as todo\}\n  .+\n\{\/each\}/);
    });
  });

  describe('processSlots', () => {
    it('should generate slot element for default slot', () => {
      const slots: SlotConcept[] = [
        {
          name: 'default',
          nodeId: 'node1',
          fallback: []
        }
      ];
      
      const result = extension.processSlots(slots);
      
      expect(result.syntax).toBe('<slot />');
      expect(result.props).toEqual({});
      expect(result.imports).toEqual([]);
    });

    it('should generate named slot element', () => {
      const slots: SlotConcept[] = [
        {
          name: 'header',
          nodeId: 'node1',
          fallback: []
        }
      ];
      
      const result = extension.processSlots(slots);
      
      expect(result.syntax).toBe('<slot name="header" />');
    });

    it('should handle slot with fallback content', () => {
      const slots: SlotConcept[] = [
        {
          name: 'header',
          fallback: [{ type: 'text', content: 'Default Header' }],
          nodeId: 'node1'
        }
      ];
      
      const result = extension.processSlots(slots);
      
      expect(result.syntax).toContain('<slot name="header">');
      expect(result.syntax).toContain('Default Header');
      expect(result.syntax).toContain('</slot>');
    });

    it('should handle multiple slots', () => {
      const slots: SlotConcept[] = [
        {
          name: 'header',
          nodeId: 'node1',
          fallback: []
        },
        {
          name: 'footer',
          nodeId: 'node2',
          fallback: []
        }
      ];
      
      const result = extension.processSlots(slots);
      
      expect(result.syntax).toContain('<slot name="header" />');
      expect(result.syntax).toContain('<slot name="footer" />');
    });

    it('should properly indent slot fallback content', () => {
      const slots: SlotConcept[] = [
        {
          name: 'content',
          fallback: [{ type: 'element', tag: 'p', content: 'Default content', attributes: {} }],
          nodeId: 'node1'
        }
      ];
      
      const result = extension.processSlots(slots);
      
      expect(result.syntax).toMatch(/<slot name="content">\n  .+\n<\/slot>/);
    });
  });

  describe('processAttributes', () => {
    it('should handle static attributes', () => {
      const attributes: AttributeConcept[] = [
        { name: 'class', value: 'button primary', isExpression: false, nodeId: 'node1' },
        { name: 'id', value: 'myButton', isExpression: false, nodeId: 'node1' }
      ];
      
      const result = extension.processAttributes(attributes);
      
      expect(result.attributes).toEqual({
        class: 'button primary',
        id: 'myButton'
      });
      expect(result.imports).toEqual([]);
    });

    it('should handle dynamic attributes', () => {
      const attributes: AttributeConcept[] = [
        { name: 'disabled', value: 'isDisabled', isExpression: true, nodeId: 'node1' },
        { name: 'title', value: 'buttonTitle', isExpression: true, nodeId: 'node1' }
      ];
      
      const result = extension.processAttributes(attributes);
      
      expect(result.attributes).toEqual({
        disabled: 'isDisabled',
        title: 'buttonTitle'
      });
    });

    it('should handle Svelte directives', () => {
      const attributes: AttributeConcept[] = [
        { name: 'bind:value', value: 'inputValue', isExpression: false, nodeId: 'node1' },
        { name: 'on:click', value: 'handleClick', isExpression: false, nodeId: 'node1' },
        { name: 'use:tooltip', value: 'tooltipAction', isExpression: false, nodeId: 'node1' }
      ];
      
      const result = extension.processAttributes(attributes);
      
      expect(result.attributes).toEqual({
        'bind:value': 'inputValue',
        'on:click': 'handleClick',
        'use:tooltip': 'tooltipAction'
      });
    });

    it('should handle class directive with expression', () => {
      const attributes: AttributeConcept[] = [
        { name: 'class', value: 'classExpression', isExpression: true, nodeId: 'node1' }
      ];
      
      const result = extension.processAttributes(attributes);
      
      expect(result.attributes).toEqual({
        class: 'classExpression'
      });
    });

    it('should handle boolean attributes', () => {
      const attributes: AttributeConcept[] = [
        { name: 'checked', value: true, isExpression: false, nodeId: 'node1' },
        { name: 'disabled', value: false, isExpression: false, nodeId: 'node1' }
      ];
      
      const result = extension.processAttributes(attributes);
      
      expect(result.attributes).toEqual({
        checked: 'true'
      });
    });
  });

  describe('renderComponent', () => {
    it('should generate basic Svelte component', () => {
      const concepts: ComponentConcept = {
        structure: [
          {
            type: 'element',
            tag: 'div',
            nodeId: 'root',
            children: [
              { type: 'text', content: 'Component content' }
            ]
          }
        ],
        events: [],
        conditionals: [],
        iterations: [],
        slots: [],
        attributes: [],
        styling: {
          staticClasses: [],
          dynamicClasses: [],
          inlineStyles: {}
        }
      };
      
      const context: RenderContext = {
        component: {
          name: 'TestComponent'
        },
        options: {
          language: 'javascript'
        }
      };
      
      const result = extension.renderComponent(concepts, context);
      
      expect(result).toContain('<script>');
      expect(result).toContain('</script>');
      expect(result).toContain('<div>Component content</div>');
    });

    it('should generate TypeScript Svelte component', () => {
      const concepts: ComponentConcept = {
        events: [],
        conditionals: [],
        iterations: [],
        slots: [],
        attributes: [],
        styling: {
          staticClasses: [],
          dynamicClasses: [],
          inlineStyles: {}
        }
      };
      
      const context: RenderContext = {
        component: {
          name: 'TestComponent',
          props: {
            title: 'string',
            count: 'number'
          }
        },
        options: {
          language: 'typescript'
        }
      };
      
      const result = extension.renderComponent(concepts, context);
      
      expect(result).toContain('<script lang="ts">');
      expect(result).toContain('export let title: string;');
      expect(result).toContain('export let count: number;');
    });

    it('should handle component with events and conditionals', () => {
      const concepts: ComponentConcept = {
        structure: [
          {
            type: 'element',
            tag: 'button',
            nodeId: 'node1',
            children: [
              { type: 'text', content: 'Click me' }
            ]
          }
        ],
        events: [
          { name: 'click', handler: 'handleClick', nodeId: 'node1', modifiers: [], parameters: [] }
        ],
        conditionals: [
          {
            condition: 'isVisible',
            thenNodes: [{ type: 'text', content: 'Visible' }],
            nodeId: 'node2',
            elseNodes: []
          }
        ],
        iterations: [],
        slots: [],
        attributes: [],
        styling: {
          staticClasses: [],
          dynamicClasses: [],
          inlineStyles: {}
        }
      };
      
      const context: RenderContext = {
        component: {
          name: 'InteractiveComponent'
        },
        options: {
          language: 'javascript'
        }
      };
      
      const result = extension.renderComponent(concepts, context);
      
      expect(result).toContain('{#if isVisible}');
      expect(result).toContain('on:click={handleClick}');
    });

    it('should handle component with iterations and slots', () => {
      const concepts: ComponentConcept = {
        events: [],
        conditionals: [],
        iterations: [
          {
            items: 'items',
            itemVariable: 'item',
            childNodes: [{ type: 'text', content: '{item.name}' }],
            nodeId: 'node1'
          }
        ],
        slots: [
          {
            name: 'header',
            fallback: [{ type: 'text', content: 'Default Header' }],
            nodeId: 'node2'
          }
        ],
        attributes: [],
        styling: {
          staticClasses: [],
          dynamicClasses: [],
          inlineStyles: {}
        }
      };
      
      const context: RenderContext = {
        component: {
          name: 'ListComponent'
        },
        options: {
          language: 'javascript'
        }
      };
      
      const result = extension.renderComponent(concepts, context);
      
      expect(result).toContain('{#each items as item}');
      expect(result).toContain('<slot name="header">');
    });

    it('should handle component with styling', () => {
      const concepts: ComponentConcept = {
        structure: [
          {
            type: 'element',
            tag: 'button',
            nodeId: 'root',
            children: [
              { type: 'text', content: 'Styled Button' }
            ]
          }
        ],
        events: [],
        conditionals: [],
        iterations: [],
        slots: [],
        attributes: [],
        styling: {
          staticClasses: ['btn', 'btn-primary'],
          dynamicClasses: [],
          inlineStyles: {
            color: 'red',
            'font-size': '16px'
          }
        }
      };
      
      const context: RenderContext = {
        component: {
          name: 'StyledComponent'
        },
        options: {
          language: 'javascript'
        }
      };
      
      const result = extension.renderComponent(concepts, context);
      
      expect(result).toContain('class="btn btn-primary"');
      expect(result).toContain('style="color: red; font-size: 16px"');
    });

    it('should include style section when provided', () => {
      const concepts: ComponentConcept = {
        events: [],
        conditionals: [],
        iterations: [],
        slots: [],
        attributes: [],
        styling: {
          staticClasses: [],
          dynamicClasses: [],
          inlineStyles: {}
        }
      };
      
      const context: RenderContext = {
        component: {
          name: 'StyledComponent',
          extensions: {
            svelte: {
              styleOutput: '.btn { color: blue; }',
              styleLanguage: 'scss',
              globalStyles: false
            }
          }
        },
        options: {
          language: 'javascript'
        }
      };
      
      const result = extension.renderComponent(concepts, context);
      
      expect(result).toContain('<style lang="scss">');
      expect(result).toContain('.btn { color: blue; }');
      expect(result).toContain('</style>');
    });

    it('should handle global styles', () => {
      const concepts: ComponentConcept = {
        events: [],
        conditionals: [],
        iterations: [],
        slots: [],
        attributes: [],
        styling: {
          staticClasses: [],
          dynamicClasses: [],
          inlineStyles: {}
        }
      };
      
      const context: RenderContext = {
        component: {
          name: 'GlobalStyledComponent',
          extensions: {
            svelte: {
              styleOutput: 'body { margin: 0; }',
              globalStyles: true
            }
          }
        },
        options: {
          language: 'javascript'
        }
      };
      
      const result = extension.renderComponent(concepts, context);
      
      expect(result).toContain('<style global>');
      expect(result).toContain('body { margin: 0; }');
    });
  });

  describe('getFileExtension', () => {
    it('should return .svelte extension', () => {
      expect(extension.getFileExtension({ language: 'javascript' })).toBe('.svelte');
      expect(extension.getFileExtension({ language: 'typescript' })).toBe('.svelte');
    });
  });

  describe('getPrettierParser', () => {
    it('should return svelte parser', () => {
      expect(extension.getPrettierParser({ language: 'javascript' })).toBe('svelte');
      expect(extension.getPrettierParser({ language: 'typescript' })).toBe('svelte');
    });
  });

  describe('cross-framework consistency', () => {
    it('should process same concepts as React/Vue with Svelte syntax', () => {
      const events: EventConcept[] = [
        { name: 'click', handler: 'handleClick', nodeId: 'node1', modifiers: [], parameters: [] }
      ];
      
      const conditionals: ConditionalConcept[] = [
        {
          condition: 'isVisible',
          thenNodes: [{ type: 'text', content: 'Content' }],
          nodeId: 'node1',
          elseNodes: []
        }
      ];
      
      const iterations: IterationConcept[] = [
        {
          items: 'items',
          itemVariable: 'item',
          childNodes: [{ type: 'text', content: '{item.name}' }],
          nodeId: 'node1'
        }
      ];
      
      const eventResult = extension.processEvents(events);
      const conditionalResult = extension.processConditionals(conditionals);
      const iterationResult = extension.processIterations(iterations);
      
      // Verify Svelte-specific syntax
      expect(eventResult.attributes['on:click']).toBe('handleClick');
      expect(conditionalResult.syntax).toContain('{#if isVisible}');
      expect(iterationResult.syntax).toContain('{#each items as item}');
      
      // Verify consistent structure across frameworks
      expect(typeof eventResult.attributes).toBe('object');
      expect(Array.isArray(eventResult.imports)).toBe(true);
      expect(typeof conditionalResult.syntax).toBe('string');
      expect(Array.isArray(conditionalResult.imports)).toBe(true);
      expect(typeof iterationResult.syntax).toBe('string');
      expect(Array.isArray(iterationResult.imports)).toBe(true);
    });
  });

  describe('advanced processor integration', () => {
    it('should use EventNormalizer for cross-framework consistency', () => {
      const events: EventConcept[] = [
        { name: 'click', handler: 'handleClick', nodeId: 'node1', modifiers: [], parameters: [] },
        { name: 'change', handler: 'handleChange', nodeId: 'node2', modifiers: [], parameters: [] },
        { name: 'submit', handler: 'handleSubmit', nodeId: 'node3', modifiers: [], parameters: [] }
      ];
      
      const result = extension.processEvents(events);
      
      // Verify Svelte directive format
      expect(result.attributes['on:click']).toBe('handleClick');
      expect(result.attributes['on:change']).toBe('handleChange');
      expect(result.attributes['on:submit']).toBe('handleSubmit');
    });

    it('should use ComponentPropertyProcessor for component name resolution', () => {
      const concepts: ComponentConcept = {
        events: [],
        conditionals: [],
        iterations: [],
        slots: [],
        attributes: [],
        styling: {
          staticClasses: [],
          dynamicClasses: [],
          inlineStyles: {}
        }
      };
      
      const context: RenderContext = {
        component: {
          name: 'CustomSvelteComponent'
        },
        options: {
          language: 'javascript'
        }
      };
      
      const result = extension.renderComponent(concepts, context);
      
      // Component name should be resolved and used
      expect(result).toContain('<script>');
      expect(result).toBeDefined();
    });

    it('should use ScriptMergeProcessor for script merging', () => {
      const concepts: ComponentConcept = {
        events: [],
        conditionals: [],
        iterations: [],
        slots: [],
        attributes: [],
        styling: {
          staticClasses: [],
          dynamicClasses: [],
          inlineStyles: {}
        }
      };
      
      const context: RenderContext = {
        component: {
          name: 'ComponentWithScript',
          script: 'let count = 0;',
          extensions: {
            svelte: {
              script: '$: doubled = count * 2;'
            }
          }
        },
        options: {
          language: 'javascript'
        }
      };
      
      const result = extension.renderComponent(concepts, context);
      
      expect(result).toContain('let count = 0;');
      expect(result).toContain('$: doubled = count * 2;');
    });

    it('should use ImportProcessor for import merging', () => {
      const concepts: ComponentConcept = {
        events: [],
        conditionals: [],
        iterations: [],
        slots: [],
        attributes: [],
        styling: {
          staticClasses: [],
          dynamicClasses: [],
          inlineStyles: {}
        }
      };
      
      const context: RenderContext = {
        component: {
          name: 'ComponentWithImports',
          imports: [
            { from: 'my-lib', named: ['myFunction'] }
          ]
        },
        options: {
          language: 'javascript'
        }
      };
      
      const result = extension.renderComponent(concepts, context);
      
      expect(result).toContain('import { myFunction } from \'my-lib\';');
    });
  });
});