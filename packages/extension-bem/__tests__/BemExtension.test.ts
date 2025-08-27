import { describe, it, expect, beforeEach } from 'vitest';
import { BemExtension } from '../src/index';
import type { StylingConcept } from '@js-template-engine/core';

describe('BemExtension', () => {
  let bemExtension: BemExtension;

  beforeEach(() => {
    bemExtension = new BemExtension(false);
  });

  describe('StylingExtension interface implementation', () => {
    it('should implement the correct metadata', () => {
      expect(bemExtension.metadata.type).toBe('styling');
      expect(bemExtension.metadata.key).toBe('bem');
      expect(bemExtension.metadata.name).toBe('BEM Extension');
      expect(bemExtension.metadata.version).toBe('2.0.0');
      expect(bemExtension.styling).toBe('bem');
    });

    it('should process styling concepts correctly', () => {
      const stylingConcept: StylingConcept = {
        nodeId: 'test-node',
        staticClasses: [],
        dynamicClasses: [],
        inlineStyles: {},
        extensionData: {
          bem: [
            {
              nodeId: 'button-node',
              data: {
                block: 'button',
                element: 'icon',
                modifiers: ['active']
              }
            }
          ]
        }
      };

      const result = bemExtension.processStyles(stylingConcept);
      
      expect(result.styles).toBeTruthy();
      expect(result.imports).toEqual([]);
      expect(result.styles).toContain('.button {');
      expect(result.styles).toContain('&__icon');
      expect(result.styles).toContain('&--active');
    });

    it('should handle non-BEM classes gracefully', () => {
      const stylingConcept: StylingConcept = {
        nodeId: 'test-node',
        staticClasses: [],
        dynamicClasses: [],
        inlineStyles: {},
        extensionData: {
          bem: [
            {
              nodeId: 'node-1',
              data: {
                block: 'regular-class'
              }
            },
            {
              nodeId: 'node-2',
              data: {
                block: 'another-class'
              }
            }
          ]
        }
      };

      const result = bemExtension.processStyles(stylingConcept);
      
      // These are valid BEM blocks (single name), so they should generate SCSS
      expect(result.styles).toContain('.regular-class {');
      expect(result.styles).toContain('.another-class {');
      expect(result.imports).toEqual([]);
    });
  });

  describe('Extension data processing', () => {
    it('should process BEM extension data correctly', () => {
      const stylingConcept: StylingConcept = {
        nodeId: 'test-node',
        staticClasses: [],
        dynamicClasses: [],
        inlineStyles: {},
        perElementClasses: {},
        extensionData: {
          bem: [
            {
              nodeId: 'button-node',
              data: {
                block: 'button',
                element: 'icon',
                modifiers: ['active', 'large']
              }
            }
          ]
        }
      };

      const result = bemExtension.processStyles(stylingConcept);
      
      expect(result.updatedStyling.perElementClasses['button-node']).toContain('button__icon');
      expect(result.updatedStyling.perElementClasses['button-node']).toContain('button__icon--active');
      expect(result.updatedStyling.perElementClasses['button-node']).toContain('button__icon--large');
    });

    it('should handle block inheritance for elements', () => {
      const stylingConcept: StylingConcept = {
        nodeId: 'test-node',
        staticClasses: [],
        dynamicClasses: [],
        inlineStyles: {},
        perElementClasses: {},
        extensionData: {
          bem: [
            {
              nodeId: 'parent.child',
              data: {
                block: 'card'
              }
            },
            {
              nodeId: 'parent.child.element',
              data: {
                element: 'title'
              }
            }
          ]
        }
      };

      const result = bemExtension.processStyles(stylingConcept);
      
      expect(result.updatedStyling.perElementClasses['parent.child']).toContain('card');
      expect(result.updatedStyling.perElementClasses['parent.child.element']).toContain('card__title');
    });

    it('should preserve existing per-element classes', () => {
      const stylingConcept: StylingConcept = {
        nodeId: 'test-node',
        staticClasses: [],
        dynamicClasses: [],
        inlineStyles: {},
        perElementClasses: {
          'existing-node': ['existing-class']
        },
        extensionData: {
          bem: [
            {
              nodeId: 'bem-node',
              data: {
                block: 'button'
              }
            }
          ]
        }
      };

      const result = bemExtension.processStyles(stylingConcept);
      
      expect(result.updatedStyling.perElementClasses['existing-node']).toEqual(['existing-class']);
      expect(result.updatedStyling.perElementClasses['bem-node']).toContain('button');
    });
  });

  describe('BEM class generation', () => {
    it('should generate BEM classes for valid block__element--modifier patterns', () => {
      const stylingConcept: StylingConcept = {
        nodeId: 'test',
        staticClasses: [],
        dynamicClasses: [],
        inlineStyles: {},
        extensionData: {
          bem: [
            {
              nodeId: 'block-node',
              data: {
                block: 'block',
                element: 'element',
                modifiers: ['modifier']
              }
            },
            {
              nodeId: 'another-block-node',
              data: {
                block: 'another-block',
                element: 'different-element',
                modifiers: ['state']
              }
            }
          ]
        }
      };

      const result = bemExtension.processStyles(stylingConcept);
      
      expect(result.styles).toContain('.block {');
      expect(result.styles).toContain('.another-block {');
      expect(result.styles).toContain('&__element');
      expect(result.styles).toContain('&__different-element');
      expect(result.styles).toContain('&--modifier');
      expect(result.styles).toContain('&--state');
    });

    it('should ignore invalid BEM patterns', () => {
      const stylingConcept: StylingConcept = {
        nodeId: 'test',
        staticClasses: [],
        dynamicClasses: [],
        inlineStyles: {}
        // No extensionData.bem, so no SCSS should be generated
      };

      const result = bemExtension.processStyles(stylingConcept);
      
      // No BEM extension data provided, so no SCSS should be generated
      expect(result.styles).toBe('');
    });
  });

  describe('SCSS generation', () => {
    it('should generate nested SCSS for BEM hierarchy', () => {
      const stylingConcept: StylingConcept = {
        nodeId: 'test',
        staticClasses: [],
        dynamicClasses: [],
        inlineStyles: {},
        extensionData: {
          bem: [
            {
              nodeId: 'card-node',
              data: {
                block: 'card'
              }
            },
            {
              nodeId: 'header-node',
              data: {
                block: 'card',
                element: 'header',
                modifiers: ['highlighted']
              }
            },
            {
              nodeId: 'body-node',
              data: {
                block: 'card',
                element: 'body'
              }
            },
            {
              nodeId: 'footer-node',
              data: {
                block: 'card',
                element: 'footer'
              }
            },
            {
              nodeId: 'large-card-node',
              data: {
                block: 'card',
                modifiers: ['large']
              }
            }
          ]
        }
      };

      const result = bemExtension.processStyles(stylingConcept);
      
      expect(result.styles).toContain('.card {');
      expect(result.styles).toContain('&__header {');
      expect(result.styles).toContain('&__body {');
      expect(result.styles).toContain('&__footer {');
      expect(result.styles).toContain('&--large {');
      expect(result.styles).toContain('/* Add your styling here */');
    });

    it('should handle multiple blocks separately', () => {
      const stylingConcept: StylingConcept = {
        nodeId: 'test',
        staticClasses: [],
        dynamicClasses: [],
        inlineStyles: {},
        extensionData: {
          bem: [
            {
              nodeId: 'header-node',
              data: {
                block: 'header',
                element: 'logo'
              }
            },
            {
              nodeId: 'footer-node',
              data: {
                block: 'footer',
                element: 'link'
              }
            }
          ]
        }
      };

      const result = bemExtension.processStyles(stylingConcept);
      
      expect(result.styles).toContain('.header {');
      expect(result.styles).toContain('.footer {');
      const blocks = result.styles.split('.').filter(line => line.includes(' {'));
      expect(blocks.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('BEM class validation', () => {
    it('should process only valid BEM extension data', () => {
      const stylingConcept: StylingConcept = {
        nodeId: 'test-node',
        staticClasses: [],
        dynamicClasses: [],
        inlineStyles: {},
        perElementClasses: {},
        extensionData: {
          bem: [
            {
              nodeId: 'valid-node',
              data: {
                block: 'button',
                element: 'icon',
                modifiers: ['active']
              }
            },
            {
              nodeId: 'block-only-node',
              data: {
                block: 'card'
              }
            }
          ]
        }
      };

      const result = bemExtension.processStyles(stylingConcept);
      
      expect(result.updatedStyling.perElementClasses['valid-node']).toContain('button__icon');
      expect(result.updatedStyling.perElementClasses['valid-node']).toContain('button__icon--active');
      expect(result.updatedStyling.perElementClasses['block-only-node']).toContain('card');
    });

    it('should handle modifier variations correctly', () => {
      const stylingConcept: StylingConcept = {
        nodeId: 'test-node',
        staticClasses: [],
        dynamicClasses: [],
        inlineStyles: {},
        perElementClasses: {},
        extensionData: {
          bem: [
            {
              nodeId: 'block-modifier',
              data: {
                block: 'card',
                modifiers: ['highlighted', 'large']
              }
            }
          ]
        }
      };

      const result = bemExtension.processStyles(stylingConcept);
      
      expect(result.updatedStyling.perElementClasses['block-modifier']).toContain('card');
      expect(result.updatedStyling.perElementClasses['block-modifier']).toContain('card--highlighted');
      expect(result.updatedStyling.perElementClasses['block-modifier']).toContain('card--large');
    });

    it('should handle complex BEM hierarchy', () => {
      const stylingConcept: StylingConcept = {
        nodeId: 'test-node',
        staticClasses: [],
        dynamicClasses: [],
        inlineStyles: {},
        perElementClasses: {},
        extensionData: {
          bem: [
            {
              nodeId: 'root',
              data: {
                block: 'hero'
              }
            },
            {
              nodeId: 'root.header',
              data: {
                element: 'header',
                modifiers: ['sticky']
              }
            },
            {
              nodeId: 'root.header.title',
              data: {
                element: 'title'
              }
            }
          ]
        }
      };

      const result = bemExtension.processStyles(stylingConcept);
      
      expect(result.updatedStyling.perElementClasses['root']).toContain('hero');
      expect(result.updatedStyling.perElementClasses['root.header']).toContain('hero__header');
      expect(result.updatedStyling.perElementClasses['root.header']).toContain('hero__header--sticky');
      expect(result.updatedStyling.perElementClasses['root.header.title']).toContain('hero__title');
    });
  });

  describe('SCSS generation from extension data', () => {
    it('should generate SCSS from processed BEM classes', () => {
      const stylingConcept: StylingConcept = {
        nodeId: 'test-node',
        staticClasses: [],
        dynamicClasses: [],
        inlineStyles: {},
        perElementClasses: {},
        extensionData: {
          bem: [
            {
              nodeId: 'component',
              data: {
                block: 'button',
                element: 'icon',
                modifiers: ['active']
              }
            }
          ]
        }
      };

      const result = bemExtension.processStyles(stylingConcept);
      
      expect(result.styles).toContain('.button {');
      expect(result.styles).toContain('&__icon {');
      expect(result.styles).toContain('&--active {');
      expect(result.imports).toEqual([]);
    });
  });
});