/**
 * Tests for EventExtractor - Advanced Event Extraction
 */

import { EventExtractor } from '../../src/extractors/EventExtractor';
import { EventNormalizer } from '../../src/normalization/EventNormalizer';
import { ErrorCollector } from '../../src/metadata';
import type { TemplateNode } from '@js-template-engine/types';
import type { EventExtractionOptions } from '../../src/extractors/EventExtractor';

describe('EventExtractor', () => {
  let extractor: EventExtractor;
  let errorCollector: ErrorCollector;

  beforeEach(() => {
    errorCollector = new ErrorCollector();
    extractor = new EventExtractor(errorCollector);
  });

  describe('Basic Event Extraction', () => {
    it('should extract React onClick events', () => {
      const nodes: TemplateNode[] = [
        {
          type: 'element',
          tag: 'button',
          expressionAttributes: {
            onClick: 'handleClick'
          }
        }
      ];

      const result = extractor.extractEvents(nodes, { framework: 'react' });

      expect(result.events).toHaveLength(1);
      expect(result.events[0].name).toBe('click');
      expect(result.events[0].handler).toBe('handleClick');
      expect(result.events[0].frameworkAttribute).toBe('onClick');
    });

    it('should extract Vue @click events', () => {
      const nodes: TemplateNode[] = [
        {
          type: 'element',
          tag: 'button',
          expressionAttributes: {
            '@click': 'handleClick'
          }
        }
      ];

      const result = extractor.extractEvents(nodes, { framework: 'vue' });

      expect(result.events).toHaveLength(1);
      expect(result.events[0].name).toBe('click');
      expect(result.events[0].handler).toBe('handleClick');
      expect(result.events[0].frameworkAttribute).toBe('@click');
    });

    it('should extract Svelte on:click events', () => {
      const nodes: TemplateNode[] = [
        {
          type: 'element',
          tag: 'button',
          expressionAttributes: {
            'on:click': 'handleClick'
          }
        }
      ];

      const result = extractor.extractEvents(nodes, { framework: 'svelte' });

      expect(result.events).toHaveLength(1);
      expect(result.events[0].name).toBe('click');
      expect(result.events[0].handler).toBe('handleClick');
      expect(result.events[0].frameworkAttribute).toBe('on:click');
    });
  });

  describe('Event Normalization', () => {
    it('should normalize Vue events to React', () => {
      const nodes: TemplateNode[] = [
        {
          type: 'element',
          tag: 'input',
          expressionAttributes: {
            '@input': 'handleInput',
            '@change': 'handleChange'
          }
        }
      ];

      const result = extractor.extractEvents(nodes, { 
        framework: 'react',
        normalizeEvents: true
      });

      const inputEvent = result.events.find(e => e.name === 'input');
      const changeEvent = result.events.find(e => e.name === 'change');

      expect(inputEvent?.frameworkAttribute).toBe('onInput');
      expect(changeEvent?.frameworkAttribute).toBe('onChange');
    });

    it('should normalize React events to Vue', () => {
      const nodes: TemplateNode[] = [
        {
          type: 'element',
          tag: 'button',
          expressionAttributes: {
            onKeyDown: 'handleKeyDown'
          }
        }
      ];

      const result = extractor.extractEvents(nodes, { 
        framework: 'vue',
        normalizeEvents: true
      });

      const keyEvent = result.events.find(e => e.name === 'keydown');
      expect(keyEvent?.frameworkAttribute).toBe('@keydown');
    });
  });

  describe('Event Modifiers', () => {
    it('should extract Vue event modifiers', () => {
      const nodes: TemplateNode[] = [
        {
          type: 'element',
          tag: 'form',
          expressionAttributes: {
            '@submit.prevent': 'handleSubmit'
          }
        }
      ];

      const result = extractor.extractEvents(nodes, { 
        framework: 'vue',
        extractModifiers: true
      });

      expect(result.events[0].modifiers).toContain('prevent');
    });

    it('should preserve modifiers during normalization', () => {
      const nodes: TemplateNode[] = [
        {
          type: 'element',
          tag: 'form',
          expressionAttributes: {
            '@submit.prevent.stop': 'handleSubmit'
          }
        }
      ];

      const result = extractor.extractEvents(nodes, { 
        framework: 'react',
        normalizeEvents: true,
        extractModifiers: true,
        preserveModifiers: true
      });

      expect(result.events[0].modifiers).toEqual(['prevent', 'stop']);
      expect(result.events[0].frameworkAttribute).toBe('onSubmit');
    });
  });

  describe('Event Validation', () => {
    it('should validate event handlers', () => {
      const nodes: TemplateNode[] = [
        {
          type: 'element',
          tag: 'button',
          expressionAttributes: {
            onClick: '' // Empty handler
          }
        }
      ];

      const result = extractor.extractEvents(nodes, { 
        framework: 'react',
        validateEvents: true
      });

      expect(result.metadata.warnings).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('empty handler')
        })
      );
    });

    it('should detect framework mismatches', () => {
      const nodes: TemplateNode[] = [
        {
          type: 'element',
          tag: 'button',
          expressionAttributes: {
            '@click': 'handleClick' // Vue syntax in React context
          }
        }
      ];

      const result = extractor.extractEvents(nodes, { 
        framework: 'react',
        validateEvents: true
      });

      expect(result.metadata.warnings).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('framework mismatch')
        })
      );
    });
  });

  describe('Complex Event Scenarios', () => {
    it('should handle multiple events on single element', () => {
      const nodes: TemplateNode[] = [
        {
          type: 'element',
          tag: 'input',
          expressionAttributes: {
            onFocus: 'handleFocus',
            onBlur: 'handleBlur',
            onChange: 'handleChange',
            onKeyDown: 'handleKeyDown'
          }
        }
      ];

      const result = extractor.extractEvents(nodes);

      expect(result.events).toHaveLength(4);
      expect(result.events.map(e => e.name)).toEqual([
        'focus', 'blur', 'change', 'keydown'
      ]);
    });

    it('should handle nested elements with events', () => {
      const nodes: TemplateNode[] = [
        {
          type: 'element',
          tag: 'div',
          expressionAttributes: { onClick: 'handleDivClick' },
          children: [
            {
              type: 'element',
              tag: 'button',
              expressionAttributes: { onClick: 'handleButtonClick' }
            }
          ]
        }
      ];

      const result = extractor.extractEvents(nodes);

      expect(result.events).toHaveLength(2);
      expect(result.events[0].nodeId).toMatch(/^node-\d+-0$/); // div
      expect(result.events[1].nodeId).toMatch(/^node-\d+-0-0$/); // button
    });

    it('should extract events from conditional and loop nodes', () => {
      const nodes: TemplateNode[] = [
        {
          type: 'if',
          condition: 'showButton',
          then: [
            {
              type: 'element',
              tag: 'button',
              expressionAttributes: { onClick: 'handleClick' }
            }
          ]
        },
        {
          type: 'for',
          items: 'items',
          item: 'item',
          children: [
            {
              type: 'element',
              tag: 'button',
              expressionAttributes: { onClick: 'handleItemClick' }
            }
          ]
        }
      ];

      const result = extractor.extractEvents(nodes);

      expect(result.events).toHaveLength(2);
      expect(result.events[0].handler).toBe('handleClick');
      expect(result.events[1].handler).toBe('handleItemClick');
    });
  });

  describe('Performance and Metadata', () => {
    it('should track processing metadata', () => {
      const nodes: TemplateNode[] = [
        {
          type: 'element',
          tag: 'button',
          expressionAttributes: { onClick: 'handleClick' }
        }
      ];

      const result = extractor.extractEvents(nodes);

      expect(result.metadata.nodesProcessed).toBe(1);
      expect(result.metadata.eventsFound).toBe(1);
      expect(result.metadata.processingTime).toBeGreaterThan(0);
    });

    it('should report framework pattern usage', () => {
      const nodes: TemplateNode[] = [
        {
          type: 'element',
          tag: 'button',
          expressionAttributes: { 
            onClick: 'handleClick',
            onFocus: 'handleFocus'
          }
        }
      ];

      const result = extractor.extractEvents(nodes, { framework: 'react' });

      expect(result.metadata.frameworkPatterns.react).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should collect extraction errors', () => {
      const malformedNodes: any = [
        {
          type: 'element',
          tag: 'button',
          expressionAttributes: {
            'invalid-event-name': 'handler'
          }
        }
      ];

      const result = extractor.extractEvents(malformedNodes, {
        validateEvents: true
      });

      expect(errorCollector.hasWarnings()).toBe(true);
    });

    it('should handle missing node properties gracefully', () => {
      const incompleteNodes: any = [
        { type: 'element' }, // Missing tag
        { tag: 'button' }    // Missing type
      ];

      expect(() => {
        extractor.extractEvents(incompleteNodes);
      }).not.toThrow();
    });
  });

  describe('Single Node Extraction', () => {
    it('should extract events from single node', () => {
      const node: TemplateNode = {
        type: 'element',
        tag: 'button',
        expressionAttributes: {
          onClick: 'handleClick',
          onDoubleClick: 'handleDoubleClick'
        }
      };

      const events = extractor.extractEventsFromSingleNode(node, 'test-node');

      expect(events).toHaveLength(2);
      expect(events[0].nodeId).toBe('test-node');
      expect(events[0].name).toBe('click');
      expect(events[1].name).toBe('doubleclick');
    });
  });
});