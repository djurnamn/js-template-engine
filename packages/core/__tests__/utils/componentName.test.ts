import { describe, it, expect } from 'vitest';
import {
  resolveComponentName,
  sanitizeComponentName
} from '@js-template-engine/types';
import type { Component, RootHandlerContext, RenderOptions } from '@js-template-engine/types';

describe('Component Name Utilities', () => {
  describe('sanitizeComponentName', () => {
    it('should convert names to PascalCase', () => {
      expect(sanitizeComponentName('my-component')).toBe('MyComponent');
      expect(sanitizeComponentName('my component')).toBe('MyComponent');
      expect(sanitizeComponentName('my_component')).toBe('MyComponent');
    });

    it('should handle invalid characters', () => {
      expect(sanitizeComponentName('my@component!')).toBe('MyComponent');
      expect(sanitizeComponentName('my.component')).toBe('MyComponent');
      expect(sanitizeComponentName('my-component!')).toBe('MyComponent');
    });

    it('should handle multiple spaces and special characters', () => {
      expect(sanitizeComponentName('my  component!')).toBe('MyComponent');
      expect(sanitizeComponentName('my-component!@#')).toBe('MyComponent');
      expect(sanitizeComponentName('  my  component  ')).toBe('MyComponent');
    });

    it('should preserve valid characters', () => {
      expect(sanitizeComponentName('MyComponent123')).toBe('MyComponent123');
      expect(sanitizeComponentName('My-Component')).toBe('MyComponent');
      expect(sanitizeComponentName('My Component')).toBe('MyComponent');
    });
  });

  describe('resolveComponentName', () => {
    it('should return name from component metadata if available', () => {
      const context: RootHandlerContext = {
        component: {
          name: 'Custom Component!'
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
        name: 'Option Component!'
      };
      expect(resolveComponentName(context, options)).toBe('OptionComponent');
    });

    it('should fall back to options.componentName if other names are not available', () => {
      const context: RootHandlerContext = {
        component: {},
        framework: 'react'
      };
      const options: RenderOptions = {
        componentName: 'Alt Component!'
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
      expect(resolveComponentName(context, options, 'Custom Default!')).toBe('CustomDefault');
    });
  });
}); 