import { describe, it, expect } from 'vitest';
import { ConfigValidator, ConfigValidationResult } from '../../src/validation/config';

describe('Config Validation', () => {
  describe('ConfigValidator.validate', () => {
    describe('valid configurations', () => {
      it('should accept minimal valid config', () => {
        const config = {
          name: 'my-ui-kit',
          version: '1.0.0',
          capabilities: {
            frameworks: ['react'],
            styling: ['css'],
            typescript: true
          }
        };

        const result = ConfigValidator.validate(config);
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should accept full valid config with components and conflict resolution', () => {
        const config = {
          name: 'design-system',
          version: '2.1.0',
          capabilities: {
            frameworks: ['react', 'vue'],
            styling: ['css', 'scss', 'inline'],
            typescript: true
          },
          components: {
            button: {
              frameworks: ['react', 'vue'],
              styling: ['css', 'scss'],
              description: 'A customizable button component'
            }
          },
          conflictResolution: {
            default: 'prompt',
            allowDiff: true,
            allowMerge: true,
            createBackups: true
          }
        };

        const result = ConfigValidator.validate(config);
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should accept config with all supported frameworks and styling', () => {
        const config = {
          name: 'comprehensive-ui',
          version: '1.0.0',
          capabilities: {
            frameworks: ['react', 'vue'],
            styling: ['css', 'scss', 'inline'],
            typescript: false
          }
        };

        const result = ConfigValidator.validate(config);
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      });
    });

    describe('invalid configurations - basic structure', () => {
      it('should reject null/undefined config', () => {
        expect(ConfigValidator.validate(null).isValid).toBe(false);
        expect(ConfigValidator.validate(undefined).isValid).toBe(false);
        expect(ConfigValidator.validate(null).errors).toContain('Configuration is required');
      });

      it('should reject missing required fields', () => {
        const config = {};
        const result = ConfigValidator.validate(config);
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Config missing required field: name');
        expect(result.errors).toContain('Config missing required field: version');
        expect(result.errors).toContain('Config missing required field: capabilities');
      });

      it('should reject invalid field types', () => {
        const config = {
          name: 123,
          version: true,
          capabilities: 'invalid'
        };

        const result = ConfigValidator.validate(config);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Config name must be a string');
        expect(result.errors).toContain('Config version must be a string');
        expect(result.errors).toContain('Config capabilities must be an object');
      });

      it('should reject empty name', () => {
        const config = {
          name: '',
          version: '1.0.0',
          capabilities: { frameworks: ['react'], styling: ['css'] }
        };

        const result = ConfigValidator.validate(config);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Config missing required field: name');
      });

      it('should warn about non-semver version', () => {
        const config = {
          name: 'test-kit',
          version: 'v1.0',
          capabilities: { frameworks: ['react'], styling: ['css'] }
        };

        const result = ConfigValidator.validate(config);
        expect(result.isValid).toBe(true); // Warning, not error
        expect(result.warnings).toContain('Config version should follow semver format (e.g., "1.0.0")');
      });
    });

    describe('capabilities validation', () => {
      it('should reject missing frameworks', () => {
        const config = {
          name: 'test-kit',
          version: '1.0.0',
          capabilities: {
            styling: ['css']
          }
        };

        const result = ConfigValidator.validate(config);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Capabilities missing required field: frameworks');
      });

      it('should reject empty frameworks array', () => {
        const config = {
          name: 'test-kit',
          version: '1.0.0',
          capabilities: {
            frameworks: [],
            styling: ['css']
          }
        };

        const result = ConfigValidator.validate(config);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('At least one framework must be specified');
      });

      it('should reject invalid frameworks', () => {
        const config = {
          name: 'test-kit',
          version: '1.0.0',
          capabilities: {
            frameworks: ['react', 'invalid-framework', 'flutter'],
            styling: ['css']
          }
        };

        const result = ConfigValidator.validate(config);
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('Invalid frameworks: invalid-framework, flutter');
        expect(result.errors[0]).toContain('Valid options: react, vue');
      });

      it('should accept valid styling options including BEM', () => {
        const config = {
          name: 'test-kit',
          version: '1.0.0',
          capabilities: {
            frameworks: ['react'],
            styling: ['css', 'scss', 'inline', 'bem']
          }
        };

        const result = ConfigValidator.validate(config);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject invalid styling options', () => {
        const config = {
          name: 'test-kit',
          version: '1.0.0',
          capabilities: {
            frameworks: ['react'],
            styling: ['css', 'invalid-style', 'emotion']
          }
        };

        const result = ConfigValidator.validate(config);
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('Invalid styling options: invalid-style, emotion');
      });

      it('should reject non-boolean typescript flag', () => {
        const config = {
          name: 'test-kit',
          version: '1.0.0',
          capabilities: {
            frameworks: ['react'],
            styling: ['css'],
            typescript: 'yes'
          }
        };

        const result = ConfigValidator.validate(config);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Capabilities typescript must be a boolean');
      });
    });

    describe('components validation', () => {
      it('should reject invalid component names', () => {
        const config = {
          name: 'test-kit',
          version: '1.0.0',
          capabilities: {
            frameworks: ['react'],
            styling: ['css']
          },
          components: {
            'Button': {}, // Should be lowercase
            'my-Component': {}, // Mixed case
            'my_component': {}, // Underscore not allowed
            '123button': {} // Cannot start with number
          }
        };

        const result = ConfigValidator.validate(config);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Component name "Button" must be lowercase and kebab-case');
        expect(result.errors).toContain('Component name "my-Component" must be lowercase and kebab-case');
        expect(result.errors).toContain('Component name "my_component" must be lowercase and kebab-case');
        expect(result.errors).toContain('Component name "123button" must be lowercase and kebab-case');
      });

      it('should accept valid component names', () => {
        const config = {
          name: 'test-kit',
          version: '1.0.0',
          capabilities: {
            frameworks: ['react'],
            styling: ['css']
          },
          components: {
            'button': {},
            'nav-bar': {},
            'form-input': {},
            'card123': {},
            'button-': {} // Actually valid according to the regex
          }
        };

        const result = ConfigValidator.validate(config);
        expect(result.isValid).toBe(true);
      });

      it('should validate component-specific overrides', () => {
        const config = {
          name: 'test-kit',
          version: '1.0.0',
          capabilities: {
            frameworks: ['react', 'vue'],
            styling: ['css', 'scss']
          },
          components: {
            button: {
              frameworks: ['react', 'invalid-framework'],
              styling: ['css', 'invalid-style'],
              description: 123 // Should be string
            }
          }
        };

        const result = ConfigValidator.validate(config);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Component "button" has invalid frameworks: invalid-framework');
        expect(result.errors).toContain('Component "button" has invalid styling: invalid-style');
        expect(result.errors).toContain('Component "button" description must be a string');
      });
    });

    describe('conflict resolution validation', () => {
      it('should accept valid conflict resolution config', () => {
        const config = {
          name: 'test-kit',
          version: '1.0.0',
          capabilities: {
            frameworks: ['react'],
            styling: ['css']
          },
          conflictResolution: {
            default: 'prompt',
            allowDiff: true,
            allowMerge: false,
            createBackups: true
          }
        };

        const result = ConfigValidator.validate(config);
        expect(result.isValid).toBe(true);
      });

      it('should reject invalid default values', () => {
        const config = {
          name: 'test-kit',
          version: '1.0.0',
          capabilities: {
            frameworks: ['react'],
            styling: ['css']
          },
          conflictResolution: {
            default: 'invalid-option'
          }
        };

        const result = ConfigValidator.validate(config);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('ConflictResolution default must be one of: prompt, overwrite, skip');
      });

      it('should reject non-boolean flags', () => {
        const config = {
          name: 'test-kit',
          version: '1.0.0',
          capabilities: {
            frameworks: ['react'],
            styling: ['css']
          },
          conflictResolution: {
            allowDiff: 'yes',
            allowMerge: 1,
            createBackups: 'false'
          }
        };

        const result = ConfigValidator.validate(config);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('ConflictResolution allowDiff must be a boolean');
        expect(result.errors).toContain('ConflictResolution allowMerge must be a boolean');
        expect(result.errors).toContain('ConflictResolution createBackups must be a boolean');
      });
    });
  });

  describe('ConfigValidator.validateConfigFile', () => {
    it('should add file context to error messages', () => {
      const config = { name: 123 };
      const result = ConfigValidator.validateConfigFile('create-ui-kit.config.js', config);
      
      expect(result.errors[0]).toContain('In create-ui-kit.config.js:');
      expect(result.errors[0]).toContain('Config name must be a string');
    });
  });

  describe('ConfigValidator.validateOrThrow', () => {
    it('should throw on invalid config', () => {
      const config = {};
      
      expect(() => {
        ConfigValidator.validateOrThrow(config);
      }).toThrow('Configuration validation failed:');
    });

    it('should not throw on valid config', () => {
      const config = {
        name: 'test-kit',
        version: '1.0.0',
        capabilities: {
          frameworks: ['react'],
          styling: ['css']
        }
      };
      
      expect(() => {
        ConfigValidator.validateOrThrow(config);
      }).not.toThrow();
    });
  });
});