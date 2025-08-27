import { describe, it, expect, beforeEach } from 'vitest';
import { UtilityParser } from '../parsers/UtilityParser';

describe('UtilityParser', () => {
  let parser: UtilityParser;

  beforeEach(() => {
    parser = new UtilityParser();
  });

  describe('parseUtilityClass', () => {
    it('should parse simple utility classes', () => {
      const result = parser.parseUtilityClass('bg-blue-500');
      expect(result.base).toBe('bg-blue-500');
      expect(result.responsive).toBeUndefined();
      expect(result.variants).toEqual([]);
      expect(result.original).toBe('bg-blue-500');
    });

    it('should parse responsive utility classes', () => {
      const result = parser.parseUtilityClass('md:text-lg');
      expect(result.base).toBe('text-lg');
      expect(result.responsive).toBe('md');
      expect(result.variants).toEqual([]);
      expect(result.original).toBe('md:text-lg');
    });

    it('should parse variant utility classes', () => {
      const result = parser.parseUtilityClass('hover:bg-red-500');
      expect(result.base).toBe('bg-red-500');
      expect(result.responsive).toBeUndefined();
      expect(result.variants).toEqual(['hover']);
      expect(result.original).toBe('hover:bg-red-500');
    });

    it('should parse complex utility classes with multiple variants', () => {
      const result = parser.parseUtilityClass('lg:hover:focus:bg-blue-500');
      expect(result.base).toBe('bg-blue-500');
      expect(result.responsive).toBe('lg');
      expect(result.variants).toEqual(['hover', 'focus']);
      expect(result.original).toBe('lg:hover:focus:bg-blue-500');
    });

    it('should handle group variants', () => {
      const result = parser.parseUtilityClass('group-hover:scale-110');
      expect(result.base).toBe('scale-110');
      expect(result.responsive).toBeUndefined();
      expect(result.variants).toEqual(['group-hover']);
      expect(result.original).toBe('group-hover:scale-110');
    });

    it('should handle dark mode variants', () => {
      const result = parser.parseUtilityClass('dark:bg-gray-800');
      expect(result.base).toBe('bg-gray-800');
      expect(result.responsive).toBeUndefined();
      expect(result.variants).toEqual(['dark']);
      expect(result.original).toBe('dark:bg-gray-800');
    });
  });

  describe('parseUtilities', () => {
    it('should parse array of utility classes', () => {
      const classes = ['bg-blue-500', 'text-white', 'p-4'];
      const results = parser.parseUtilities(classes);

      expect(results).toHaveLength(3);
      expect(results[0].base).toBe('bg-blue-500');
      expect(results[1].base).toBe('text-white');
      expect(results[2].base).toBe('p-4');
    });

    it('should parse space-separated string of utility classes', () => {
      const classString = 'bg-blue-500 text-white p-4';
      const results = parser.parseUtilities(classString);

      expect(results).toHaveLength(3);
      expect(results[0].base).toBe('bg-blue-500');
      expect(results[1].base).toBe('text-white');
      expect(results[2].base).toBe('p-4');
    });

    it('should handle empty strings and arrays', () => {
      expect(parser.parseUtilities([])).toEqual([]);
      expect(parser.parseUtilities('')).toEqual([]);
      expect(parser.parseUtilities('   ')).toEqual([]);
    });

    it('should handle multiple spaces in string', () => {
      const classString = '  bg-blue-500   text-white    p-4  ';
      const results = parser.parseUtilities(classString);

      expect(results).toHaveLength(3);
      expect(results[0].base).toBe('bg-blue-500');
      expect(results[1].base).toBe('text-white');
      expect(results[2].base).toBe('p-4');
    });
  });

  describe('validateUtility', () => {
    it('should validate known utility classes', () => {
      const validClasses = [
        'bg-blue-500',
        'text-white',
        'p-4',
        'flex',
        'hidden',
        'absolute',
        'rounded',
        'shadow',
      ];

      for (const className of validClasses) {
        const result = parser.validateUtility(className);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
        expect(result.properties).toBeDefined();
      }
    });

    it('should invalidate unknown utility classes', () => {
      const invalidClasses = [
        'unknown-class',
        'invalid-utility',
        'not-tailwind',
      ];

      for (const className of invalidClasses) {
        const result = parser.validateUtility(className);
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
      }
    });

    it('should validate responsive utilities', () => {
      const result = parser.validateUtility('md:bg-blue-500');
      expect(result.valid).toBe(true);
      expect(result.properties).toContain('background-color');
    });

    it('should validate variant utilities', () => {
      const result = parser.validateUtility('hover:bg-red-500');
      expect(result.valid).toBe(true);
      expect(result.properties).toContain('background-color');
    });

    it('should invalidate unknown variants', () => {
      const result = parser.validateUtility('unknown-variant:bg-blue-500');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown variant');
    });

    it('should invalidate unknown breakpoints', () => {
      const result = parser.validateUtility('unknown-breakpoint:bg-blue-500');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown breakpoint');
    });

    it('should return correct CSS properties for utilities', () => {
      const testCases = [
        {
          class: 'bg-blue-500',
          expectedProps: [
            'background-color',
            'background-image',
            'background-size',
          ],
        },
        {
          class: 'text-white',
          expectedProps: [
            'color',
            'font-size',
            'text-align',
            'text-decoration',
          ],
        },
        { class: 'p-4', expectedProps: ['padding'] },
        {
          class: 'flex',
          expectedProps: [
            'display',
            'flex-direction',
            'flex-wrap',
            'flex-grow',
            'flex-shrink',
          ],
        },
        { class: 'w-full', expectedProps: ['width'] },
        { class: 'h-64', expectedProps: ['height'] },
      ];

      for (const testCase of testCases) {
        const result = parser.validateUtility(testCase.class);
        expect(result.valid).toBe(true);
        for (const prop of testCase.expectedProps) {
          expect(result.properties).toContain(prop);
        }
      }
    });
  });

  describe('complex parsing scenarios', () => {
    it('should handle multiple breakpoints (should use last one)', () => {
      const result = parser.parseUtilityClass('sm:md:lg:bg-blue-500');
      expect(result.base).toBe('bg-blue-500');
      expect(result.responsive).toBe('lg'); // Last valid breakpoint
      expect(result.variants).toEqual(['sm', 'md']); // Earlier ones treated as variants (invalid, but parsed)
      expect(result.original).toBe('sm:md:lg:bg-blue-500');
    });

    it('should handle mixed valid and invalid prefixes', () => {
      const result = parser.parseUtilityClass(
        'hover:invalid:focus:bg-blue-500'
      );
      expect(result.base).toBe('bg-blue-500');
      expect(result.variants).toContain('hover');
      expect(result.variants).toContain('focus');
      expect(result.variants).toContain('invalid'); // Parsed but will be invalid during validation
      expect(result.original).toBe('hover:invalid:focus:bg-blue-500');
    });

    it('should handle utilities with numbers and special characters', () => {
      const testCases = [
        'bg-blue-500',
        'text-2xl',
        'w-1/2',
        'top-1.5',
        'scale-110',
        'rotate-45',
      ];

      for (const testCase of testCases) {
        const result = parser.parseUtilityClass(testCase);
        expect(result.base).toBe(testCase);
        expect(result.original).toBe(testCase);
      }
    });

    it('should handle negative utilities', () => {
      const result = parser.parseUtilityClass('-mt-4');
      expect(result.base).toBe('-mt-4');
      expect(result.original).toBe('-mt-4');
    });

    it('should handle arbitrary value utilities', () => {
      const result = parser.parseUtilityClass('bg-[#123456]');
      expect(result.base).toBe('bg-[#123456]');
      expect(result.original).toBe('bg-[#123456]');
    });
  });
});
