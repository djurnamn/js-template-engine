/**
 * Tests for ExtensionRegistry.
 */

import { ExtensionRegistry } from '../../src/registry/ExtensionRegistry';
import type { FrameworkExtension, StylingExtension, UtilityExtension } from '../../src/extensions';
import { vi } from 'vitest';

describe('ExtensionRegistry', () => {
  let registry: ExtensionRegistry;

  beforeEach(() => {
    registry = new ExtensionRegistry();
  });

  describe('Framework Extensions', () => {
    const createMockFrameworkExtension = (key: string, framework: 'react' | 'vue' | 'svelte'): FrameworkExtension => ({
      metadata: {
        type: 'framework',
        key,
        name: `${framework} Extension`,
        version: '1.0.0'
      },
      framework,
      processEvents: vi.fn().mockReturnValue({ attributes: {} }),
      processConditionals: vi.fn().mockReturnValue({ syntax: '' }),
      processIterations: vi.fn().mockReturnValue({ syntax: '' }),
      processSlots: vi.fn().mockReturnValue({ syntax: '' }),
      processAttributes: vi.fn().mockReturnValue({ attributes: {} }),
      renderComponent: vi.fn().mockReturnValue('')
    });

    it('should register a framework extension', () => {
      const extension = createMockFrameworkExtension('react', 'react');
      const result = registry.registerFramework(extension);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(registry.getFramework('react')).toBe(extension);
    });

    it('should not register duplicate framework extensions', () => {
      const extension1 = createMockFrameworkExtension('react', 'react');
      const extension2 = createMockFrameworkExtension('react', 'react');

      registry.registerFramework(extension1);
      const result = registry.registerFramework(extension2);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Framework extension with key 'react' already registered");
    });

    it('should get available frameworks', () => {
      const reactExt = createMockFrameworkExtension('react', 'react');
      const vueExt = createMockFrameworkExtension('vue', 'vue');

      registry.registerFramework(reactExt);
      registry.registerFramework(vueExt);

      const frameworks = registry.getAvailableFrameworks();
      expect(frameworks).toEqual(['react', 'vue']);
    });

    it('should check if framework extension exists', () => {
      const extension = createMockFrameworkExtension('react', 'react');
      registry.registerFramework(extension);

      expect(registry.hasExtension('react', 'framework')).toBe(true);
      expect(registry.hasExtension('vue', 'framework')).toBe(false);
      expect(registry.hasExtension('react')).toBe(true);
    });

    it('should remove framework extension', () => {
      const extension = createMockFrameworkExtension('react', 'react');
      registry.registerFramework(extension);

      expect(registry.removeExtension('react', 'framework')).toBe(true);
      expect(registry.getFramework('react')).toBeUndefined();
      expect(registry.removeExtension('react', 'framework')).toBe(false);
    });
  });

  describe('Styling Extensions', () => {
    const createMockStylingExtension = (key: string, styling: string): StylingExtension => ({
      metadata: {
        type: 'styling',
        key,
        name: `${styling} Extension`,
        version: '1.0.0'
      },
      styling: styling as any,
      processStyles: vi.fn().mockReturnValue({ styles: '' })
    });

    it('should register a styling extension', () => {
      const extension = createMockStylingExtension('bem', 'bem');
      const result = registry.registerStyling(extension);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(registry.getStyling('bem')).toBe(extension);
    });

    it('should not register duplicate styling extensions', () => {
      const extension1 = createMockStylingExtension('bem', 'bem');
      const extension2 = createMockStylingExtension('bem', 'bem');

      registry.registerStyling(extension1);
      const result = registry.registerStyling(extension2);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Styling extension with key 'bem' already registered");
    });

    it('should get available styling extensions', () => {
      const bemExt = createMockStylingExtension('bem', 'bem');
      const tailwindExt = createMockStylingExtension('tailwind', 'tailwind');

      registry.registerStyling(bemExt);
      registry.registerStyling(tailwindExt);

      const styling = registry.getAvailableStyling();
      expect(styling).toEqual(['bem', 'tailwind']);
    });
  });

  describe('Utility Extensions', () => {
    const createMockUtilityExtension = (key: string): UtilityExtension => ({
      metadata: {
        type: 'utility',
        key,
        name: `${key} Extension`,
        version: '1.0.0'
      },
      utility: key,
      process: vi.fn().mockImplementation(concepts => concepts)
    });

    it('should register a utility extension', () => {
      const extension = createMockUtilityExtension('linter');
      const result = registry.registerUtility(extension);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(registry.getUtility('linter')).toBe(extension);
    });

    it('should get available utility extensions', () => {
      const linterExt = createMockUtilityExtension('linter');
      const optimizerExt = createMockUtilityExtension('optimizer');

      registry.registerUtility(linterExt);
      registry.registerUtility(optimizerExt);

      const utilities = registry.getAvailableUtilities();
      expect(utilities).toEqual(['linter', 'optimizer']);
    });
  });

  describe('Extension Type Queries', () => {
    it('should get extensions by type', () => {
      const reactExt = createMockFrameworkExtension('react', 'react');
      const bemExt = createMockStylingExtension('bem', 'bem');
      const linterExt = createMockUtilityExtension('linter');

      registry.registerFramework(reactExt);
      registry.registerStyling(bemExt);
      registry.registerUtility(linterExt);

      expect(registry.getExtensionsByType('framework')).toEqual([reactExt]);
      expect(registry.getExtensionsByType('styling')).toEqual([bemExt]);
      expect(registry.getExtensionsByType('utility')).toEqual([linterExt]);
    });

    it('should get extension count', () => {
      const reactExt = createMockFrameworkExtension('react', 'react');
      const vueExt = createMockFrameworkExtension('vue', 'vue');
      const bemExt = createMockStylingExtension('bem', 'bem');

      registry.registerFramework(reactExt);
      registry.registerFramework(vueExt);
      registry.registerStyling(bemExt);

      expect(registry.getExtensionCount()).toBe(3);
      expect(registry.getExtensionCount('framework')).toBe(2);
      expect(registry.getExtensionCount('styling')).toBe(1);
      expect(registry.getExtensionCount('utility')).toBe(0);
    });

    it('should clear extensions', () => {
      const reactExt = createMockFrameworkExtension('react', 'react');
      const bemExt = createMockStylingExtension('bem', 'bem');

      registry.registerFramework(reactExt);
      registry.registerStyling(bemExt);

      registry.clearExtensions('framework');
      expect(registry.getExtensionCount('framework')).toBe(0);
      expect(registry.getExtensionCount('styling')).toBe(1);

      registry.clearExtensions();
      expect(registry.getExtensionCount()).toBe(0);
    });
  });

  describe('Validation', () => {
    it('should validate extension metadata', () => {
      const invalidExtension = {
        metadata: {
          type: 'invalid' as any,
          key: '',
          name: '',
          version: '1.0'
        }
      };

      const result = registry.validateExtension(invalidExtension as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Extension metadata.key is required and must be a string');
      expect(result.errors).toContain('Extension metadata.name is required and must be a string');
      expect(result.errors).toContain('Extension metadata.version must follow semantic versioning (e.g., "1.0.0")');
      expect(result.errors).toContain('Extension type must be one of: framework, styling, utility');
    });

    it('should validate framework extension methods', () => {
      const incompleteFrameworkExt = {
        metadata: {
          type: 'framework' as const,
          key: 'react',
          name: 'React Extension',
          version: '1.0.0'
        },
        framework: 'react' as const,
        // Missing required methods
      };

      const result = registry.validateExtension(incompleteFrameworkExt as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Framework extension must implement method: processEvents');
      expect(result.errors).toContain('Framework extension must implement method: processConditionals');
      expect(result.errors).toContain('Framework extension must implement method: renderComponent');
    });

    it('should validate styling extension methods', () => {
      const incompleteStylingExt = {
        metadata: {
          type: 'styling' as const,
          key: 'bem',
          name: 'BEM Extension',
          version: '1.0.0'
        },
        styling: 'bem',
        // Missing processStyles method
      };

      const result = registry.validateExtension(incompleteStylingExt as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Styling extension must implement processStyles method');
    });

    it('should pass validation for valid extensions', () => {
      const validExtension = createMockFrameworkExtension('react', 'react');
      const result = registry.validateExtension(validExtension);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  // Helper function to create mock framework extension
  function createMockFrameworkExtension(key: string, framework: 'react' | 'vue' | 'svelte'): FrameworkExtension {
    return {
      metadata: {
        type: 'framework',
        key,
        name: `${framework} Extension`,
        version: '1.0.0'
      },
      framework,
      processEvents: vi.fn().mockReturnValue({ attributes: {} }),
      processConditionals: vi.fn().mockReturnValue({ syntax: '' }),
      processIterations: vi.fn().mockReturnValue({ syntax: '' }),
      processSlots: vi.fn().mockReturnValue({ syntax: '' }),
      processAttributes: vi.fn().mockReturnValue({ attributes: {} }),
      renderComponent: vi.fn().mockReturnValue('')
    };
  }

  function createMockStylingExtension(key: string, styling: string): StylingExtension {
    return {
      metadata: {
        type: 'styling',
        key,
        name: `${styling} Extension`,
        version: '1.0.0'
      },
      styling: styling as any,
      processStyles: vi.fn().mockReturnValue({ styles: '' })
    };
  }

  function createMockUtilityExtension(key: string): UtilityExtension {
    return {
      metadata: {
        type: 'utility',
        key,
        name: `${key} Extension`,
        version: '1.0.0'
      },
      utility: key,
      process: vi.fn().mockImplementation(concepts => concepts)
    };
  }
});