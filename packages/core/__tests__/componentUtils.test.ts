import { describe, it, expect } from 'vitest';
import {
  resolveComponentName,
  resolveComponentProps,
  resolveComponentImports
} from '@js-template-engine/types';
import type { Component, RootHandlerContext, RenderOptions } from '@js-template-engine/types';

describe('Component Utilities', () => {
  describe('resolveComponentName', () => {
    it('should return name from component metadata if available', () => {
      const context: RootHandlerContext = {
        component: {
          name: 'CustomComponent'
        },
        framework: 'react'
      };
      const options: RenderOptions = {};
      expect(resolveComponentName(context, options)).toBe('CustomComponent');
    });

    it('should fall back to options.name if component name is not available', () => {
      const context: RootHandlerContext = {
        component: {},
        framework: 'react'
      };
      const options: RenderOptions = {
        name: 'OptionComponent'
      };
      expect(resolveComponentName(context, options)).toBe('OptionComponent');
    });

    it('should fall back to options.componentName if other names are not available', () => {
      const context: RootHandlerContext = {
        component: {},
        framework: 'react'
      };
      const options: RenderOptions = {
        componentName: 'AltComponent'
      };
      expect(resolveComponentName(context, options)).toBe('AltComponent');
    });

    it('should use default name if no names are provided', () => {
      const context: RootHandlerContext = {
        component: {},
        framework: 'react'
      };
      const options: RenderOptions = {};
      expect(resolveComponentName(context, options)).toBe('Component');
      expect(resolveComponentName(context, options, 'CustomDefault')).toBe('CustomDefault');
    });
  });

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

  describe('resolveComponentImports', () => {
    it('should deduplicate and merge named imports from the same module', () => {
      const component = {
        imports: [
          'import { foo } from "bar"',
          'import { baz } from "bar"'
        ]
      };
      const result = resolveComponentImports(component);
      expect(result).toEqual([
        'import { foo, baz } from "bar"'
      ]);
    });

    it('should handle both default and named imports', () => {
      const component = {
        imports: [
          'import Default from "bar"',
          'import { foo } from "bar"',
          'import { baz } from "bar"'
        ]
      };
      const result = resolveComponentImports(component);
      expect(result).toEqual([
        'import Default, { foo, baz } from "bar"'
      ]);
    });

    it('should combine and deduplicate component imports with default imports', () => {
      const component = {
        imports: [
          'import { foo } from "bar"',
          'import Default from "bar"',
          'import { baz } from "bar"'
        ]
      };
      const defaultImports = [
        'import Default from "bar"'
      ];
      const result = resolveComponentImports(component, defaultImports);
      expect(result).toEqual([
        'import Default, { foo, baz } from "bar"'
      ]);
    });

    it('should handle object-style imports', () => {
      const component = {
        imports: [
          { from: 'bar', named: ['foo', 'baz'] },
          { from: 'qux', named: ['quux'] }
        ]
      };
      const result = resolveComponentImports(component);
      expect(result).toEqual([
        'import { foo, baz } from "bar"',
        'import { quux } from "qux"'
      ]);
    });

    it('should return deduplicated default imports if component has no imports', () => {
      const component = {};
      const defaultImports = [
        'import Default from "bar"',
        'import Default from "bar"'
      ];
      expect(resolveComponentImports(component, defaultImports)).toEqual([
        'import Default from "bar"'
      ]);
    });
  });
}); 