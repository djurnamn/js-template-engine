import { UIKitConfig } from '../types';

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class ConfigValidator {
  /**
   * Validates a UI kit configuration object
   */
  static validate(config: any): ConfigValidationResult {
    const result: ConfigValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    if (!config) {
      result.errors.push('Configuration is required');
      result.isValid = false;
      return result;
    }

    // Validate top-level structure
    ConfigValidator.validateBasicStructure(config, result);

    if (result.isValid) {
      ConfigValidator.validateCapabilities(config.capabilities, result);
      ConfigValidator.validateComponents(config.components, result);
      ConfigValidator.validateConflictResolution(
        config.conflictResolution,
        result
      );
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  private static validateBasicStructure(
    config: any,
    result: ConfigValidationResult
  ): void {
    // Required fields
    if (!config.name) {
      result.errors.push('Config missing required field: name');
    } else if (typeof config.name !== 'string') {
      result.errors.push('Config name must be a string');
    } else if (config.name.length === 0) {
      result.errors.push('Config name cannot be empty');
    }

    if (!config.version) {
      result.errors.push('Config missing required field: version');
    } else if (typeof config.version !== 'string') {
      result.errors.push('Config version must be a string');
    } else if (!/^\d+\.\d+\.\d+/.test(config.version)) {
      result.warnings.push(
        'Config version should follow semver format (e.g., "1.0.0")'
      );
    }

    if (!config.capabilities) {
      result.errors.push('Config missing required field: capabilities');
    } else if (typeof config.capabilities !== 'object') {
      result.errors.push('Config capabilities must be an object');
    }

    // Optional but should be objects if present
    if (config.components && typeof config.components !== 'object') {
      result.errors.push('Config components must be an object');
    }

    if (
      config.conflictResolution &&
      typeof config.conflictResolution !== 'object'
    ) {
      result.errors.push('Config conflictResolution must be an object');
    }
  }

  private static validateCapabilities(
    capabilities: any,
    result: ConfigValidationResult
  ): void {
    if (!capabilities) return;

    // Validate frameworks
    if (!capabilities.frameworks) {
      result.errors.push('Capabilities missing required field: frameworks');
    } else if (!Array.isArray(capabilities.frameworks)) {
      result.errors.push('Capabilities frameworks must be an array');
    } else if (capabilities.frameworks.length === 0) {
      result.errors.push('At least one framework must be specified');
    } else {
      const validFrameworks = ['react', 'vue'];
      const invalidFrameworks = capabilities.frameworks.filter(
        (fw: any) => typeof fw !== 'string' || !validFrameworks.includes(fw)
      );
      if (invalidFrameworks.length > 0) {
        result.errors.push(
          `Invalid frameworks: ${invalidFrameworks.join(
            ', '
          )}. Valid options: ${validFrameworks.join(', ')}`
        );
      }
    }

    // Validate styling
    if (!capabilities.styling) {
      result.errors.push('Capabilities missing required field: styling');
    } else if (!Array.isArray(capabilities.styling)) {
      result.errors.push('Capabilities styling must be an array');
    } else if (capabilities.styling.length === 0) {
      result.errors.push('At least one styling approach must be specified');
    } else {
      const validStyling = ['css', 'scss', 'inline', 'bem'];
      const invalidStyling = capabilities.styling.filter(
        (style: any) =>
          typeof style !== 'string' || !validStyling.includes(style)
      );
      if (invalidStyling.length > 0) {
        result.errors.push(
          `Invalid styling options: ${invalidStyling.join(
            ', '
          )}. Valid options: ${validStyling.join(', ')}`
        );
      }
    }

    // Validate TypeScript flag
    if (
      capabilities.typescript !== undefined &&
      typeof capabilities.typescript !== 'boolean'
    ) {
      result.errors.push('Capabilities typescript must be a boolean');
    }
  }

  private static validateComponents(
    components: any,
    result: ConfigValidationResult
  ): void {
    if (!components) return;

    if (typeof components !== 'object') {
      result.errors.push('Components must be an object');
      return;
    }

    Object.entries(components).forEach(([componentName, componentConfig]) => {
      ConfigValidator.validateComponentConfig(
        componentName,
        componentConfig,
        result
      );
    });
  }

  private static validateComponentConfig(
    name: string,
    config: any,
    result: ConfigValidationResult
  ): void {
    if (typeof name !== 'string') {
      result.errors.push('Component names must be strings');
      return;
    }

    if (!/^[a-z][a-z0-9-]*$/.test(name)) {
      result.errors.push(
        `Component name "${name}" must be lowercase and kebab-case`
      );
    }

    if (config && typeof config === 'object') {
      // Validate component-specific overrides
      if (config.frameworks) {
        if (!Array.isArray(config.frameworks)) {
          result.errors.push(`Component "${name}" frameworks must be an array`);
        } else {
          const validFrameworks = ['react', 'vue'];
          const invalidFrameworks = config.frameworks.filter(
            (fw: any) => typeof fw !== 'string' || !validFrameworks.includes(fw)
          );
          if (invalidFrameworks.length > 0) {
            result.errors.push(
              `Component "${name}" has invalid frameworks: ${invalidFrameworks.join(
                ', '
              )}`
            );
          }
        }
      }

      if (config.styling) {
        if (!Array.isArray(config.styling)) {
          result.errors.push(`Component "${name}" styling must be an array`);
        } else {
          const validStyling = ['css', 'scss', 'inline', 'bem'];
          const invalidStyling = config.styling.filter(
            (style: any) =>
              typeof style !== 'string' || !validStyling.includes(style)
          );
          if (invalidStyling.length > 0) {
            result.errors.push(
              `Component "${name}" has invalid styling: ${invalidStyling.join(
                ', '
              )}`
            );
          }
        }
      }

      if (config.description && typeof config.description !== 'string') {
        result.errors.push(`Component "${name}" description must be a string`);
      }
    }
  }

  private static validateConflictResolution(
    conflictResolution: any,
    result: ConfigValidationResult
  ): void {
    if (!conflictResolution) return;

    if (typeof conflictResolution !== 'object') {
      result.errors.push('ConflictResolution must be an object');
      return;
    }

    if (conflictResolution.default) {
      const validDefaults = ['prompt', 'overwrite', 'skip'];
      if (!validDefaults.includes(conflictResolution.default)) {
        result.errors.push(
          `ConflictResolution default must be one of: ${validDefaults.join(
            ', '
          )}`
        );
      }
    }

    // Validate boolean flags
    ['allowDiff', 'allowMerge', 'createBackups'].forEach((flag) => {
      if (
        conflictResolution[flag] !== undefined &&
        typeof conflictResolution[flag] !== 'boolean'
      ) {
        result.errors.push(`ConflictResolution ${flag} must be a boolean`);
      }
    });
  }

  /**
   * Validates a configuration file and provides helpful error messages
   */
  static validateConfigFile(
    configPath: string,
    config: any
  ): ConfigValidationResult {
    const result = ConfigValidator.validate(config);

    // Add file-specific context to errors
    result.errors = result.errors.map((error) => `In ${configPath}: ${error}`);
    result.warnings = result.warnings.map(
      (warning) => `In ${configPath}: ${warning}`
    );

    return result;
  }

  /**
   * Quick validation that throws on error
   */
  static validateOrThrow(config: any, configPath?: string): void {
    const result = configPath
      ? ConfigValidator.validateConfigFile(configPath, config)
      : ConfigValidator.validate(config);

    if (!result.isValid) {
      const errorMessage = result.errors.join('\n');
      throw new Error(`Configuration validation failed:\n${errorMessage}`);
    }

    // Log warnings if present
    if (result.warnings.length > 0) {
      console.warn('⚠️  Configuration warnings:');
      result.warnings.forEach((warning) => console.warn(`   ${warning}`));
      console.warn('');
    }
  }
}
