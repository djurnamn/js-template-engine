import { describe, it, expect, beforeEach } from 'vitest';
import { BemExtension } from '../src/index';
import { ReactFrameworkExtension } from '@js-template-engine/extension-react';
import { VueFrameworkExtension } from '@js-template-engine/extension-vue';
import { SvelteFrameworkExtension } from '@js-template-engine/extension-svelte';
import type { StylingConcept, ComponentConcept } from '@js-template-engine/core';

describe('BemExtension', () => {
  let bemExtension: BemExtension;
  let mockComponentConcept: ComponentConcept;

  beforeEach(() => {
    bemExtension = new BemExtension(false);
    mockComponentConcept = {
      events: [],
      styling: {
        nodeId: 'test-node',
        staticClasses: ['button', 'button__icon'],
        dynamicClasses: [],
        inlineStyles: {}
      },
      conditionals: [],
      iterations: [],
      slots: [],
      attributes: [],
      metadata: {}
    };
  });

  describe('StylingExtension interface implementation', () => {
    it('should implement the correct metadata', () => {
      expect(bemExtension.metadata.type).toBe('styling');
      expect(bemExtension.metadata.key).toBe('bem');
      expect(bemExtension.metadata.name).toBe('BEM Extension');
      expect(bemExtension.metadata.version).toBe('1.0.0');
      expect(bemExtension.styling).toBe('bem');
    });

    it('should process styling concepts correctly', () => {
      const stylingConcept: StylingConcept = {
        nodeId: 'test-node',
        staticClasses: ['button', 'button__icon', 'button--active'],
        dynamicClasses: [],
        inlineStyles: {}
      };

      const result = bemExtension.processStyles(stylingConcept);
      
      expect(result.styles).toBeTruthy();
      expect(result.imports).toEqual([]);
      expect(result.styles).toContain('.button {');
      expect(result.styles).toContain('&__icon');
      expect(result.styles).toContain('&--active');
    });

    it('should handle non-BEM classes gracefully', () => {
      const stylingConcept: StylingConcept = {
        nodeId: 'test-node',
        staticClasses: ['regular-class', 'another-class'],
        dynamicClasses: [],
        inlineStyles: {}
      };

      const result = bemExtension.processStyles(stylingConcept);
      
      // These are valid BEM blocks (single name), so they should generate SCSS
      expect(result.styles).toContain('.regular-class {');
      expect(result.styles).toContain('.another-class {');
      expect(result.imports).toEqual([]);
    });
  });

  describe('Framework coordination', () => {

    it('should coordinate with React extension', () => {
      const reactExtension = new ReactFrameworkExtension();
      
      const result = bemExtension.coordinateWithFramework(reactExtension, mockComponentConcept);
      
      expect(result.styling.staticClasses).toContain('button');
      expect(result.styling.staticClasses).toContain('button__icon');
      expect(result.styling.staticClasses.length).toBeGreaterThanOrEqual(2);
    });

    it('should coordinate with Vue extension', () => {
      const vueExtension = new VueFrameworkExtension();
      
      const result = bemExtension.coordinateWithFramework(vueExtension, mockComponentConcept);
      
      expect(result.styling.staticClasses).toContain('button');
      expect(result.styling.staticClasses).toContain('button__icon');
      expect(result.styling.staticClasses.length).toBeGreaterThanOrEqual(2);
    });

    it('should coordinate with Svelte extension', () => {
      const svelteExtension = new SvelteFrameworkExtension();
      
      const result = bemExtension.coordinateWithFramework(svelteExtension, mockComponentConcept);
      
      expect(result.styling.staticClasses).toContain('button');
      expect(result.styling.staticClasses).toContain('button__icon');
      expect(result.styling.staticClasses.length).toBeGreaterThanOrEqual(2);
    });

    it('should preserve existing styling concepts', () => {
      const conceptWithModifiers: ComponentConcept = {
        ...mockComponentConcept,
        styling: {
          nodeId: 'test-node',
          staticClasses: ['existing-class', 'button__element--modifier'],
          dynamicClasses: ['dynamic-class'],
          inlineStyles: { color: 'red' }
        }
      };

      const reactExtension = new ReactFrameworkExtension();
      const result = bemExtension.coordinateWithFramework(reactExtension, conceptWithModifiers);
      
      expect(result.styling.staticClasses).toContain('existing-class');
      expect(result.styling.staticClasses).toContain('button__element--modifier');
      expect(result.styling.dynamicClasses).toEqual(['dynamic-class']);
      expect(result.styling.inlineStyles).toEqual({ color: 'red' });
    });
  });

  describe('BEM class generation', () => {
    it('should generate BEM classes for valid block__element--modifier patterns', () => {
      const stylingConcept: StylingConcept = {
        nodeId: 'test',
        staticClasses: [
          'block',
          'block__element',
          'block--modifier',
          'block__element--modifier',
          'another-block__different-element--state'
        ],
        dynamicClasses: [],
        inlineStyles: {}
      };

      const result = bemExtension.processStyles(stylingConcept);
      
      expect(result.styles).toContain('.block {');
      expect(result.styles).toContain('.another-block {');
      expect(result.styles).toContain('&__element');
      expect(result.styles).toContain('&__different-element');
      expect(result.styles).toContain('&--modifier');
      expect(result.styles).toContain('&--state');
    });

    it('should ignore invalid BEM patterns', () => {
      const stylingConcept: StylingConcept = {
        nodeId: 'test',
        staticClasses: [
          'invalid__',     // Ends with __
          '--invalid',     // Starts with --
          'block___invalid', // Triple underscores
          'block---invalid', // Triple hyphens  
          '123invalid'     // Starts with number
        ],
        dynamicClasses: [],
        inlineStyles: {}
      };

      const result = bemExtension.processStyles(stylingConcept);
      
      // All classes are invalid BEM patterns, so no SCSS should be generated
      expect(result.styles).toBe('');
    });
  });

  describe('SCSS generation', () => {
    it('should generate nested SCSS for BEM hierarchy', () => {
      const stylingConcept: StylingConcept = {
        nodeId: 'test',
        staticClasses: [
          'card',
          'card__header',
          'card__body',
          'card__footer',
          'card--large',
          'card__header--highlighted'
        ],
        dynamicClasses: [],
        inlineStyles: {}
      };

      const result = bemExtension.processStyles(stylingConcept);
      
      expect(result.styles).toContain('.card {');
      expect(result.styles).toContain('&__header {');
      expect(result.styles).toContain('&__body {');
      expect(result.styles).toContain('&__footer {');
      expect(result.styles).toContain('&--large {');
      expect(result.styles).toContain('/* Add your styling here */');
    });

    it('should handle multiple blocks separately', () => {
      const stylingConcept: StylingConcept = {
        nodeId: 'test',
        staticClasses: [
          'header',
          'header__logo',
          'footer',
          'footer__link'
        ],
        dynamicClasses: [],
        inlineStyles: {}
      };

      const result = bemExtension.processStyles(stylingConcept);
      
      expect(result.styles).toContain('.header {');
      expect(result.styles).toContain('.footer {');
      const blocks = result.styles.split('.').filter(line => line.includes(' {'));
      expect(blocks.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Existing BEM functionality preservation', () => {
    it('should generate BEM classes correctly', () => {
      const node = {
        type: 'element' as const,
        tag: 'button',
        attributes: {},
        extensions: {
          bem: {
            block: 'button',
            element: 'icon',
            modifiers: ['active', 'large']
          }
        }
      };

      bemExtension.onNodeVisit(node, []);
      
      expect(node.attributes.class).toContain('button__icon');
      expect(node.attributes.class).toContain('button__icon--active');
      expect(node.attributes.class).toContain('button__icon--large');
    });

    it('should work with legacy BEM configuration', () => {
      const node = {
        type: 'element' as const,
        tag: 'div',
        attributes: {},
        extensions: {
          bem: {
            block: 'card',
            modifier: 'highlighted'
          }
        }
      };

      bemExtension.onNodeVisit(node, []);
      
      expect(node.attributes.class).toContain('card');
      expect(node.attributes.class).toContain('card--highlighted');
    });

    it('should inherit block from ancestor nodes', () => {
      const parentNode = {
        type: 'element' as const,
        tag: 'div',
        attributes: {},
        extensions: {
          bem: {
            block: 'card'
          }
        }
      };

      const childNode = {
        type: 'element' as const,
        tag: 'h2',
        attributes: {},
        extensions: {
          bem: {
            element: 'title'
          }
        }
      };

      bemExtension.onNodeVisit(childNode, [parentNode]);
      
      expect(childNode.attributes.class).toContain('card__title');
    });
  });

  describe('Template processing', () => {
    it('should extract styling concepts from template', () => {
      const template = [
        {
          type: 'element' as const,
          tag: 'div',
          attributes: {
            class: 'button button__icon button--active',
            style: 'color: red; background: blue'
          },
          children: []
        }
      ];

      const context = {
        component: {},
        options: {},
        concepts: mockComponentConcept
      };

      const result = bemExtension.processTemplate(template, context);
      
      expect(result.concepts).toBeDefined();
      expect(result.metadata.bemClasses).toContain('button');
      expect(result.metadata.bemClasses).toContain('button__icon');
      expect(result.metadata.bemClasses).toContain('button--active');
      expect(result.metadata.scssOutput).toContain('.button {');
    });
  });
});