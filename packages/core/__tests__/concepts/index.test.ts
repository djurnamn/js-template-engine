/**
 * Tests for core concept interfaces and types.
 */

import {
  ComponentConcept,
  EventConcept,
  StylingConcept,
  ConditionalConcept,
  IterationConcept,
  SlotConcept,
  AttributeConcept,
  ComponentMetadata
} from '../../src/concepts';

describe('Core Concept Interfaces', () => {
  describe('EventConcept', () => {
    it('should create a valid event concept', () => {
      const eventConcept: EventConcept = {
        nodeId: 'root.children[0]',
        name: 'click',
        handler: 'handleClick',
        modifiers: ['prevent', 'stop'],
        parameters: ['$event', 'index']
      };

      expect(eventConcept.nodeId).toBe('root.children[0]');
      expect(eventConcept.name).toBe('click');
      expect(eventConcept.handler).toBe('handleClick');
      expect(eventConcept.modifiers).toEqual(['prevent', 'stop']);
      expect(eventConcept.parameters).toEqual(['$event', 'index']);
    });

    it('should work with minimal event concept', () => {
      const eventConcept: EventConcept = {
        nodeId: 'root',
        name: 'submit',
        handler: 'onSubmit'
      };

      expect(eventConcept.nodeId).toBe('root');
      expect(eventConcept.name).toBe('submit');
      expect(eventConcept.handler).toBe('onSubmit');
      expect(eventConcept.modifiers).toBeUndefined();
      expect(eventConcept.parameters).toBeUndefined();
    });
  });

  describe('StylingConcept', () => {
    it('should create a valid styling concept', () => {
      const stylingConcept: StylingConcept = {
        nodeId: 'root.children[1]',
        staticClasses: ['button', 'button--primary'],
        dynamicClasses: ['isActive ? "active" : ""'],
        inlineStyles: { color: 'red', fontSize: '14px' },
        styleBindings: { background: 'props.bgColor' }
      };

      expect(stylingConcept.nodeId).toBe('root.children[1]');
      expect(stylingConcept.staticClasses).toEqual(['button', 'button--primary']);
      expect(stylingConcept.dynamicClasses).toEqual(['isActive ? "active" : ""']);
      expect(stylingConcept.inlineStyles).toEqual({ color: 'red', fontSize: '14px' });
      expect(stylingConcept.styleBindings).toEqual({ background: 'props.bgColor' });
    });

    it('should work with empty styling concept', () => {
      const stylingConcept: StylingConcept = {
        nodeId: 'root',
        staticClasses: [],
        dynamicClasses: [],
        inlineStyles: {}
      };

      expect(stylingConcept.staticClasses).toEqual([]);
      expect(stylingConcept.dynamicClasses).toEqual([]);
      expect(stylingConcept.inlineStyles).toEqual({});
    });
  });

  describe('ConditionalConcept', () => {
    it('should create a valid conditional concept', () => {
      const conditionalConcept: ConditionalConcept = {
        nodeId: 'root.children[2]',
        condition: 'isVisible',
        thenNodes: [{ type: 'text', content: 'Visible content' }],
        elseNodes: [{ type: 'text', content: 'Hidden content' }]
      };

      expect(conditionalConcept.nodeId).toBe('root.children[2]');
      expect(conditionalConcept.condition).toBe('isVisible');
      expect(conditionalConcept.thenNodes).toHaveLength(1);
      expect(conditionalConcept.elseNodes).toHaveLength(1);
    });

    it('should work without else branch', () => {
      const conditionalConcept: ConditionalConcept = {
        nodeId: 'root.children[3]',
        condition: 'showElement',
        thenNodes: [{ type: 'element', tag: 'div', content: 'Content' }]
      };

      expect(conditionalConcept.elseNodes).toBeUndefined();
    });
  });

  describe('IterationConcept', () => {
    it('should create a valid iteration concept', () => {
      const iterationConcept: IterationConcept = {
        nodeId: 'root.children[4]',
        items: 'todos',
        itemVariable: 'todo',
        indexVariable: 'index',
        keyExpression: 'todo.id',
        childNodes: [{ type: 'element', tag: 'li', content: '{{ todo.title }}' }]
      };

      expect(iterationConcept.nodeId).toBe('root.children[4]');
      expect(iterationConcept.items).toBe('todos');
      expect(iterationConcept.itemVariable).toBe('todo');
      expect(iterationConcept.indexVariable).toBe('index');
      expect(iterationConcept.keyExpression).toBe('todo.id');
      expect(iterationConcept.childNodes).toHaveLength(1);
    });

    it('should work with minimal iteration concept', () => {
      const iterationConcept: IterationConcept = {
        nodeId: 'root.children[5]',
        items: 'items',
        itemVariable: 'item',
        childNodes: []
      };

      expect(iterationConcept.indexVariable).toBeUndefined();
      expect(iterationConcept.keyExpression).toBeUndefined();
    });
  });

  describe('SlotConcept', () => {
    it('should create a valid slot concept', () => {
      const slotConcept: SlotConcept = {
        nodeId: 'root.children[6]',
        name: 'header',
        fallback: [{ type: 'text', content: 'Default header' }]
      };

      expect(slotConcept.nodeId).toBe('root.children[6]');
      expect(slotConcept.name).toBe('header');
      expect(slotConcept.fallback).toHaveLength(1);
    });

    it('should work without fallback content', () => {
      const slotConcept: SlotConcept = {
        nodeId: 'root.children[7]',
        name: 'default'
      };

      expect(slotConcept.fallback).toBeUndefined();
    });
  });

  describe('AttributeConcept', () => {
    it('should create a valid attribute concept', () => {
      const attributeConcept: AttributeConcept = {
        nodeId: 'root.children[8]',
        name: 'href',
        value: '/home',
        isExpression: false
      };

      expect(attributeConcept.nodeId).toBe('root.children[8]');
      expect(attributeConcept.name).toBe('href');
      expect(attributeConcept.value).toBe('/home');
      expect(attributeConcept.isExpression).toBe(false);
    });

    it('should work with boolean value', () => {
      const attributeConcept: AttributeConcept = {
        nodeId: 'root.children[9]',
        name: 'disabled',
        value: true,
        isExpression: false
      };

      expect(attributeConcept.value).toBe(true);
    });

    it('should work with expression value', () => {
      const attributeConcept: AttributeConcept = {
        nodeId: 'root.children[10]',
        name: 'data-id',
        value: 'user.id',
        isExpression: true
      };

      expect(attributeConcept.value).toBe('user.id');
      expect(attributeConcept.isExpression).toBe(true);
    });
  });

  describe('ComponentConcept', () => {
    it('should create a complete component concept', () => {
      const componentConcept: ComponentConcept = {
        events: [{
          nodeId: 'root.children[0]',
          name: 'click',
          handler: 'handleClick'
        }],
        styling: {
          nodeId: 'root',
          staticClasses: ['component'],
          dynamicClasses: [],
          inlineStyles: {}
        },
        conditionals: [{
          nodeId: 'root.children[1]',
          condition: 'isVisible',
          thenNodes: []
        }],
        iterations: [{
          nodeId: 'root.children[2]',
          items: 'items',
          itemVariable: 'item',
          childNodes: []
        }],
        slots: [{
          nodeId: 'root.children[3]',
          name: 'default'
        }],
        attributes: [{
          nodeId: 'root.children[4]',
          name: 'id',
          value: 'component-id',
          isExpression: false
        }],
        metadata: {
          name: 'TestComponent',
          props: { title: 'string' }
        }
      };

      expect(componentConcept.events).toHaveLength(1);
      expect(componentConcept.conditionals).toHaveLength(1);
      expect(componentConcept.iterations).toHaveLength(1);
      expect(componentConcept.slots).toHaveLength(1);
      expect(componentConcept.attributes).toHaveLength(1);
      expect(componentConcept.metadata.name).toBe('TestComponent');
    });

    it('should work with empty component concept', () => {
      const componentConcept: ComponentConcept = {
        events: [],
        styling: {
          nodeId: 'root',
          staticClasses: [],
          dynamicClasses: [],
          inlineStyles: {}
        },
        conditionals: [],
        iterations: [],
        slots: [],
        attributes: [],
        metadata: {}
      };

      expect(componentConcept.events).toEqual([]);
      expect(componentConcept.conditionals).toEqual([]);
      expect(componentConcept.iterations).toEqual([]);
      expect(componentConcept.slots).toEqual([]);
      expect(componentConcept.attributes).toEqual([]);
    });
  });

  describe('ComponentMetadata', () => {
    it('should create component metadata with all fields', () => {
      const metadata: ComponentMetadata = {
        name: 'UserProfile',
        props: {
          user: 'User',
          isEditing: 'boolean'
        },
        imports: ['import { User } from "./types"'],
        customField: 'custom value'
      };

      expect(metadata.name).toBe('UserProfile');
      expect(metadata.props).toEqual({
        user: 'User',
        isEditing: 'boolean'
      });
      expect(metadata.imports).toEqual(['import { User } from "./types"']);
      expect(metadata.customField).toBe('custom value');
    });

    it('should work with minimal metadata', () => {
      const metadata: ComponentMetadata = {};

      expect(metadata.name).toBeUndefined();
      expect(metadata.props).toBeUndefined();
      expect(metadata.imports).toBeUndefined();
    });
  });
});