/**
 * Vue Framework Extension Tests
 * 
 * Tests all concept processing methods and SFC generation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VueFrameworkExtension } from '../src/index';
import type {
  EventConcept,
  ConditionalConcept,
  IterationConcept,
  SlotConcept,
  AttributeConcept,
  ComponentConcept,
  RenderContext
} from '@js-template-engine/core';

describe('VueFrameworkExtension', () => {
  let extension: VueFrameworkExtension;

  beforeEach(() => {
    extension = new VueFrameworkExtension();
  });

  describe('metadata', () => {
    it('should have correct extension metadata', () => {
      expect(extension.metadata.type).toBe('framework');
      expect(extension.metadata.key).toBe('vue');
      expect(extension.metadata.name).toBe('Vue Framework Extension');
      expect(extension.metadata.version).toBe('1.0.0');
      expect(extension.framework).toBe('vue');
    });
  });

  describe('processEvents', () => {
    it('should normalize events to Vue directive format', () => {
      const events: EventConcept[] = [
        { name: 'click', handler: 'handleClick', nodeId: 'node1', modifiers: [], parameters: [] }
      ];
      
      const result = extension.processEvents(events);
      
      expect(result.attributes['@click']).toBe('handleClick');
      expect(result.imports).toEqual([]);
    });

    it('should handle event modifiers', () => {
      const events: EventConcept[] = [
        { 
          name: 'click', 
          handler: 'handleClick', 
          modifiers: ['prevent', 'stop'], 
          nodeId: 'node1', 
          parameters: [] 
        }
      ];
      
      const result = extension.processEvents(events);
      
      expect(result.attributes['@click']).toBe('handleClick');
    });

    it('should handle multiple events', () => {
      const events: EventConcept[] = [
        { name: 'click', handler: 'handleClick', nodeId: 'node1', modifiers: [], parameters: [] },
        { name: 'change', handler: 'handleChange', nodeId: 'node2', modifiers: [], parameters: [] }
      ];
      
      const result = extension.processEvents(events);
      
      expect(result.attributes['@click']).toBe('handleClick');
      expect(result.attributes['@change']).toBe('handleChange');
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
      
      expect(result.attributes['@click']).toBe('handleClick');
    });
  });

  describe('processConditionals', () => {
    it('should generate v-if directive for single element', () => {
      const conditionals: ConditionalConcept[] = [
        {
          condition: 'isVisible',
          thenNodes: [{ type: 'element', tag: 'div', content: 'Content', attributes: {} }],
          nodeId: 'node1',
          elseNodes: []
        }
      ];
      
      const result = extension.processConditionals(conditionals);
      
      expect(result.syntax).toContain('v-if="isVisible"');
      expect(result.syntax).toContain('<div');
    });

    it('should handle v-if/v-else with single elements', () => {
      const conditionals: ConditionalConcept[] = [
        {
          condition: 'isVisible',
          thenNodes: [{ type: 'element', tag: 'div', content: 'Visible', attributes: {} }],
          elseNodes: [{ type: 'element', tag: 'span', content: 'Hidden', attributes: {} }],
          nodeId: 'node1'
        }
      ];
      
      const result = extension.processConditionals(conditionals);
      
      expect(result.syntax).toContain('v-if="isVisible"');
      expect(result.syntax).toContain('v-else');
      expect(result.syntax).toContain('<div');
      expect(result.syntax).toContain('<span');
    });

    it('should wrap multiple elements in template', () => {
      const conditionals: ConditionalConcept[] = [
        {
          condition: 'showSection',
          thenNodes: [
            { type: 'element', tag: 'h2', content: 'Title', attributes: {} },
            { type: 'element', tag: 'p', content: 'Text', attributes: {} }
          ],
          nodeId: 'node1',
          elseNodes: []
        }
      ];
      
      const result = extension.processConditionals(conditionals);
      
      expect(result.syntax).toContain('<template v-if="showSection"');
      expect(result.syntax).toContain('<h2');
      expect(result.syntax).toContain('<p');
    });
  });

  describe('processIterations', () => {
    it('should generate v-for directive with proper syntax', () => {
      const iterations: IterationConcept[] = [
        {
          items: 'todos',
          itemVariable: 'todo',
          keyExpression: 'todo.id',
          childNodes: [{ type: 'element', tag: 'li', content: '{{ todo.text }}', attributes: {} }],
          nodeId: 'node1'
        }
      ];
      
      const result = extension.processIterations(iterations);
      
      expect(result.syntax).toContain('v-for="todo in todos"');
      expect(result.syntax).toContain(':key="todo.id"');
      expect(result.syntax).toContain('<li');
    });

    it('should handle v-for with index variable', () => {
      const iterations: IterationConcept[] = [
        {
          items: 'users',
          itemVariable: 'user',
          indexVariable: 'i',
          keyExpression: 'i',
          childNodes: [{ type: 'element', tag: 'div', content: '{{ user.name }}', attributes: {} }],
          nodeId: 'node1'
        }
      ];
      
      const result = extension.processIterations(iterations);
      
      expect(result.syntax).toContain('v-for="(user, i) in users"');
      expect(result.syntax).toContain(':key="i"');
    });

    it('should wrap multiple child elements in template', () => {
      const iterations: IterationConcept[] = [
        {
          items: 'items',
          itemVariable: 'item',
          keyExpression: 'item.id',
          childNodes: [
            { type: 'element', tag: 'div', content: '{{ item.name }}', attributes: {} },
            { type: 'element', tag: 'span', content: '{{ item.count }}', attributes: {} }
          ],
          nodeId: 'node1'
        }
      ];
      
      const result = extension.processIterations(iterations);
      
      expect(result.syntax).toContain('<template v-for="item in items"');
      expect(result.syntax).toContain(':key="item.id"');
    });
  });

  describe('processSlots', () => {
    it('should generate basic slot element', () => {
      const slots: SlotConcept[] = [
        {
          name: 'header',
          fallback: null,
          nodeId: 'node1'
        }
      ];
      
      const result = extension.processSlots(slots);
      
      expect(result.syntax).toContain('<slot name="header"');
    });

    it('should handle default slot', () => {
      const slots: SlotConcept[] = [
        {
          name: 'default',
          fallback: null,
          nodeId: 'node1'
        }
      ];
      
      const result = extension.processSlots(slots);
      
      expect(result.syntax).toContain('<slot');
      expect(result.syntax).not.toContain('name=');
    });

    it('should handle slot with fallback content', () => {
      const slots: SlotConcept[] = [
        {
          name: 'header',
          fallback: [{ type: 'element', tag: 'h2', content: 'Default Header', attributes: {} }],
          nodeId: 'node1'
        }
      ];
      
      const result = extension.processSlots(slots);
      
      expect(result.syntax).toContain('<slot name="header"');
      expect(result.syntax).toContain('Default Header');
    });
  });

  describe('processAttributes', () => {
    it('should handle static attributes', () => {
      const attributes: AttributeConcept[] = [
        { name: 'class', value: 'button primary', isExpression: false, nodeId: 'node1' }
      ];
      
      const result = extension.processAttributes(attributes);
      
      expect(result.attributes['class']).toBe('button primary');
    });

    it('should handle dynamic attributes with binding', () => {
      const attributes: AttributeConcept[] = [
        { name: 'disabled', value: 'isDisabled', isExpression: true, nodeId: 'node1' }
      ];
      
      const result = extension.processAttributes(attributes);
      
      expect(result.attributes[':disabled']).toBe('isDisabled');
    });

    it('should handle Vue directives', () => {
      const attributes: AttributeConcept[] = [
        { name: 'v-model', value: 'inputValue', isExpression: false, nodeId: 'node1' }
      ];
      
      const result = extension.processAttributes(attributes);
      
      expect(result.attributes['v-model']).toBe('inputValue');
    });

    it('should handle event handlers', () => {
      const attributes: AttributeConcept[] = [
        { name: '@click', value: 'handleClick', isExpression: false, nodeId: 'node1' }
      ];
      
      const result = extension.processAttributes(attributes);
      
      expect(result.attributes['@click']).toBe('handleClick');
    });
  });

  describe('renderComponent', () => {
    it('should generate valid Vue SFC with setup script', () => {
      const concepts: ComponentConcept = {
        events: [
          { name: 'click', handler: 'handleClick', nodeId: 'node1', modifiers: [], parameters: [] }
        ],
        conditionals: [],
        iterations: [],
        slots: [],
        attributes: [
          { name: 'class', value: 'btn', isExpression: false, nodeId: 'node2' }
        ],
        styling: {
          staticClasses: ['button'],
          dynamicClasses: [],
          inlineStyles: {}
        }
      };

      const context: RenderContext = {
        component: {
          name: 'TestButton',
          props: { label: 'string' },
          script: 'const handleClick = () => console.log("clicked");',
          extensions: {
            vue: {
              setup: true
            }
          }
        },
        options: { language: 'typescript' }
      };
      
      const result = extension.renderComponent(concepts, context);
      
      expect(result).toContain('<template>');
      expect(result).toContain('<script setup lang="ts">');
      expect(result).toContain('defineProps<TestButtonProps>');
      expect(result).toContain('handleClick');
    });

    it('should generate valid Vue SFC with Options API', () => {
      const concepts: ComponentConcept = {
        events: [],
        conditionals: [
          {
            condition: 'isVisible',
            thenNodes: [{ type: 'element', tag: 'span', content: 'Visible', attributes: {} }],
            elseNodes: [],
            nodeId: 'node1'
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
          name: 'TestComponent',
          extensions: {
            vue: {
              composition: false
            }
          }
        },
        options: { language: 'javascript' }
      };
      
      const result = extension.renderComponent(concepts, context);
      
      expect(result).toContain('<template>');
      expect(result).toContain('<script>');
      expect(result).toContain('export default defineComponent');
      expect(result).toContain('v-if="isVisible"');
    });

    it('should handle components with slots and props', () => {
      const concepts: ComponentConcept = {
        events: [],
        conditionals: [],
        iterations: [],
        slots: [
          { name: 'header', fallback: null, nodeId: 'node1' },
          { name: 'default', fallback: null, nodeId: 'node2' }
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
          name: 'CardComponent',
          props: {
            title: 'string',
            variant: 'string'
          }
        },
        options: { language: 'typescript' }
      };
      
      const result = extension.renderComponent(concepts, context);
      
      expect(result).toContain('<slot name="header"');
      expect(result).toContain('<slot');
      expect(result).toContain('interface CardComponentProps');
      expect(result).toContain('title?: string');
      expect(result).toContain('variant?: string');
    });

    it('should handle style sections', () => {
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
            vue: {
              styleOutput: '.component { color: red; }',
              styleLanguage: 'scss',
              scoped: true
            }
          }
        }
      };
      
      const result = extension.renderComponent(concepts, context);
      
      expect(result).toContain('<style lang="scss" scoped>');
      expect(result).toContain('.component { color: red; }');
    });

    it('should handle complex component with all features', () => {
      const concepts: ComponentConcept = {
        events: [
          { name: 'click', handler: 'handleClick', nodeId: 'btn', modifiers: ['prevent'], parameters: [] }
        ],
        conditionals: [
          {
            condition: 'showContent',
            thenNodes: [{ type: 'element', tag: 'div', content: 'Content', attributes: {} }],
            elseNodes: [],
            nodeId: 'content'
          }
        ],
        iterations: [
          {
            items: 'items',
            itemVariable: 'item',
            keyExpression: 'item.id',
            childNodes: [{ type: 'element', tag: 'li', content: '{{ item.name }}', attributes: {} }],
            nodeId: 'list'
          }
        ],
        slots: [
          { name: 'header', fallback: null, nodeId: 'header' }
        ],
        attributes: [
          { name: 'class', value: 'container', isExpression: false, nodeId: 'root' }
        ],
        styling: {
          staticClasses: ['card'],
          dynamicClasses: ['isActive && "active"'],
          inlineStyles: { padding: '1rem' }
        }
      };

      const context: RenderContext = {
        component: {
          name: 'ComplexComponent',
          props: { items: 'array', showContent: 'boolean' },
          script: 'const handleClick = () => console.log("clicked");',
          extensions: {
            vue: {
              setup: true,
              styleOutput: '.card { border: 1px solid #ccc; }',
              scoped: true
            }
          }
        },
        options: { language: 'typescript' }
      };
      
      const result = extension.renderComponent(concepts, context);
      
      // Check all features are present
      expect(result).toContain('<template>');
      expect(result).toContain('<script setup lang="ts">');
      expect(result).toContain('<style scoped>');
      expect(result).toContain('v-if="showContent"');
      expect(result).toContain('v-for="item in items"');
      expect(result).toContain('<slot name="header"');
      expect(result).toContain('defineProps<ComplexComponentProps>');
      expect(result).toContain('handleClick');
    });
  });

  describe('Vue-specific features', () => {
    it('should handle Vue directive modifiers correctly', () => {
      const events: EventConcept[] = [
        { 
          name: 'keydown', 
          handler: 'onKeyDown', 
          modifiers: ['enter', 'prevent'], 
          nodeId: 'input',
          parameters: []
        }
      ];
      
      const result = extension.processEvents(events);
      
      expect(result.attributes['@keydown']).toBe('onKeyDown');
    });

    it('should generate proper Vue SFC file extensions', () => {
      expect(extension.getFileExtension({ language: 'typescript' })).toBe('.vue');
      expect(extension.getFileExtension({ language: 'javascript' })).toBe('.vue');
    });

    it('should use Vue prettier parser', () => {
      expect(extension.getPrettierParser({ language: 'typescript' })).toBe('vue');
      expect(extension.getPrettierParser({ language: 'javascript' })).toBe('vue');
    });
  });

  describe('Cross-framework consistency', () => {
    it('should process same concepts consistently', () => {
      const events: EventConcept[] = [
        { name: 'click', handler: 'handleClick', nodeId: 'node1', modifiers: [], parameters: [] }
      ];
      
      const vueResult = extension.processEvents(events);
      
      // Vue should convert to @click format
      expect(vueResult.attributes['@click']).toBe('handleClick');
      
      // Events should maintain same handler regardless of framework
      expect(Object.values(vueResult.attributes)).toContain('handleClick');
    });
  });

  describe('Error handling', () => {
    it('should handle empty concepts gracefully', () => {
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
        component: { name: 'EmptyComponent' }
      };
      
      const result = extension.renderComponent(concepts, context);
      
      expect(result).toContain('<template>');
      expect(result).toContain('<script>');
    });

    it('should handle malformed events', () => {
      const events: EventConcept[] = [
        { name: '', handler: '', nodeId: 'node1', modifiers: [], parameters: [] }
      ];
      
      const result = extension.processEvents(events);
      
      expect(result.attributes).toBeDefined();
      expect(Array.isArray(result.imports)).toBe(true);
    });
  });

  describe('TypeScript support validation', () => {
    it('should generate TypeScript props interface', () => {
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
          name: 'TypeScriptComponent',
          props: { count: 'number', label: 'string' }
        },
        options: { language: 'typescript' }
      };
      
      const result = extension.renderComponent(concepts, context);
      
      expect(result).toContain('interface TypeScriptComponentProps');
      expect(result).toContain('count?: number');
      expect(result).toContain('label?: string');
      expect(result).toContain('lang="ts"');
    });
  });
});

// Integration test to verify the extension works with actual Vue compilation
describe('Vue SFC Compilation Integration', () => {
  let extension: VueFrameworkExtension;

  beforeEach(() => {
    extension = new VueFrameworkExtension();
  });

  it('should generate SFC that could be compiled by Vue', () => {
    const concepts: ComponentConcept = {
      events: [
        { name: 'click', handler: 'increment', nodeId: 'button', modifiers: [], parameters: [] }
      ],
      conditionals: [
        {
          condition: 'count > 0',
          thenNodes: [{ type: 'element', tag: 'p', content: 'Count is positive', attributes: {} }],
          elseNodes: [],
          nodeId: 'message'
        }
      ],
      iterations: [],
      slots: [],
      attributes: [
        { name: 'class', value: 'counter-button', isExpression: false, nodeId: 'button' }
      ],
      styling: {
        staticClasses: [],
        dynamicClasses: [],
        inlineStyles: {}
      }
    };

    const context: RenderContext = {
      component: {
        name: 'CounterComponent',
        props: { initialCount: 'number' },
        script: `
const count = ref(props.initialCount || 0);
const increment = () => count.value++;
        `,
        extensions: {
          vue: {
            setup: true
          }
        }
      },
      options: { language: 'typescript' }
    };

    const result = extension.renderComponent(concepts, context);

    // Verify SFC structure
    expect(result).toMatch(/<template>\s*[\s\S]*?\s*<\/template>/);
    expect(result).toMatch(/<script setup lang="ts">\s*[\s\S]*?\s*<\/script>/);
    
    // Verify Vue-specific syntax
    expect(result).toContain('@click="increment"');
    expect(result).toContain('v-if="count > 0"');
    expect(result).toContain('class="counter-button"');
    expect(result).toContain('defineProps<CounterComponentProps>');
    
    // Verify proper imports
    expect(result).toContain('import { defineComponent } from \'vue\'');
    
    // Verify TypeScript interface
    expect(result).toContain('interface CounterComponentProps {');
    expect(result).toContain('initialCount?: number;');
  });
});