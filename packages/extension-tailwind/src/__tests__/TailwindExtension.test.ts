import { describe, it, expect, beforeEach } from 'vitest';
import { TailwindExtension } from '../index';
import type {
  TailwindExtensionOptions,
  TailwindNodeExtensions,
} from '../types';
import type {
  StylingConcept,
  ComponentConcept,
  FrameworkExtension,
} from '@js-template-engine/core';

describe('TailwindExtension', () => {
  let extension: TailwindExtension;

  beforeEach(() => {
    extension = new TailwindExtension();
  });

  describe('metadata', () => {
    it('should have correct extension metadata', () => {
      expect(extension.metadata.type).toBe('styling');
      expect(extension.metadata.key).toBe('tailwind');
      expect(extension.metadata.name).toBe('Tailwind Extension');
      expect(extension.metadata.version).toBe('2.0.0');
    });

    it('should have correct styling property', () => {
      expect(extension.styling).toBe('tailwind');
    });

    it('should have correct key property', () => {
      expect(extension.key).toBe('tailwind');
    });
  });

  describe('processStyles', () => {
    it('should convert Tailwind classes to CSS', () => {
      const stylingConcept: StylingConcept = {
        staticClasses: ['bg-blue-500', 'text-white', 'p-4'],
        dynamicClasses: [],
        inlineStyles: {},
      };

      const result = extension.processStyles(stylingConcept);
      expect(result.styles).toContain('background-color: #3b82f6');
      expect(result.styles).toContain('color: #ffffff');
      expect(result.styles).toContain('padding: 1rem');
    });

    it('should handle responsive breakpoints', () => {
      const stylingConcept: StylingConcept = {
        staticClasses: ['md:text-lg', 'lg:px-4'],
        dynamicClasses: [],
        inlineStyles: {},
      };

      const result = extension.processStyles(stylingConcept);
      expect(result.styles).toContain('@media (min-width: 768px)');
      expect(result.styles).toContain('@media (min-width: 1024px)');
    });

    it('should handle pseudo-class variants', () => {
      const stylingConcept: StylingConcept = {
        staticClasses: ['hover:bg-red-500', 'focus:ring-2'],
        dynamicClasses: [],
        inlineStyles: {},
      };

      const result = extension.processStyles(stylingConcept);
      expect(result.styles).toContain(':hover');
      expect(result.styles).toContain(':focus');
    });

    it('should return empty styles for non-Tailwind classes', () => {
      const stylingConcept: StylingConcept = {
        staticClasses: ['custom-class', 'another-class'],
        dynamicClasses: [],
        inlineStyles: {},
      };

      const result = extension.processStyles(stylingConcept);
      expect(result.styles).toBe('');
    });

    it('should handle SCSS @apply output strategy', () => {
      extension.options.outputStrategy = 'scss-apply';

      const stylingConcept: StylingConcept = {
        staticClasses: ['bg-blue-500', 'text-white'],
        dynamicClasses: [],
        inlineStyles: {},
      };

      const result = extension.processStyles(stylingConcept);
      expect(result.styles).toContain('@apply');
    });

    it('should handle pass-through output strategy', () => {
      extension.options.outputStrategy = 'pass-through';

      const stylingConcept: StylingConcept = {
        staticClasses: ['bg-blue-500', 'text-white'],
        dynamicClasses: [],
        inlineStyles: {},
      };

      const result = extension.processStyles(stylingConcept);
      expect(result.styles).toBe('bg-blue-500 text-white');
    });
  });

  describe('convertTailwindToCss', () => {
    it('should convert basic utility classes', () => {
      const result = extension.convertTailwindToCss([
        'bg-blue-500',
        'text-white',
      ]);
      expect(result.styles).toContain('background-color: #3b82f6');
      expect(result.styles).toContain('color: #ffffff');
    });

    it('should convert spacing utilities', () => {
      const result = extension.convertTailwindToCss(['p-4', 'm-2', 'px-6']);
      expect(result.styles).toContain('padding: 1rem');
      expect(result.styles).toContain('margin: 0.5rem');
      expect(result.styles).toContain('padding-left: 1.5rem');
      expect(result.styles).toContain('padding-right: 1.5rem');
    });

    it('should convert layout utilities', () => {
      const result = extension.convertTailwindToCss(['flex', 'w-full', 'h-64']);
      expect(result.styles).toContain('display: flex');
      expect(result.styles).toContain('width: 100%');
      expect(result.styles).toContain('height: 16rem');
    });

    it('should handle responsive utilities with media queries', () => {
      const result = extension.convertTailwindToCss(['md:text-lg', 'lg:flex']);
      expect(result.styles).toContain('@media (min-width: 768px)');
      expect(result.styles).toContain('@media (min-width: 1024px)');
    });

    it('should handle pseudo-class variants', () => {
      const result = extension.convertTailwindToCss([
        'hover:bg-red-500',
        'focus:outline-none',
      ]);
      expect(result.styles).toContain(':hover');
      expect(result.styles).toContain(':focus');
    });
  });

  describe('convertCssToTailwind', () => {
    it('should convert CSS to Tailwind classes', () => {
      const cssStyles = {
        'background-color': '#3b82f6',
        color: '#ffffff',
        padding: '1rem',
      };

      const result = extension.convertCssToTailwind(cssStyles);
      expect(result.classes).toContain('bg-blue-500');
      expect(result.classes).toContain('text-white');
      expect(result.classes).toContain('p-4');
      expect(Object.keys(result.remaining)).toHaveLength(0);
    });

    it('should handle conversion fallbacks', () => {
      const cssStyles = {
        'background-color': '#123456', // Unknown color
        padding: '1rem',
        'custom-property': 'custom-value', // Unknown property
      };

      const result = extension.convertCssToTailwind(cssStyles);
      expect(result.classes).toContain('p-4');
      expect(result.remaining['background-color']).toBe('#123456');
      expect(result.remaining['custom-property']).toBe('custom-value');
    });

    it('should convert display properties', () => {
      const cssStyles = {
        display: 'flex',
        display2: 'block',
        display3: 'none',
      };

      const result = extension.convertCssToTailwind({
        display: 'flex',
      });
      expect(result.classes).toContain('flex');

      const result2 = extension.convertCssToTailwind({
        display: 'block',
      });
      expect(result2.classes).toContain('block');

      const result3 = extension.convertCssToTailwind({
        display: 'none',
      });
      expect(result3.classes).toContain('hidden');
    });
  });

  describe('options and configuration', () => {
    it('should have default options', () => {
      expect(extension.options.outputStrategy).toBe('css');
      expect(extension.options.unknownClassHandling).toBe('warn');
      expect(extension.options.cssFallback).toBe('custom-class');
      expect(extension.options.customClassPrefix).toBe('custom');
    });

    it('should allow custom configuration', () => {
      const customExtension = new TailwindExtension();
      customExtension.options = {
        outputStrategy: 'scss-apply',
        unknownClassHandling: 'error',
        cssFallback: 'inline',
        customClassPrefix: 'my-custom',
        breakpoints: {
          tablet: '768px',
          desktop: '1024px',
        },
      };

      expect(customExtension.options.outputStrategy).toBe('scss-apply');
      expect(customExtension.options.unknownClassHandling).toBe('error');
    });
  });

  describe('utility validation', () => {
    it('should validate known Tailwind utilities', () => {
      const validClasses = [
        'bg-blue-500',
        'text-white',
        'p-4',
        'flex',
        'hidden',
      ];

      for (const className of validClasses) {
        const stylingConcept: StylingConcept = {
          staticClasses: [className],
          dynamicClasses: [],
          inlineStyles: {},
        };

        const result = extension.processStyles(stylingConcept);
        expect(result.styles).not.toBe('');
      }
    });

    it('should handle complex responsive and variant combinations', () => {
      const complexClass = 'lg:hover:bg-red-500';
      const stylingConcept: StylingConcept = {
        staticClasses: [complexClass],
        dynamicClasses: [],
        inlineStyles: {},
      };

      const result = extension.processStyles(stylingConcept);
      expect(result.styles).toContain('@media (min-width: 1024px)');
      expect(result.styles).toContain(':hover');
    });
  });

  describe('edge cases', () => {
    it('should handle empty class arrays', () => {
      const stylingConcept: StylingConcept = {
        staticClasses: [],
        dynamicClasses: [],
        inlineStyles: {},
      };

      const result = extension.processStyles(stylingConcept);
      expect(result.styles).toBe('');
      expect(result.imports).toEqual([]);
    });

    it('should handle whitespace in class strings', () => {
      const result = extension.convertTailwindToCss([
        '  bg-blue-500  ',
        '  text-white  ',
      ]);
      expect(result.styles).toContain('background-color: #3b82f6');
      expect(result.styles).toContain('color: #ffffff');
    });

    it('should handle duplicate classes', () => {
      const result = extension.convertTailwindToCss([
        'bg-blue-500',
        'bg-blue-500',
        'text-white',
      ]);
      expect(result.styles).toContain('background-color: #3b82f6');
      expect(result.styles).toContain('color: #ffffff');
    });

    it('should handle mixed valid and invalid classes', () => {
      extension.options.unknownClassHandling = 'ignore';

      const stylingConcept: StylingConcept = {
        staticClasses: [
          'bg-blue-500',
          'invalid-class',
          'text-white',
          'another-invalid',
        ],
        dynamicClasses: [],
        inlineStyles: {},
      };

      const result = extension.processStyles(stylingConcept);
      expect(result.styles).toContain('background-color: #3b82f6');
      expect(result.styles).toContain('color: #ffffff');
      expect(result.styles).not.toContain('invalid-class');
    });
  });
});
