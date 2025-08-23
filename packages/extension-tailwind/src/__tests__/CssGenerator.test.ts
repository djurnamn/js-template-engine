import { describe, it, expect, beforeEach } from 'vitest';
import { CssGenerator } from '../generators/CssGenerator';
import { UtilityParser } from '../parsers/UtilityParser';
import type { ParsedUtility } from '../types';

describe('CssGenerator', () => {
  let generator: CssGenerator;
  let parser: UtilityParser;

  beforeEach(() => {
    generator = new CssGenerator();
    parser = new UtilityParser();
  });

  describe('generateCssFromUtilities', () => {
    it('should generate CSS from basic utilities', () => {
      const utilities = parser.parseUtilities(['bg-blue-500', 'text-white', 'p-4']);
      const result = generator.generateCssFromUtilities(utilities, { format: 'css' });
      
      expect(result.styles).toContain('background-color: #3b82f6');
      expect(result.styles).toContain('color: #ffffff');
      expect(result.styles).toContain('padding: 1rem');
    });

    it('should generate CSS with proper class selectors', () => {
      const utilities = parser.parseUtilities(['bg-blue-500']);
      const result = generator.generateCssFromUtilities(utilities, { 
        format: 'css',
        classPrefix: 'my-component'
      });
      
      expect(result.styles).toContain('.my-component {');
      expect(result.styles).toContain('background-color: #3b82f6');
    });

    it('should handle responsive utilities with media queries', () => {
      const utilities = parser.parseUtilities(['md:text-lg', 'lg:px-4']);
      const result = generator.generateCssFromUtilities(utilities, { format: 'css' });
      
      expect(result.styles).toContain('@media (min-width: 768px)');
      expect(result.styles).toContain('@media (min-width: 1024px)');
      expect(result.styles).toContain('font-size: 1.125rem');
      expect(result.styles).toContain('padding-left: 1rem');
      expect(result.styles).toContain('padding-right: 1rem');
    });

    it('should handle pseudo-class variants', () => {
      const utilities = parser.parseUtilities(['hover:bg-red-500', 'focus:outline-none']);
      const result = generator.generateCssFromUtilities(utilities, { format: 'css' });
      
      expect(result.styles).toContain(':hover');
      expect(result.styles).toContain(':focus');
      expect(result.styles).toContain('background-color: #ef4444');
    });

    it('should use custom breakpoints when provided', () => {
      const utilities = parser.parseUtilities(['md:text-lg']);
      const customBreakpoints = { md: '900px' };
      const result = generator.generateCssFromUtilities(utilities, { 
        format: 'css',
        breakpoints: customBreakpoints
      });
      
      expect(result.styles).toContain('@media (min-width: 900px)');
    });
  });

  describe('generateScssWithApply', () => {
    it('should generate SCSS with @apply directives', () => {
      const utilities = parser.parseUtilities(['bg-blue-500', 'text-white', 'p-4']);
      const result = generator.generateScssWithApply(utilities);
      
      expect(result.styles).toContain('@apply bg-blue-500 text-white p-4;');
    });

    it('should separate base styles from variants', () => {
      const utilities = parser.parseUtilities(['bg-blue-500', 'hover:bg-red-500', 'p-4']);
      const result = generator.generateScssWithApply(utilities);
      
      expect(result.styles).toContain('@apply bg-blue-500 p-4;');
      expect(result.styles).toContain('&:hover {');
      expect(result.styles).toContain('@apply hover:bg-red-500;');
    });

    it('should handle responsive utilities with media queries', () => {
      const utilities = parser.parseUtilities(['bg-blue-500', 'md:text-lg']);
      const result = generator.generateScssWithApply(utilities);
      
      expect(result.styles).toContain('@apply bg-blue-500;');
      expect(result.styles).toContain('@media (min-width: 768px)');
      expect(result.styles).toContain('@apply md:text-lg;');
    });

    it('should handle complex combinations', () => {
      const utilities = parser.parseUtilities([
        'bg-blue-500', 
        'hover:bg-red-500', 
        'focus:bg-green-500',
        'md:text-lg',
        'lg:p-8'
      ]);
      const result = generator.generateScssWithApply(utilities);
      
      expect(result.styles).toContain('@apply bg-blue-500;');
      expect(result.styles).toContain('&:hover {');
      expect(result.styles).toContain('&:focus {');
      expect(result.styles).toContain('@media (min-width: 768px)');
      expect(result.styles).toContain('@media (min-width: 1024px)');
    });
  });

  describe('pass-through format', () => {
    it('should return original class names for pass-through', () => {
      const utilities = parser.parseUtilities(['bg-blue-500', 'text-white', 'p-4']);
      const result = generator.generateCssFromUtilities(utilities, { format: 'pass-through' });
      
      expect(result.styles).toBe('bg-blue-500 text-white p-4');
    });

    it('should preserve complex class names in pass-through', () => {
      const utilities = parser.parseUtilities(['hover:bg-red-500', 'lg:text-xl', 'focus:outline-none']);
      const result = generator.generateCssFromUtilities(utilities, { format: 'pass-through' });
      
      expect(result.styles).toBe('hover:bg-red-500 lg:text-xl focus:outline-none');
    });
  });

  describe('CSS property conversion', () => {
    it('should convert background utilities correctly', () => {
      const testCases = [
        { class: 'bg-red-500', expected: 'background-color: #ef4444' },
        { class: 'bg-blue-500', expected: 'background-color: #3b82f6' },
        { class: 'bg-white', expected: 'background-color: #ffffff' },
        { class: 'bg-black', expected: 'background-color: #000000' }
      ];

      for (const testCase of testCases) {
        const utilities = parser.parseUtilities([testCase.class]);
        const result = generator.generateCssFromUtilities(utilities, { format: 'css' });
        expect(result.styles).toContain(testCase.expected);
      }
    });

    it('should convert text utilities correctly', () => {
      const testCases = [
        { class: 'text-white', expected: 'color: #ffffff' },
        { class: 'text-lg', expected: 'font-size: 1.125rem' },
        { class: 'text-xl', expected: 'font-size: 1.25rem' },
        { class: 'text-2xl', expected: 'font-size: 1.5rem' }
      ];

      for (const testCase of testCases) {
        const utilities = parser.parseUtilities([testCase.class]);
        const result = generator.generateCssFromUtilities(utilities, { format: 'css' });
        expect(result.styles).toContain(testCase.expected);
      }
    });

    it('should convert spacing utilities correctly', () => {
      const testCases = [
        { class: 'p-4', expected: 'padding: 1rem' },
        { class: 'px-6', expected: 'padding-left: 1.5rem; padding-right: 1.5rem' },
        { class: 'py-2', expected: 'padding-top: 0.5rem; padding-bottom: 0.5rem' },
        { class: 'm-4', expected: 'margin: 1rem' },
        { class: 'mx-auto', expected: 'margin-left: auto; margin-right: auto' }
      ];

      for (const testCase of testCases) {
        const utilities = parser.parseUtilities([testCase.class]);
        const result = generator.generateCssFromUtilities(utilities, { format: 'css' });
        expect(result.styles).toContain(testCase.expected);
      }
    });

    it('should convert layout utilities correctly', () => {
      const testCases = [
        { class: 'flex', expected: 'display: flex' },
        { class: 'block', expected: 'display: block' },
        { class: 'inline', expected: 'display: inline' },
        { class: 'hidden', expected: 'display: none' },
        { class: 'w-full', expected: 'width: 100%' },
        { class: 'h-64', expected: 'height: 16rem' }
      ];

      for (const testCase of testCases) {
        const utilities = parser.parseUtilities([testCase.class]);
        const result = generator.generateCssFromUtilities(utilities, { format: 'css' });
        expect(result.styles).toContain(testCase.expected);
      }
    });

    it('should convert border and decoration utilities', () => {
      const testCases = [
        { class: 'rounded', expected: 'border-radius: 0.25rem' },
        { class: 'rounded-lg', expected: 'border-radius: 0.5rem' },
        { class: 'rounded-full', expected: 'border-radius: 9999px' },
        { class: 'border', expected: 'border-width: 1px' },
        { class: 'shadow', expected: 'box-shadow:' },
        { class: 'shadow-lg', expected: 'box-shadow:' }
      ];

      for (const testCase of testCases) {
        const utilities = parser.parseUtilities([testCase.class]);
        const result = generator.generateCssFromUtilities(utilities, { format: 'css' });
        expect(result.styles).toContain(testCase.expected);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty utilities array', () => {
      const result = generator.generateCssFromUtilities([], { format: 'css' });
      expect(result.styles).toBe('');
      expect(result.imports).toEqual([]);
    });

    it('should handle utilities with no CSS conversion', () => {
      const mockUtilities: ParsedUtility[] = [
        {
          base: 'unknown-utility',
          variants: [],
          original: 'unknown-utility'
        }
      ];

      const result = generator.generateCssFromUtilities(mockUtilities, { format: 'css' });
      expect(result.styles).toBe('');
    });

    it('should group utilities correctly by scope', () => {
      const utilities = parser.parseUtilities([
        'bg-blue-500',           // base
        'hover:bg-red-500',      // variant
        'focus:bg-green-500',    // variant
        'md:text-lg',            // responsive
        'lg:p-8'                 // responsive
      ]);

      const result = generator.generateCssFromUtilities(utilities, { format: 'css' });
      
      // Should have base styles, variant styles, and responsive styles
      expect(result.styles).toContain('.component {');
      expect(result.styles).toContain(':hover');
      expect(result.styles).toContain(':focus');
      expect(result.styles).toContain('@media (min-width: 768px)');
      expect(result.styles).toContain('@media (min-width: 1024px)');
    });

    it('should handle mixed responsive and variant utilities', () => {
      const utilities = parser.parseUtilities(['md:hover:bg-blue-500']);
      const result = generator.generateCssFromUtilities(utilities, { format: 'css' });
      
      // Complex utilities with both responsive and variants should be grouped appropriately
      expect(result.styles).not.toBe('');
    });
  });
});