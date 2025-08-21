/**
 * Type-safe extension registry for managing framework, styling, and utility extensions.
 */

import type { 
  Extension, 
  FrameworkExtension, 
  StylingExtension, 
  UtilityExtension,
  ExtensionMetadata 
} from '../extensions';

/**
 * Validation result for extension registration.
 */
export interface ValidationResult {
  /** Whether validation passed */
  isValid: boolean;
  /** Error messages if validation failed */
  errors: string[];
  /** Warning messages */
  warnings: string[];
}

/**
 * Registry for type-safe extension management.
 */
export class ExtensionRegistry {
  private frameworks = new Map<string, FrameworkExtension>();
  private styling = new Map<string, StylingExtension>();
  private utilities = new Map<string, UtilityExtension>();

  /**
   * Register a framework extension.
   */
  registerFramework(extension: FrameworkExtension): ValidationResult {
    const validation = this.validateExtension(extension);
    if (!validation.isValid) {
      return validation;
    }

    if (this.frameworks.has(extension.metadata.key)) {
      return {
        isValid: false,
        errors: [`Framework extension with key '${extension.metadata.key}' already registered`],
        warnings: []
      };
    }

    this.frameworks.set(extension.metadata.key, extension);
    return {
      isValid: true,
      errors: [],
      warnings: []
    };
  }

  /**
   * Register a styling extension.
   */
  registerStyling(extension: StylingExtension): ValidationResult {
    const validation = this.validateExtension(extension);
    if (!validation.isValid) {
      return validation;
    }

    if (this.styling.has(extension.metadata.key)) {
      return {
        isValid: false,
        errors: [`Styling extension with key '${extension.metadata.key}' already registered`],
        warnings: []
      };
    }

    this.styling.set(extension.metadata.key, extension);
    return {
      isValid: true,
      errors: [],
      warnings: []
    };
  }

  /**
   * Register a utility extension.
   */
  registerUtility(extension: UtilityExtension): ValidationResult {
    const validation = this.validateExtension(extension);
    if (!validation.isValid) {
      return validation;
    }

    if (this.utilities.has(extension.metadata.key)) {
      return {
        isValid: false,
        errors: [`Utility extension with key '${extension.metadata.key}' already registered`],
        warnings: []
      };
    }

    this.utilities.set(extension.metadata.key, extension);
    return {
      isValid: true,
      errors: [],
      warnings: []
    };
  }

  /**
   * Get a framework extension by key.
   */
  getFramework(key: string): FrameworkExtension | undefined {
    return this.frameworks.get(key);
  }

  /**
   * Get a styling extension by key.
   */
  getStyling(key: string): StylingExtension | undefined {
    return this.styling.get(key);
  }

  /**
   * Get a utility extension by key.
   */
  getUtility(key: string): UtilityExtension | undefined {
    return this.utilities.get(key);
  }

  /**
   * Get all available framework keys.
   */
  getAvailableFrameworks(): string[] {
    return Array.from(this.frameworks.keys());
  }

  /**
   * Get all available styling keys.
   */
  getAvailableStyling(): string[] {
    return Array.from(this.styling.keys());
  }

  /**
   * Get all available utility keys.
   */
  getAvailableUtilities(): string[] {
    return Array.from(this.utilities.keys());
  }

  /**
   * Get all extensions of a specific type.
   */
  getExtensionsByType(type: 'framework'): FrameworkExtension[];
  getExtensionsByType(type: 'styling'): StylingExtension[];
  getExtensionsByType(type: 'utility'): UtilityExtension[];
  getExtensionsByType(type: string): Extension[] {
    switch (type) {
      case 'framework':
        return Array.from(this.frameworks.values());
      case 'styling':
        return Array.from(this.styling.values());
      case 'utility':
        return Array.from(this.utilities.values());
      default:
        return [];
    }
  }

