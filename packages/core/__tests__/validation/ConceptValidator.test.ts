/**
 * Tests for ConceptValidator - Comprehensive Concept Validation
 */

import { ConceptValidator } from '../../src/validation/ConceptValidator';
import { ErrorCollector } from '../../src/metadata';
import type { ValidationOptions } from '../../src/validation/ConceptValidator';

describe('ConceptValidator', () => {
  let validator: ConceptValidator;
  let errorCollector: ErrorCollector;

  beforeEach(() => {
    errorCollector = new ErrorCollector();
    validator = new ConceptValidator(errorCollector);
  });

  describe('Event Validation', () => {
    it('should validate event concepts', () => {
      const events = [
        {
          nodeId: 'button-1',
          name: 'click',
          handler: 'handleClick',
          frameworkAttribute: 'onClick'
        },
        {
          nodeId: 'input-1', 
          name: 'change',
          handler: '', // Empty handler - should warn
          frameworkAttribute: 'onChange'
        }
      ];

      const options: ValidationOptions = {
        framework: 'react',
        checkAccessibility: true
      };

      const result = validator.validateEvents(events, options);

      expect(result.isValid).toBe(true); // Valid overall, just warnings
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('empty handler');
      expect(result.score).toBeLessThan(1.0);
    });

    it('should suggest accessible alternatives', () => {
      const events = [
        {
          nodeId: 'div-1',
          name: 'click', 
          handler: 'handleClick',
          frameworkAttribute: 'onClick',
          elementTag: 'div' // Non-interactive element with click handler
        }
      ];

      const result = validator.validateEvents(events, {
        framework: 'react',
        checkAccessibility: true
      });

      expect(result.suggestions).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('use button or add role'),
          severity: 'warning'
        })
      );
    });

    it('should validate framework compatibility', () => {
      const events = [
        {
          nodeId: 'button-1',
          name: 'click',
          handler: 'handleClick',
          frameworkAttribute: '@click', // Vue syntax
          originalFramework: 'vue'
        }
      ];

      const result = validator.validateEvents(events, {
        framework: 'react' // But validating for React
      });

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('framework mismatch')
        })
      );
    });
  });

  describe('Styling Validation', () => {
    it('should validate styling concepts', () => {
      const styling = {
        nodeId: 'component-1',
        staticClasses: ['btn', 'btn-primary'],
        dynamicClasses: ['isActive ? "active" : ""'],
        inlineStyles: {
          color: 'red',
          'background-color': '#ffffff'
        },
        styleBindings: {}
      };

      const result = validator.validateStyling(styling, {
        framework: 'react',
        validateCSS: true
      });

      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThan(0.8);
    });

    it('should detect invalid CSS properties', () => {
      const styling = {
        nodeId: 'component-1',
        staticClasses: [],
        dynamicClasses: [],
        inlineStyles: {
          'invalid-property': 'value',
          color: 'invalid-color-value'
        },
        styleBindings: {}
      };

      const result = validator.validateStyling(styling, {
        framework: 'react',
        validateCSS: true
      });

      expect(result.warnings).toHaveLength(2);
      expect(result.warnings[0].message).toContain('invalid CSS property');
      expect(result.warnings[1].message).toContain('invalid color value');
    });

    it('should suggest performance improvements', () => {
      const styling = {
        nodeId: 'component-1',
        staticClasses: [],
        dynamicClasses: [],
        inlineStyles: {
          // Many inline styles - should suggest external CSS
          margin: '10px',
          padding: '20px',
          backgroundColor: 'blue',
          color: 'white',
          fontSize: '16px',
          fontWeight: 'bold',
          border: '1px solid black'
        },
        styleBindings: {}
      };

      const result = validator.validateStyling(styling, {
        framework: 'react',
        checkPerformance: true
      });

      expect(result.suggestions).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('consider external CSS')
        })
      );
    });
  });

  describe('Conditional Validation', () => {
    it('should validate conditional concepts', () => {
      const conditionals = [
        {
          nodeId: 'if-1',
          condition: 'user.isLoggedIn',
          consequent: ['Welcome user'],
          alternate: ['Please log in']
        },
        {
          nodeId: 'if-2',
          condition: '', // Empty condition - should error
          consequent: ['Content'],
          alternate: []
        }
      ];

      const result = validator.validateConditionals(conditionals, {
        framework: 'react'
      });

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('empty condition')
        })
      );
    });

    it('should suggest simplifications for complex conditions', () => {
      const conditionals = [
        {
          nodeId: 'if-1',
          condition: 'user && user.profile && user.profile.settings && user.profile.settings.theme === "dark"',
          consequent: ['Dark theme content'],
          alternate: ['Light theme content']
        }
      ];

      const result = validator.validateConditionals(conditionals, {
        framework: 'react',
        checkBestPractices: true
      });

      expect(result.suggestions).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('consider optional chaining')
        })
      );
    });
  });

  describe('Iteration Validation', () => {
    it('should validate iteration concepts', () => {
      const iterations = [
        {
          nodeId: 'loop-1',
          items: 'users',
          item: 'user',
          key: 'user.id',
          index: 'index'
        },
        {
          nodeId: 'loop-2',
          items: 'items',
          item: 'item',
          key: '', // Missing key - should warn for performance
          index: undefined
        }
      ];

      const result = validator.validateIterations(iterations, {
        framework: 'react',
        checkPerformance: true
      });

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('missing key')
        })
      );
    });

    it('should validate key uniqueness patterns', () => {
      const iterations = [
        {
          nodeId: 'loop-1',
          items: 'users',
          item: 'user',
          key: 'index', // Using index as key - should warn
          index: 'index'
        }
      ];

      const result = validator.validateIterations(iterations, {
        framework: 'react',
        checkBestPractices: true
      });

      expect(result.suggestions).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('avoid using index as key')
        })
      );
    });
  });

  describe('Slot Validation', () => {
    it('should validate slot concepts', () => {
      const slots = [
        {
          nodeId: 'slot-1',
          name: 'header',
          fallback: ['Default header'],
          props: { title: 'string' }
        },
        {
          nodeId: 'slot-2',
          name: '', // Unnamed slot
          fallback: [],
          props: {}
        }
      ];

      const result = validator.validateSlots(slots, {
        framework: 'vue'
      });

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(0); // Unnamed slots are valid
    });

    it('should detect slot name conflicts', () => {
      const slots = [
        {
          nodeId: 'slot-1',
          name: 'content',
          fallback: ['Fallback 1'],
          props: {}
        },
        {
          nodeId: 'slot-2',
          name: 'content', // Duplicate name
          fallback: ['Fallback 2'],
          props: {}
        }
      ];

      const result = validator.validateSlots(slots, {
        framework: 'vue'
      });

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('duplicate slot name')
        })
      );
    });
  });

  describe('Cross-Concept Validation', () => {
    it('should validate concept consistency', () => {
      const concepts = {
        events: [
          {
            nodeId: 'button-1',
            name: 'click',
            handler: 'handleSubmit'
          }
        ],
        styling: {
          nodeId: 'button-1',
          staticClasses: ['btn', 'btn-submit']
        },
        conditionals: [],
        iterations: [],
        slots: [],
        attributes: []
      };

      const result = validator.validateConceptConsistency(concepts, {
        framework: 'react',
        enableCrossConceptValidation: true
      });

      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThan(0.9);
    });

    it('should detect semantic mismatches', () => {
      const concepts = {
        events: [
          {
            nodeId: 'button-1',
            name: 'click',
            handler: 'handleCancel' // Cancel handler
          }
        ],
        styling: {
          nodeId: 'button-1',
          staticClasses: ['btn-primary', 'btn-success'] // But success styling
        },
        conditionals: [],
        iterations: [],
        slots: [],
        attributes: []
      };

      const result = validator.validateConceptConsistency(concepts, {
        framework: 'react',
        enableCrossConceptValidation: true
      });

      expect(result.suggestions).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('semantic mismatch')
        })
      );
    });
  });

  describe('Validation Scoring', () => {
    it('should calculate validation scores', () => {
      const events = [
        {
          nodeId: 'button-1',
          name: 'click',
          handler: 'handleClick',
          frameworkAttribute: 'onClick'
        }
      ];

      const result = validator.validateEvents(events, {
        framework: 'react'
      });

      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('should reduce score for warnings', () => {
      const events = [
        {
          nodeId: 'button-1',
          name: 'click',
          handler: '', // Empty handler
          frameworkAttribute: 'onClick'
        }
      ];

      const result = validator.validateEvents(events, {
        framework: 'react'
      });

      expect(result.score).toBeLessThan(0.8); // Penalty for warning
    });
  });

  describe('Error Collection', () => {
    it('should collect validation errors', () => {
      const events = [
        {
          nodeId: 'button-1',
          name: 'invalid-event',
          handler: 'handleClick',
          frameworkAttribute: 'onInvalid'
        }
      ];

      validator.validateEvents(events, {
        framework: 'react',
        strictValidation: true
      });

      expect(errorCollector.hasWarnings()).toBe(true);
    });

    it('should provide actionable suggestions', () => {
      const styling = {
        nodeId: 'component-1',
        staticClasses: [],
        dynamicClasses: [],
        inlineStyles: {
          color: '#ff0000',
          backgroundColor: '#ff0000' // Same as text color - accessibility issue
        },
        styleBindings: {}
      };

      const result = validator.validateStyling(styling, {
        framework: 'react',
        checkAccessibility: true
      });

      expect(result.suggestions).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('insufficient color contrast'),
          actionable: true
        })
      );
    });
  });
});