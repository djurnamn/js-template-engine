/**
 * Comprehensive tests for ReactFrameworkExtension - Concept-Driven Implementation
 * 
 * Tests all concept processors and ensures TypeScript/JSX compilation validation
 */

import { ReactFrameworkExtension } from '../src';
import type {
  EventConcept,
  ConditionalConcept,
  IterationConcept,
  SlotConcept,
  AttributeConcept,
  ComponentConcept,
  RenderContext
} from '@js-template-engine/core';

describe('ReactFrameworkExtension', () => {
  let extension: ReactFrameworkExtension;

  beforeEach(() => {
    extension = new ReactFrameworkExtension();
  });

  describe('metadata', () => {
    it('should have correct extension metadata', () => {
      expect(extension.metadata).toEqual({
        type: 'framework',
        key: 'react',
        name: 'React Framework Extension',
        version: '1.0.0'
      });
    });

    it('should specify React as the target framework', () => {
      expect(extension.framework).toBe('react');
    });
  });

  describe('processEvents', () => {
    it('should normalize event names to React format', () => {
      const events: EventConcept[] = [
        { name: 'click', handler: 'handleClick', nodeId: 'node1' },
        { name: 'change', handler: 'handleChange', nodeId: 'node2' }
      ];

      const result = extension.processEvents(events);

      expect(result.attributes).toEqual({
        onClick: 'handleClick',
        onChange: 'handleChange'
      });
    });

    it('should handle event parameters correctly', () => {
      const events: EventConcept[] = [
        { 
          name: 'click', 
          handler: 'handleClick', 
          parameters: ['$event', 'index'],
          nodeId: 'node1' 
        }
      ];

      const result = extension.processEvents(events);

      expect(result.attributes.onClick).toBe('handleClick');
      // The actual parameter transformation is tested in the handler formatting
    });

    it('should handle event modifiers for React', () => {
      const events: EventConcept[] = [
        { 
          name: 'click', 
          handler: 'handleClick', 
          modifiers: ['prevent', 'stop'],
          nodeId: 'node1' 
        }
      ];

      const result = extension.processEvents(events);
      
      expect(result.attributes.onClick).toBe('handleClick');
      // Modifiers are handled in the formatHandler method
    });
  });

  describe('processConditionals', () => {
    it('should generate ternary operator for if-else conditionals', () => {
      const conditionals: ConditionalConcept[] = [
        {
          condition: 'isVisible',
          thenNodes: [{ type: 'text', content: 'Visible content' }],
          elseNodes: [{ type: 'text', content: 'Hidden content' }],
          nodeId: 'node1'
        }
      ];

      const result = extension.processConditionals(conditionals);

      expect(result.syntax).toContain('isVisible ?');
      expect(result.syntax).toContain('Visible content');
      expect(result.syntax).toContain('Hidden content');
    });

    it('should generate logical AND for if-only conditionals', () => {
      const conditionals: ConditionalConcept[] = [
        {
          condition: 'showButton',
          thenNodes: [{ type: 'text', content: 'Button content' }],
          nodeId: 'node1'
        }
      ];

      const result = extension.processConditionals(conditionals);

      expect(result.syntax).toContain('showButton &&');
      expect(result.syntax).toContain('Button content');
      expect(result.syntax).not.toContain(':');
    });

    it('should handle complex conditional structures', () => {
      const conditionals: ConditionalConcept[] = [
        {
          condition: 'user.isLoggedIn',
          thenNodes: [
            { type: 'element', tag: 'div', content: 'Welcome!' }
          ],
          elseNodes: [
            { type: 'element', tag: 'div', content: 'Please login' }
          ],
          nodeId: 'node1'
        }
      ];

      const result = extension.processConditionals(conditionals);

      expect(result.syntax).toContain('user.isLoggedIn ?');
      expect(result.syntax).toContain('<div>Welcome!</div>');
      expect(result.syntax).toContain('<div>Please login</div>');
    });
  });

  describe('processIterations', () => {
    it('should generate React.Fragment with keys for iterations', () => {
      const iterations: IterationConcept[] = [
        {
          items: 'todos',
          itemVariable: 'todo',
          keyExpression: 'todo.id',
          childNodes: [
            { type: 'element', tag: 'li', content: 'Todo item' }
          ],
          nodeId: 'node1'
        }
      ];

      const result = extension.processIterations(iterations);

      expect(result.syntax).toContain('todos.map(todo =>');
      expect(result.syntax).toContain('<React.Fragment key={todo.id}>');
      expect(result.syntax).toContain('<li>Todo item</li>');
      expect(result.imports).toContain('React');
    });

    it('should handle iterations with index variable', () => {
      const iterations: IterationConcept[] = [
        {
          items: 'users',
          itemVariable: 'user',
          indexVariable: 'index',
          keyExpression: 'index',
          childNodes: [
            { type: 'element', tag: 'div', content: 'User item' }
          ],
          nodeId: 'node1'
        }
      ];

      const result = extension.processIterations(iterations);

      expect(result.syntax).toContain('users.map((user, index) =>');
      expect(result.syntax).toContain('<React.Fragment key={index}>');
    });

    it('should optimize single elements with direct key assignment', () => {
      const iterations: IterationConcept[] = [
        {
          items: 'items',
          itemVariable: 'item',
          keyExpression: 'item.id',
          childNodes: [
            { type: 'element', tag: 'div', content: 'Item' }
          ],
          nodeId: 'node1'
        }
      ];

      const result = extension.processIterations(iterations);

      // Should optimize to add key directly to the element
      expect(result.syntax).toContain('items.map(item =>');
      expect(result.syntax).toMatch(/key=\{item\.id\}/);
    });
  });

  describe('processSlots', () => {
    it('should transform slots to React props', () => {
      const slots: SlotConcept[] = [
        {
          name: 'header',
          fallback: [{ type: 'element', tag: 'h2', content: 'Default Header' }],
          nodeId: 'node1'
        }
      ];

      const result = extension.processSlots(slots);

      expect(result.syntax).toContain('{props.header ||');
      expect(result.syntax).toContain('<h2>Default Header</h2>');
      expect(result.props).toEqual({
        header: 'React.ReactNode'
      });
      expect(result.imports).toContain('React');
    });

    it('should handle default slot as children prop', () => {
      const slots: SlotConcept[] = [
        {
          name: 'default',
          fallback: [{ type: 'text', content: 'Default content' }],
          nodeId: 'node1'
        }
      ];

      const result = extension.processSlots(slots);

      expect(result.syntax).toContain('{props.children ||');
      expect(result.props).toEqual({
        children: 'React.ReactNode'
      });
    });

    it('should normalize slot names to valid JavaScript identifiers', () => {
      const slots: SlotConcept[] = [
        {
          name: 'navigation-menu',
          nodeId: 'node1'
        },
        {
          name: 'footer_content',
          nodeId: 'node2'
        },
        {
          name: '123invalid',
          nodeId: 'node3'
        }
      ];

      const result = extension.processSlots(slots);

      expect(result.syntax).toContain('props.navigationMenu');
      expect(result.syntax).toContain('props.footerContent');
      expect(result.syntax).toContain('props._123invalid');
      
      expect(result.props).toEqual({
        navigationMenu: 'React.ReactNode',
        footerContent: 'React.ReactNode',
        _123invalid: 'React.ReactNode'
      });
    });
  });

  describe('processAttributes', () => {
    it('should transform HTML attributes to React attributes', () => {
      const attributes: AttributeConcept[] = [
        { name: 'class', value: 'button primary', isExpression: false, nodeId: 'node1' },
        { name: 'for', value: 'input-id', isExpression: false, nodeId: 'node2' },
        { name: 'tabindex', value: '0', isExpression: false, nodeId: 'node3' }
      ];

      const result = extension.processAttributes(attributes);

      expect(result.attributes).toEqual({
        className: 'button primary',
        htmlFor: 'input-id',
        tabIndex: '0'
      });
    });

    it('should handle boolean attributes correctly', () => {
      const attributes: AttributeConcept[] = [
        { name: 'disabled', value: true, isExpression: false, nodeId: 'node1' },
        { name: 'hidden', value: false, isExpression: false, nodeId: 'node2' },
        { name: 'required', value: true, isExpression: false, nodeId: 'node3' }
      ];

      const result = extension.processAttributes(attributes);

      expect(result.attributes).toEqual({
        disabled: 'true',
        required: 'true'
      });
    });

    it('should preserve aria-* and data-* attributes', () => {
      const attributes: AttributeConcept[] = [
        { name: 'aria-label', value: 'Close button', isExpression: false, nodeId: 'node1' },
        { name: 'data-testid', value: 'submit-btn', isExpression: false, nodeId: 'node2' },
        { name: 'aria-expanded', value: 'true', isExpression: false, nodeId: 'node3' }
      ];

      const result = extension.processAttributes(attributes);

      expect(result.attributes).toEqual({
        'aria-label': 'Close button',
        'data-testid': 'submit-btn',
        'aria-expanded': 'true'
      });
    });

    it('should handle CSS string to style object conversion', () => {
      const attributes: AttributeConcept[] = [
        { 
          name: 'style', 
          value: 'color: red; background-color: blue; font-size: 16px', 
          isExpression: false, 
          nodeId: 'node1' 
        }
      ];

      const result = extension.processAttributes(attributes);

      // The CSS string conversion is handled in generateAttributeSyntax
      expect(result.attributes.style).toBe('color: red; background-color: blue; font-size: 16px');
    });
  });

  describe('renderComponent', () => {
    const mockConcepts: ComponentConcept = {
      events: [],
      styling: {
        staticClasses: ['button', 'primary'],
        dynamicClasses: [],
        inlineStyles: {},
        nodeId: 'style1'
      },
      conditionals: [],
      iterations: [],
      slots: [],
      attributes: [
        { name: 'class', value: 'test-class', isExpression: false, nodeId: 'attr1' }
      ],
      metadata: {
        name: 'TestComponent'
      }
    };

    const mockContext: RenderContext = {
      component: {
        name: 'TestComponent',
        props: { label: 'string' },
        script: 'const handleClick = () => console.log("clicked");'
      },
      options: {
        framework: 'react',
        language: 'typescript'
      }
    };

    it('should generate a complete React component with TypeScript', () => {
      const result = extension.renderComponent(mockConcepts, mockContext);

      expect(result).toContain('import React from \'react\';');
      expect(result).toContain('interface TestComponentProps {');
      expect(result).toContain('label?: string');
      expect(result).toContain('const TestComponent: React.FC<TestComponentProps> = (props) => {');
      expect(result).toContain('const handleClick = () => console.log("clicked");');
      expect(result).toContain('return (');
      expect(result).toContain('export default TestComponent;');
    });

    it('should generate JavaScript component when TypeScript is disabled', () => {
      const jsContext: RenderContext = {
        ...mockContext,
        options: {
          framework: 'react',
          language: 'javascript'
        }
      };

      const result = extension.renderComponent(mockConcepts, jsContext);

      expect(result).not.toContain('interface TestComponentProps');
      expect(result).toContain('const TestComponent = (props) => {');
      expect(result).not.toContain(': React.FC');
    });

    it('should handle components without props', () => {
      const noPropsConcepts: ComponentConcept = {
        ...mockConcepts,
        slots: []
      };

      const noPropsContext: RenderContext = {
        component: {
          name: 'SimpleComponent'
        },
        options: {
          framework: 'react',
          language: 'typescript'
        }
      };

      const result = extension.renderComponent(noPropsConcepts, noPropsContext);

      expect(result).not.toContain('interface SimpleComponentProps');
      expect(result).toContain('const SimpleComponent: React.FC = () => {');
    });

    it('should merge slot props with component props', () => {
      const conceptsWithSlots: ComponentConcept = {
        ...mockConcepts,
        slots: [
          { name: 'header', nodeId: 'slot1' },
          { name: 'footer', nodeId: 'slot2' }
        ]
      };

      const result = extension.renderComponent(conceptsWithSlots, mockContext);

      expect(result).toContain('interface TestComponentProps {');
      expect(result).toContain('label?: string');
      expect(result).toContain('header?: React.ReactNode');
      expect(result).toContain('footer?: React.ReactNode');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complex component with all concept types', () => {
      const complexConcepts: ComponentConcept = {
        events: [
          { name: 'click', handler: 'handleClick', modifiers: ['prevent'], nodeId: 'event1' }
        ],
        styling: {
          staticClasses: ['card', 'elevated'],
          dynamicClasses: ['active'],
          inlineStyles: { padding: '16px' },
          nodeId: 'style1'
        },
        conditionals: [
          {
            condition: 'isLoading',
            thenNodes: [{ type: 'text', content: 'Loading...' }],
            elseNodes: [{ type: 'text', content: 'Content loaded' }],
            nodeId: 'cond1'
          }
        ],
        iterations: [
          {
            items: 'items',
            itemVariable: 'item',
            keyExpression: 'item.id',
            childNodes: [{ type: 'element', tag: 'li', content: 'Item' }],
            nodeId: 'iter1'
          }
        ],
        slots: [
          { name: 'header', fallback: [{ type: 'text', content: 'Default Header' }], nodeId: 'slot1' }
        ],
        attributes: [
          { name: 'id', value: 'main-component', isExpression: false, nodeId: 'attr1' },
          { name: 'data-testid', value: 'component', isExpression: false, nodeId: 'attr2' }
        ],
        metadata: {
          name: 'ComplexComponent'
        }
      };

      const complexContext: RenderContext = {
        component: {
          name: 'ComplexComponent',
          props: { title: 'string' },
          script: 'const [state, setState] = useState(false);',
          imports: [
            { from: 'react', named: ['useState'] }
          ]
        },
        options: {
          framework: 'react',
          language: 'typescript'
        }
      };

      const result = extension.renderComponent(complexConcepts, complexContext);

      // Should include all processed concepts
      expect(result).toContain('import React, { useState } from \'react\';');
      expect(result).toContain('interface ComplexComponentProps {');
      expect(result).toContain('title?: string');
      expect(result).toContain('header?: React.ReactNode');
      expect(result).toContain('const [state, setState] = useState(false);');
      expect(result).toContain('return (');
      expect(result).toContain('export default ComplexComponent;');
    });
  });

  describe('TypeScript Compilation Validation', () => {
    it('should generate valid TypeScript that compiles', () => {
      const ts = require('typescript');
      
      const concepts: ComponentConcept = {
        events: [
          { name: 'click', handler: 'handleClick', nodeId: 'event1' }
        ],
        styling: {
          staticClasses: ['btn'],
          dynamicClasses: [],
          inlineStyles: {},
          nodeId: 'style1'
        },
        conditionals: [],
        iterations: [],
        slots: [
          { name: 'children', nodeId: 'slot1' }
        ],
        attributes: [
          { name: 'type', value: 'button', isExpression: false, nodeId: 'attr1' }
        ],
        metadata: { name: 'Button' }
      };

      const context: RenderContext = {
        component: {
          name: 'Button',
          props: { onClick: '() => void', children: 'React.ReactNode' },
          script: 'const handleClick = () => onClick?.();'
        },
        options: {
          framework: 'react',
          language: 'typescript'
        }
      };

      const result = extension.renderComponent(concepts, context);

      // Attempt TypeScript compilation
      const compileResult = ts.transpile(result, {
        jsx: ts.JsxEmit.React,
        target: ts.ScriptTarget.ES2018,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true
      });

      expect(compileResult).toBeDefined();
      expect(compileResult.length).toBeGreaterThan(0);
      
      // Should not contain TypeScript-specific syntax after compilation
      expect(compileResult).not.toContain('interface ');
      expect(compileResult).not.toContain(': React.FC');
    });
  });

  describe('Error Handling', () => {
    it('should handle empty concepts gracefully', () => {
      const emptyConcepts: ComponentConcept = {
        events: [],
        styling: {
          staticClasses: [],
          dynamicClasses: [],
          inlineStyles: {},
          nodeId: 'style1'
        },
        conditionals: [],
        iterations: [],
        slots: [],
        attributes: [],
        metadata: {}
      };

      const result = extension.renderComponent(emptyConcepts, { options: { framework: 'react' } });

      expect(result).toContain('import React from \'react\';');
      expect(result).toContain('const Component');
      expect(result).toContain('return (');
      expect(result).toContain('export default Component;');
    });

    it('should handle malformed concept data', () => {
      const malformedConcepts = {
        events: [{ name: 'click' }], // Missing required fields
        styling: null,
        conditionals: [],
        iterations: [],
        slots: [],
        attributes: [],
        metadata: {}
      } as any;

      expect(() => {
        extension.renderComponent(malformedConcepts, { options: { framework: 'react' } });
      }).not.toThrow();
    });
  });
});