  /**
   * Check if an extension is registered.
   */
  hasExtension(key: string, type?: 'framework' | 'styling' | 'utility'): boolean {
    if (type) {
      switch (type) {
        case 'framework':
          return this.frameworks.has(key);
        case 'styling':
          return this.styling.has(key);
        case 'utility':
          return this.utilities.has(key);
        default:
          return false;
      }
    }
    
    return this.frameworks.has(key) || this.styling.has(key) || this.utilities.has(key);
  }

  /**
   * Remove an extension by key and type.
   */
  removeExtension(key: string, type: 'framework' | 'styling' | 'utility'): boolean {
    switch (type) {
      case 'framework':
        return this.frameworks.delete(key);
      case 'styling':
        return this.styling.delete(key);
      case 'utility':
        return this.utilities.delete(key);
      default:
        return false;
    }
  }

  /**
   * Clear all extensions of a specific type.
   */
  clearExtensions(type?: 'framework' | 'styling' | 'utility'): void {
    if (type) {
      switch (type) {
        case 'framework':
          this.frameworks.clear();
          break;
        case 'styling':
          this.styling.clear();
          break;
        case 'utility':
          this.utilities.clear();
          break;
      }
    } else {
      this.frameworks.clear();
      this.styling.clear();
      this.utilities.clear();
    }
  }

  /**
   * Get total number of registered extensions.
   */
  getExtensionCount(type?: 'framework' | 'styling' | 'utility'): number {
    if (type) {
      switch (type) {
        case 'framework':
          return this.frameworks.size;
        case 'styling':
          return this.styling.size;
        case 'utility':
          return this.utilities.size;
        default:
          return 0;
      }
    }
    
    return this.frameworks.size + this.styling.size + this.utilities.size;
  }

  /**
   * Validate an extension before registration.
   */
  validateExtension(extension: Extension): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required metadata
    if (!extension.metadata) {
      errors.push('Extension metadata is required');
      return { isValid: false, errors, warnings };
    }

    const { metadata } = extension;

    // Validate metadata fields
    if (!metadata.key || typeof metadata.key !== 'string') {
      errors.push('Extension metadata.key is required and must be a string');
    } else if (!/^[a-z][a-z0-9\-]*[a-z0-9]$|^[a-z]$/.test(metadata.key)) {
      errors.push('Extension metadata.key must be lowercase alphanumeric with hyphens, starting with a letter');
    }

    if (!metadata.name || typeof metadata.name !== 'string') {
      errors.push('Extension metadata.name is required and must be a string');
    }

    if (!metadata.version || typeof metadata.version !== 'string') {
      errors.push('Extension metadata.version is required and must be a string');
    } else if (!/^\d+\.\d+\.\d+$/.test(metadata.version)) {
      errors.push('Extension metadata.version must follow semantic versioning (e.g., "1.0.0")');
    }

    if (!['framework', 'styling', 'utility'].includes(metadata.type)) {
      errors.push('Extension type must be one of: framework, styling, utility');
    }

    // Type-specific validation
    if (metadata.type === 'framework') {
      const frameworkExt = extension as FrameworkExtension;
      if (!frameworkExt.framework || !['react', 'vue', 'svelte'].includes(frameworkExt.framework)) {
        errors.push('Framework extension must specify a valid framework: "react", "vue", or "svelte"');
      }

      // Check required methods
      const requiredMethods = ['processEvents', 'processConditionals', 'processIterations', 'processSlots', 'processAttributes', 'renderComponent'];
      for (const method of requiredMethods) {
        if (typeof (frameworkExt as any)[method] !== 'function') {
          errors.push(`Framework extension must implement method: ${method}`);
        }
      }
    }

    if (metadata.type === 'styling') {
      const stylingExt = extension as StylingExtension;
      if (!stylingExt.styling || !['bem', 'tailwind', 'css-modules', 'styled-components'].includes(stylingExt.styling)) {
        warnings.push('Styling extension should specify a valid styling approach');
      }

      if (typeof stylingExt.processStyles !== 'function') {
        errors.push('Styling extension must implement processStyles method');
      }
    }

    if (metadata.type === 'utility') {
      const utilityExt = extension as UtilityExtension;
      if (typeof utilityExt.process !== 'function') {
        errors.push('Utility extension must implement process method');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}