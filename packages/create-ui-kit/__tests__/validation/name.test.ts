import { describe, it, expect } from 'vitest';
import { validateProjectName } from '../../src/validation/name';

describe('Name Validation', () => {
  describe('validateProjectName', () => {
    describe('valid names', () => {
      it('should accept valid project names', () => {
        expect(validateProjectName('my-ui-kit')).toBe(true);
        expect(validateProjectName('awesome-components')).toBe(true);
        expect(validateProjectName('ui-components-2024')).toBe(true);
        expect(validateProjectName('design-system')).toBe(true);
        expect(validateProjectName('my_ui_kit')).toBe(true);
        expect(validateProjectName('components123')).toBe(true);
      });

      it('should accept names with mixed hyphens and underscores', () => {
        expect(validateProjectName('my-ui_kit')).toBe(true);
        expect(validateProjectName('design-system_v2')).toBe(true);
      });

      it('should accept numeric names', () => {
        expect(validateProjectName('ui2024')).toBe(true);
        expect(validateProjectName('v2-components')).toBe(true);
      });
    });

    describe('invalid names - empty/short', () => {
      it('should reject empty names', () => {
        expect(validateProjectName('')).toBe('Project name is required');
        expect(validateProjectName('   ')).toBe('Project name can only contain lowercase letters, numbers, hyphens, and underscores');
      });

      it('should reject names that are too short', () => {
        expect(validateProjectName('a')).toBe('Project name must be at least 2 characters');
      });

      it('should reject names that are too long', () => {
        const longName = 'a'.repeat(215);
        expect(validateProjectName(longName)).toBe('Project name must be less than 214 characters');
      });
    });

    describe('invalid names - case', () => {
      it('should reject uppercase names', () => {
        expect(validateProjectName('MyUIKit')).toBe('Project name must be lowercase');
        expect(validateProjectName('MY-UI-KIT')).toBe('Project name must be lowercase');
        expect(validateProjectName('My-Components')).toBe('Project name must be lowercase');
      });

      it('should reject mixed case names', () => {
        expect(validateProjectName('my-UI-kit')).toBe('Project name must be lowercase');
        expect(validateProjectName('designSystem')).toBe('Project name must be lowercase');
      });
    });

    describe('invalid names - characters', () => {
      it('should reject special characters', () => {
        expect(validateProjectName('my@ui-kit')).toBe('Project name can only contain lowercase letters, numbers, hyphens, and underscores');
        expect(validateProjectName('ui-kit!')).toBe('Project name can only contain lowercase letters, numbers, hyphens, and underscores');
        expect(validateProjectName('my.ui.kit')).toBe('Project name can only contain lowercase letters, numbers, hyphens, and underscores');
        expect(validateProjectName('ui kit')).toBe('Project name can only contain lowercase letters, numbers, hyphens, and underscores');
      });

      it('should reject names starting with invalid characters', () => {
        expect(validateProjectName('-my-ui-kit')).toBe('Project name cannot start with a hyphen or underscore');
        expect(validateProjectName('_my-ui-kit')).toBe('Project name cannot start with a hyphen or underscore');
      });

      it('should reject names ending with invalid characters', () => {
        expect(validateProjectName('my-ui-kit-')).toBe('Project name cannot end with a hyphen or underscore');
        expect(validateProjectName('my-ui-kit_')).toBe('Project name cannot end with a hyphen or underscore');
      });
    });

    describe('reserved names', () => {
      it('should reject reserved system names', () => {
        expect(validateProjectName('node_modules')).toBe('"node_modules" is a reserved name and cannot be used');
        // .git fails the regex check first (contains '.')
        expect(validateProjectName('.git')).toBe('Project name can only contain lowercase letters, numbers, hyphens, and underscores');
        // package.json fails the regex check first (contains '.')
        expect(validateProjectName('package.json')).toBe('Project name can only contain lowercase letters, numbers, hyphens, and underscores');
      });

      it('should reject reserved names that pass other validations', () => {
        // These names pass all other validations but are reserved
        expect(validateProjectName('readme')).toBe('"readme" is a reserved name and cannot be used');
        expect(validateProjectName('license')).toBe('"license" is a reserved name and cannot be used');
        expect(validateProjectName('changelog')).toBe('"changelog" is a reserved name and cannot be used');
      });

      it('should reject uppercase names (which prevents reserved name check)', () => {
        // These fail the lowercase check first
        expect(validateProjectName('README')).toBe('Project name must be lowercase');
        expect(validateProjectName('License')).toBe('Project name must be lowercase');
        expect(validateProjectName('CHANGELOG')).toBe('Project name must be lowercase');
      });
    });

    describe('edge cases', () => {
      it('should handle minimum valid length', () => {
        expect(validateProjectName('ab')).toBe(true);
        expect(validateProjectName('a1')).toBe(true);
      });

      it('should handle maximum valid length', () => {
        const maxValidName = 'a'.repeat(214);
        expect(validateProjectName(maxValidName)).toBe(true);
      });

      it('should handle numeric-only names', () => {
        expect(validateProjectName('123')).toBe(true);
        expect(validateProjectName('2024')).toBe(true);
      });
    });
  });
});