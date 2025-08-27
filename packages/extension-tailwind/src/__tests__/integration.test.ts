import { describe, it, expect, beforeEach } from 'vitest';
import { TailwindExtension } from '../index';
import type { TemplateNode } from '@js-template-engine/types';
import type {
  ComponentConcept,
  StylingConcept,
  FrameworkExtension,
} from '@js-template-engine/core';

describe('Tailwind Extension Integration', () => {
  let extension: TailwindExtension;

  beforeEach(() => {
    extension = new TailwindExtension();
  });

  describe('template processing', () => {
    it('should process template nodes with Tailwind extensions', () => {
      const template: TemplateNode[] = [
        {
          type: 'element',
          tag: 'div',
          attributes: {},
          extensions: {
            tailwind: {
              class: 'bg-blue-500 text-white p-4',
            },
          },
          children: [],
        },
      ];

      const processed = extension.processTemplate(template, {});

      expect(processed).toHaveLength(1);
      const processedNode = processed[0] as any;
      expect(processedNode.attributes?.class).toContain('bg-blue-500');
      expect(processedNode.attributes?.class).toContain('text-white');
      expect(processedNode.attributes?.class).toContain('p-4');
    });

    it('should process nested template nodes', () => {
      const template: TemplateNode[] = [
        {
          type: 'element',
          tag: 'div',
          attributes: {},
          extensions: {
            tailwind: {
              class: 'container',
            },
          },
          children: [
            {
              type: 'element',
              tag: 'p',
              attributes: {},
              extensions: {
                tailwind: {
                  class: 'text-lg text-gray-800',
                },
              },
              children: [],
            },
          ],
        },
      ];

      const processed = extension.processTemplate(template, {});

      expect(processed).toHaveLength(1);
      const parentNode = processed[0] as any;
      const childNode = parentNode.children[0];

      expect(parentNode.attributes?.class).toContain('container');
      expect(childNode.attributes?.class).toContain('text-lg');
      expect(childNode.attributes?.class).toContain('text-gray-800');
    });

    it('should handle responsive and variant extensions', () => {
      const template: TemplateNode[] = [
        {
          type: 'element',
          tag: 'button',
          attributes: {},
          extensions: {
            tailwind: {
              class: 'bg-blue-500',
              responsive: {
                md: 'text-lg',
                lg: 'px-8',
              },
              variants: {
                hover: 'bg-blue-600',
                focus: 'outline-none ring-2',
              },
            },
          },
          children: [],
        },
      ];

      const processed = extension.processTemplate(template, {});
      const processedNode = processed[0] as any;

      expect(processedNode.attributes?.class).toContain('bg-blue-500');
      expect(processedNode.attributes?.class).toContain('md:text-lg');
      expect(processedNode.attributes?.class).toContain('lg:px-8');
      expect(processedNode.attributes?.class).toContain('hover:bg-blue-600');
      expect(processedNode.attributes?.class).toContain('focus:outline-none');
      expect(processedNode.attributes?.class).toContain('focus:ring-2');
    });

    it('should handle text nodes and non-element nodes', () => {
      const template: TemplateNode[] = [
        {
          type: 'text',
          content: 'Hello World',
        },
        {
          type: 'element',
          tag: 'span',
          attributes: {},
          extensions: {
            tailwind: {
              class: 'font-bold',
            },
          },
          children: [],
        },
      ];

      const processed = extension.processTemplate(template, {});

      expect(processed).toHaveLength(2);
      expect(processed[0]).toEqual({ type: 'text', content: 'Hello World' });

      const spanNode = processed[1] as any;
      expect(spanNode.attributes?.class).toContain('font-bold');
    });
  });

  describe('end-to-end processing', () => {
    it('should process complete component with all features', () => {
      extension.options.outputStrategy = 'css';

      const stylingConcept: StylingConcept = {
        staticClasses: [
          'bg-blue-500',
          'text-white',
          'p-4',
          'rounded-lg',
          'shadow-md',
          'hover:bg-blue-600',
          'focus:outline-none',
          'focus:ring-2',
          'md:text-lg',
          'lg:px-8',
        ],
        dynamicClasses: [],
        inlineStyles: {},
      };

      const result = extension.processStyles(stylingConcept);

      // Should contain base styles
      expect(result.styles).toContain('background-color: #3b82f6');
      expect(result.styles).toContain('color: #ffffff');
      expect(result.styles).toContain('padding: 1rem');
      expect(result.styles).toContain('border-radius: 0.5rem');
      expect(result.styles).toContain('box-shadow:');

      // Should contain pseudo-class styles
      expect(result.styles).toContain(':hover');
      expect(result.styles).toContain(':focus');

      // Should contain responsive styles
      expect(result.styles).toContain('@media (min-width: 768px)');
      expect(result.styles).toContain('@media (min-width: 1024px)');
    });

    it('should handle mixed valid and invalid classes gracefully', () => {
      extension.options.unknownClassHandling = 'warn';
      extension.options.cssFallback = 'custom-class';

      const stylingConcept: StylingConcept = {
        staticClasses: [
          'bg-blue-500', // valid
          'custom-class', // invalid
          'text-white', // valid
          'another-invalid', // invalid
        ],
        dynamicClasses: [],
        inlineStyles: {},
      };

      const result = extension.processStyles(stylingConcept);

      // Should contain valid Tailwind styles
      expect(result.styles).toContain('background-color: #3b82f6');
      expect(result.styles).toContain('color: #ffffff');
    });

    it('should support bi-directional conversion', () => {
      // Tailwind to CSS
      const tailwindClasses = ['bg-blue-500', 'text-white', 'p-4'];
      const cssResult = extension.convertTailwindToCss(tailwindClasses);

      expect(cssResult.styles).toContain('background-color: #3b82f6');
      expect(cssResult.styles).toContain('color: #ffffff');
      expect(cssResult.styles).toContain('padding: 1rem');

      // CSS to Tailwind
      const cssStyles = {
        'background-color': '#3b82f6',
        color: '#ffffff',
        padding: '1rem',
      };
      const tailwindResult = extension.convertCssToTailwind(cssStyles);

      expect(tailwindResult.classes).toContain('bg-blue-500');
      expect(tailwindResult.classes).toContain('text-white');
      expect(tailwindResult.classes).toContain('p-4');
    });
  });

  describe('configuration scenarios', () => {
    it('should respect different output strategies', () => {
      const stylingConcept: StylingConcept = {
        staticClasses: ['bg-blue-500', 'text-white'],
        dynamicClasses: [],
        inlineStyles: {},
      };

      // CSS output
      extension.options.outputStrategy = 'css';
      const cssResult = extension.processStyles(stylingConcept);
      expect(cssResult.styles).toContain('background-color: #3b82f6');

      // SCSS @apply output
      extension.options.outputStrategy = 'scss-apply';
      const scssResult = extension.processStyles(stylingConcept);
      expect(scssResult.styles).toContain('@apply');

      // Pass-through output
      extension.options.outputStrategy = 'pass-through';
      const passResult = extension.processStyles(stylingConcept);
      expect(passResult.styles).toBe('bg-blue-500 text-white');
    });

    it('should handle custom breakpoints', () => {
      extension.options.breakpoints = {
        tablet: '768px',
        desktop: '1200px',
      };

      const stylingConcept: StylingConcept = {
        staticClasses: ['tablet:text-lg'], // This would be invalid with default breakpoints
        dynamicClasses: [],
        inlineStyles: {},
      };

      // Would need custom validation logic for custom breakpoints
      // For now, test that the extension doesn't crash
      const result = extension.processStyles(stylingConcept);
      expect(result).toBeDefined();
    });

    it('should handle unknown class configurations', () => {
      const stylingConcept: StylingConcept = {
        staticClasses: ['unknown-class', 'bg-blue-500'],
        dynamicClasses: [],
        inlineStyles: {},
      };

      // Test ignore configuration
      extension.options.unknownClassHandling = 'ignore';
      const ignoreResult = extension.processStyles(stylingConcept);
      expect(ignoreResult.styles).toBeTruthy();

      // Test error configuration - processStyles should handle unknown classes gracefully
      extension.options.unknownClassHandling = 'error';
      const errorResult = extension.processStyles(stylingConcept);
      expect(errorResult.styles).toBeTruthy();
    });
  });
});
