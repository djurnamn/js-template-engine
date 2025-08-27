import { describe, it, expect } from 'vitest';
import { resolveComponentProps } from '@js-template-engine/types';
import type { Component } from '@js-template-engine/types';

describe('Component Props Utilities', () => {
  describe('resolveComponentProps', () => {
    it('should convert simple props to name: type format', () => {
      const component: Component = {
        props: {
          message: 'string',
          count: 'number',
          isActive: 'boolean'
        }
      };
      const result = resolveComponentProps(component);
      expect(result).toMatchInlineSnapshot(`
        "  props: {
            message: string,
            count: number,
            isActive: boolean
          },"
      `);
    });

    it('should handle stringified function values', () => {
      const component: Component = {
        props: {
          onClick: '() => void',
          onSubmit: '(e: Event) => void'
        }
      };
      const result = resolveComponentProps(component);
      expect(result).toMatchInlineSnapshot(`
        "  props: {
            onClick: () => void,
            onSubmit: (e: Event) => void
          },"
      `);
    });

    it('should handle stringified object values', () => {
      const component: Component = {
        props: {
          config: '{ theme: string; mode: "light" | "dark" }',
          styles: '{ [key: string]: string }'
        }
      };
      const result = resolveComponentProps(component);
      expect(result).toMatchInlineSnapshot(`
        "  props: {
            config: { theme: string; mode: "light" | "dark" },
            styles: { [key: string]: string }
          },"
      `);
    });

    it('should return empty string for undefined props', () => {
      const component: Component = {};
      expect(resolveComponentProps(component)).toBe('');
    });

    it('should return empty string for empty props object', () => {
      const component: Component = {
        props: {}
      };
      expect(resolveComponentProps(component)).toBe('');
    });
  });
}); 