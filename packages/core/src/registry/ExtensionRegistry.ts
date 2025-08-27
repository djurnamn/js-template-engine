/**
 * Type-safe registry for managing framework, styling, and utility extensions.
 *
 * The ExtensionRegistry provides centralized management of all extensions,
 * ensuring type safety, validation, and proper lifecycle management for
 * different types of extensions in the template processing pipeline.
 *
 * @example
 * ```typescript
 * const registry = new ExtensionRegistry();
 *
 * // Register extensions
 * registry.registerFramework(new ReactFrameworkExtension());
 * registry.registerStyling(new TailwindStylingExtension());
 * registry.registerUtility(new MyUtilityExtension());
 *
 * // Use extensions
 * const reactExtension = registry.getFramework('react');
 * const availableFrameworks = registry.getAvailableFrameworks();
 * ```
 *
 * @since 2.0.0
 */

import type {
  Extension,
  FrameworkExtension,
  StylingExtension,
  UtilityExtension,
} from '../extensions';

/**
 * Result object from extension validation operations.
 *
 * @public
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
 * Type-safe registry for managing and coordinating extensions across the template processing pipeline.
 *
 * The ExtensionRegistry serves as the central hub for all extension management operations,
 * providing type-safe registration, validation, retrieval, and lifecycle management for
 * framework, styling, and utility extensions.
 *
 * @example
 * ```typescript
 * const registry = new ExtensionRegistry();
 *
 * // Register different types of extensions
 * const result = registry.registerFramework(new ReactFrameworkExtension());
 * if (result.isValid) {
 *   console.log('React extension registered successfully');
 * }
 *
 * // Retrieve and use extensions
 * const reactExt = registry.getFramework('react');
 * const tailwindExt = registry.getStyling('tailwind');
 *
 * // Query registry state
 * console.log('Available frameworks:', registry.getAvailableFrameworks());
 * console.log('Total extensions:', registry.getExtensionCount());
 * ```
 *
 * @since 2.0.0
 */
export class ExtensionRegistry {
  private frameworks = new Map<string, FrameworkExtension>();
  private styling = new Map<string, StylingExtension>();
  private utilities = new Map<string, UtilityExtension>();

  /**
   * Registers a framework extension with validation.
   *
   * @param extension - Framework extension instance to register
   * @returns Validation result indicating success or failure with error details
   *
   * @example
   * ```typescript
   * const reactExtension = new ReactFrameworkExtension();
   * const result = registry.registerFramework(reactExtension);
   *
   * if (result.isValid) {
   *   console.log('Framework extension registered successfully');
   * } else {
   *   console.error('Registration failed:', result.errors);
   * }
   * ```
   */
  registerFramework(extension: FrameworkExtension): ValidationResult {
    const validation = this.validateExtension(extension);
    if (!validation.isValid) {
      return validation;
    }

    if (this.frameworks.has(extension.metadata.key)) {
      return {
        isValid: false,
        errors: [
          `Framework extension with key '${extension.metadata.key}' already registered`,
        ],
        warnings: [],
      };
    }

    this.frameworks.set(extension.metadata.key, extension);
    return {
      isValid: true,
      errors: [],
      warnings: [],
    };
  }

  /**
   * Registers a styling extension with validation.
   *
   * @param extension - Styling extension instance to register
   * @returns Validation result indicating success or failure with error details
   *
   * @example
   * ```typescript
   * const tailwindExtension = new TailwindStylingExtension();
   * const result = registry.registerStyling(tailwindExtension);
   *
   * if (!result.isValid) {
   *   console.error('Styling extension registration failed:', result.errors);
   * }
   * ```
   */
  registerStyling(extension: StylingExtension): ValidationResult {
    const validation = this.validateExtension(extension);
    if (!validation.isValid) {
      return validation;
    }

    if (this.styling.has(extension.metadata.key)) {
      return {
        isValid: false,
        errors: [
          `Styling extension with key '${extension.metadata.key}' already registered`,
        ],
        warnings: [],
      };
    }

    this.styling.set(extension.metadata.key, extension);
    return {
      isValid: true,
      errors: [],
      warnings: [],
    };
  }

  /**
   * Registers a utility extension with validation.
   *
   * @param extension - Utility extension instance to register
   * @returns Validation result indicating success or failure with error details
   *
   * @example
   * ```typescript
   * const myUtility = new CustomUtilityExtension();
   * const result = registry.registerUtility(myUtility);
   *
   * if (result.isValid) {
   *   console.log('Utility extension ready for use');
   * }
   * ```
   */
  registerUtility(extension: UtilityExtension): ValidationResult {
    const validation = this.validateExtension(extension);
    if (!validation.isValid) {
      return validation;
    }

    if (this.utilities.has(extension.metadata.key)) {
      return {
        isValid: false,
        errors: [
          `Utility extension with key '${extension.metadata.key}' already registered`,
        ],
        warnings: [],
      };
    }

    this.utilities.set(extension.metadata.key, extension);
    return {
      isValid: true,
      errors: [],
      warnings: [],
    };
  }

  /**
   * Retrieves a framework extension by its key.
   *
   * @param key - Unique identifier for the framework extension
   * @returns Framework extension instance or undefined if not found
   *
   * @example
   * ```typescript
   * const reactExt = registry.getFramework('react');
   * if (reactExt) {
   *   const result = reactExt.renderComponent(concepts, context);
   * }
   * ```
   */
  getFramework(key: string): FrameworkExtension | undefined {
    return this.frameworks.get(key);
  }

  /**
   * Retrieves a styling extension by its key.
   *
   * @param key - Unique identifier for the styling extension
   * @returns Styling extension instance or undefined if not found
   *
   * @example
   * ```typescript
   * const tailwindExt = registry.getStyling('tailwind');
   * if (tailwindExt) {
   *   const styleResult = tailwindExt.processStyles(stylingConcepts);
   * }
   * ```
   */
  getStyling(key: string): StylingExtension | undefined {
    return this.styling.get(key);
  }

  /**
   * Retrieves a utility extension by its key.
   *
   * @param key - Unique identifier for the utility extension
   * @returns Utility extension instance or undefined if not found
   *
   * @example
   * ```typescript
   * const utilityExt = registry.getUtility('my-utility');
   * if (utilityExt) {
   *   const processedConcepts = utilityExt.process(concepts);
   * }
   * ```
   */
  getUtility(key: string): UtilityExtension | undefined {
    return this.utilities.get(key);
  }

  /**
   * Retrieves all registered framework extension keys.
   *
   * @returns Array of framework extension keys
   *
   * @example
   * ```typescript
   * const frameworks = registry.getAvailableFrameworks();
   * console.log('Available frameworks:', frameworks); // ['react', 'vue', 'svelte']
   * ```
   */
  getAvailableFrameworks(): string[] {
    return Array.from(this.frameworks.keys());
  }

  /**
   * Retrieves all registered styling extension keys.
   *
   * @returns Array of styling extension keys
   *
   * @example
   * ```typescript
   * const stylingOptions = registry.getAvailableStyling();
   * console.log('Available styling:', stylingOptions); // ['tailwind', 'bem']
   * ```
   */
  getAvailableStyling(): string[] {
    return Array.from(this.styling.keys());
  }

  /**
   * Retrieves all registered utility extension keys.
   *
   * @returns Array of utility extension keys
   *
   * @example
   * ```typescript
   * const utilities = registry.getAvailableUtilities();
   * console.log('Available utilities:', utilities); // ['my-utility', 'another-utility']
   * ```
   */
  getAvailableUtilities(): string[] {
    return Array.from(this.utilities.keys());
  }

  /**
   * Retrieves all extension instances of a specific type.
   *
   * @param type - Extension type to retrieve ('framework', 'styling', or 'utility')
   * @returns Array of extension instances of the specified type
   *
   * @example
   * ```typescript
   * const frameworkExtensions = registry.getExtensionsByType('framework');
   * const stylingExtensions = registry.getExtensionsByType('styling');
   *
   * frameworkExtensions.forEach(ext => {
   *   console.log(`Framework: ${ext.metadata.name}`);
   * });
   * ```
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
  hasExtension(
    key: string,
    type?: 'framework' | 'styling' | 'utility'
  ): boolean {
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

    return (
      this.frameworks.has(key) ||
      this.styling.has(key) ||
      this.utilities.has(key)
    );
  }

  /**
   * Remove an extension by key and type.
   */
  removeExtension(
    key: string,
    type: 'framework' | 'styling' | 'utility'
  ): boolean {
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
   * Validates an extension against registry requirements and standards.
   *
   * Performs comprehensive validation including:
   * - Metadata completeness and format validation
   * - Type-specific interface compliance
   * - Semantic versioning validation
   * - Required method presence checks
   *
   * @param extension - Extension instance to validate
   * @returns Validation result with success status, errors, and warnings
   *
   * @example
   * ```typescript
   * const extension = new MyFrameworkExtension();
   * const validation = registry.validateExtension(extension);
   *
   * if (!validation.isValid) {
   *   console.error('Validation errors:', validation.errors);
   *   console.warn('Validation warnings:', validation.warnings);
   * }
   * ```
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
      errors.push(
        'Extension metadata.key must be lowercase alphanumeric with hyphens, starting with a letter'
      );
    }

    if (!metadata.name || typeof metadata.name !== 'string') {
      errors.push('Extension metadata.name is required and must be a string');
    }

    if (!metadata.version || typeof metadata.version !== 'string') {
      errors.push(
        'Extension metadata.version is required and must be a string'
      );
    } else if (!/^\d+\.\d+\.\d+$/.test(metadata.version)) {
      errors.push(
        'Extension metadata.version must follow semantic versioning (e.g., "1.0.0")'
      );
    }

    if (!['framework', 'styling', 'utility'].includes(metadata.type)) {
      errors.push('Extension type must be one of: framework, styling, utility');
    }

    // Type-specific validation
    if (metadata.type === 'framework') {
      const frameworkExt = extension as FrameworkExtension;
      if (
        !frameworkExt.framework ||
        !['react', 'vue', 'svelte'].includes(frameworkExt.framework)
      ) {
        errors.push(
          'Framework extension must specify a valid framework: "react", "vue", or "svelte"'
        );
      }

      // Check required methods
      const requiredMethods = [
        'processEvents',
        'processConditionals',
        'processIterations',
        'processSlots',
        'processAttributes',
        'renderComponent',
      ];
      for (const method of requiredMethods) {
        if (typeof (frameworkExt as any)[method] !== 'function') {
          errors.push(`Framework extension must implement method: ${method}`);
        }
      }
    }

    if (metadata.type === 'styling') {
      const stylingExt = extension as StylingExtension;
      if (
        !stylingExt.styling ||
        !['bem', 'tailwind', 'css-modules', 'styled-components'].includes(
          stylingExt.styling
        )
      ) {
        warnings.push(
          'Styling extension should specify a valid styling approach'
        );
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
      warnings,
    };
  }
}
