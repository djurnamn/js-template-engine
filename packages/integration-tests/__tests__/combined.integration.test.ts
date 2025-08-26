import { describe, it, expect, beforeEach } from 'vitest';
import { ProcessingPipeline, ExtensionRegistry } from '@js-template-engine/core';
import { ReactFrameworkExtension } from '@js-template-engine/extension-react';
import { VueFrameworkExtension } from '@js-template-engine/extension-vue';
import { SvelteFrameworkExtension } from '@js-template-engine/extension-svelte';
import { BemExtension } from '@js-template-engine/extension-bem';
import { TailwindExtension } from '@js-template-engine/extension-tailwind';
import type { ExtendedTemplate } from '@js-template-engine/types';

const bemTemplate = [
  {
    type: 'element' as const,
    tag: 'Button',
    attributes: { label: 'Combined' },
    extensions: {
      bem: { block: 'button', element: 'icon', modifier: 'active' },
    },
    children: [{ type: 'text' as const, content: 'Combined Test' }],
  },
];

const tailwindTemplate: ExtendedTemplate = {
  template: [
    {
      type: 'element',
      tag: 'div',
      attributes: {
        class: 'bg-blue-500 text-white p-4 rounded-lg hover:bg-blue-600'
      },
      children: [
        {
          type: 'element',
          tag: 'button',
          attributes: {
            class: 'bg-white text-blue-500 px-4 py-2 rounded',
            onClick: 'handleClick'
          },
          children: [{ type: 'text', content: 'Tailwind Button' }]
        }
      ]
    }
  ],
  component: {
    name: 'CombinedComponent'
  }
};

const complexTemplate: ExtendedTemplate = {
  template: [
    {
      type: 'element',
      tag: 'section',
      attributes: {
        class: 'container mx-auto p-6'
      },
      extensions: {
        bem: { block: 'hero', modifiers: ['featured'] }
      },
      children: [
        {
          type: 'if',
          condition: 'isVisible',
          then: [
            {
              type: 'element',
              tag: 'h1',
              attributes: {
                class: 'text-4xl font-bold mb-4'
              },
              extensions: {
                bem: { element: 'title' }
              },
              children: [{ type: 'text', content: 'Hero Title' }]
            }
          ]
        },
        {
          type: 'for',
          items: 'items',
          item: 'item',
          key: 'item.id',
          children: [
            {
              type: 'element',
              tag: 'div',
              attributes: {
                class: 'bg-white shadow-md rounded-lg p-4'
              },
              extensions: {
                bem: { element: 'card', modifiers: ['interactive'] }
              },
              children: [{ type: 'text', content: 'Card content' }]
            }
          ]
        }
      ]
    }
  ],
  component: {
    name: 'ComplexComponent',
    props: { isVisible: 'boolean', items: 'any[]' }
  }
};

describe('Combined Extensions Integration', () => {
  describe('Legacy Basic Tests', () => {
    it('renders with React and BEM extensions', async () => {
      const registry = new ExtensionRegistry();
      registry.registerFramework(new ReactFrameworkExtension(false));
      registry.registerStyling(new BemExtension(false));
      const pipeline = new ProcessingPipeline(registry);
      
      const result = await pipeline.process(bemTemplate, {
        framework: 'react',
        extensions: ['bem']
      });
      
      expect(result.errors.getErrors().length).toBe(0);
      expect(result.output).toContain('Combined Test');
      expect(result.output).toContain('button__icon');
      expect(result.output).toContain('Button');
    });

    it('allows registration of different framework extensions', async () => {
      const registry = new ExtensionRegistry();
      
      // Different framework extensions can be registered with different keys
      const reactResult = registry.registerFramework(new ReactFrameworkExtension(false));
      const vueResult = registry.registerFramework(new VueFrameworkExtension(false));
      
      expect(reactResult.isValid).toBe(true);
      expect(vueResult.isValid).toBe(true);
      
      // But processing can only use one framework at a time
      const pipeline = new ProcessingPipeline(registry);
      
      const result = await pipeline.process(bemTemplate, {
        framework: 'react', // Only one framework is specified
        extensions: ['bem']
      });
      
      expect(result.errors.getErrors().length).toBe(0);
      expect(result.metadata.extensionsUsed).toContain('react');
      expect(result.metadata.extensionsUsed).not.toContain('vue');
    });
  });

  describe('Framework + BEM Combinations', () => {
    let registry: ExtensionRegistry;
    let pipeline: ProcessingPipeline;

    beforeEach(() => {
      registry = new ExtensionRegistry();
      registry.registerFramework(new ReactFrameworkExtension(false));
      registry.registerFramework(new VueFrameworkExtension(false));
      registry.registerFramework(new SvelteFrameworkExtension(false));
      registry.registerStyling(new BemExtension(false));
      pipeline = new ProcessingPipeline(registry);
    });

    it('React + BEM integration', async () => {
      const result = await pipeline.process(complexTemplate.template, {
        framework: 'react',
        extensions: ['bem'],
        component: complexTemplate.component
      });

      expect(result.errors.getErrors().length).toBe(0);
      expect(result.output).toContain('className=');
      expect(result.output).toContain('hero__title');
      expect(result.output).toContain('hero__card');
      expect(result.output).toContain('{isVisible ?');
      expect(result.output).toContain('{items.map(');
      expect(result.metadata.extensionsUsed).toContain('react');
      expect(result.metadata.extensionsUsed).toContain('bem');
    });

    it('Vue + BEM integration', async () => {
      const result = await pipeline.process(complexTemplate.template, {
        framework: 'vue',
        extensions: ['bem'],
        component: complexTemplate.component
      });

      expect(result.errors.getErrors().length).toBe(0);
      expect(result.output).toContain('<template>');
      expect(result.output).toContain('class=');
      expect(result.output).toContain('hero__title');
      expect(result.output).toContain('hero__card');
      expect(result.output).toContain('v-if="isVisible"');
      expect(result.output).toContain('v-for=');
      expect(result.metadata.extensionsUsed).toContain('vue');
      expect(result.metadata.extensionsUsed).toContain('bem');
    });

    it('Svelte + BEM integration', async () => {
      const result = await pipeline.process(complexTemplate.template, {
        framework: 'svelte',
        extensions: ['bem'],
        component: complexTemplate.component
      });

      expect(result.errors.getErrors().length).toBe(0);
      expect(result.output).toContain('class=');
      expect(result.output).toContain('hero__title');
      expect(result.output).toContain('hero__card');
      expect(result.output).toContain('{#if isVisible}');
      expect(result.output).toContain('{#each items as item');
      expect(result.metadata.extensionsUsed).toContain('svelte');
      expect(result.metadata.extensionsUsed).toContain('bem');
    });
  });

  describe('Framework + Tailwind Combinations', () => {
    let registry: ExtensionRegistry;
    let pipeline: ProcessingPipeline;

    beforeEach(() => {
      registry = new ExtensionRegistry();
      registry.registerFramework(new ReactFrameworkExtension(false));
      registry.registerFramework(new VueFrameworkExtension(false));
      registry.registerFramework(new SvelteFrameworkExtension(false));
      registry.registerStyling(new TailwindExtension(false));
      pipeline = new ProcessingPipeline(registry);
    });

    it('React + Tailwind integration', async () => {
      const result = await pipeline.process(tailwindTemplate.template, {
        framework: 'react',
        extensions: ['tailwind'],
        component: tailwindTemplate.component
      });

      expect(result.errors.getErrors().length).toBe(0);
      expect(result.output).toContain('className=');
      expect(result.output).toContain('bg-blue-500');
      expect(result.output).toContain('hover:bg-blue-600');
      expect(result.output).toContain('onClick={handleClick}');
      expect(result.metadata.extensionsUsed).toContain('react');
      expect(result.metadata.extensionsUsed).toContain('tailwind');
    });

    it('Vue + Tailwind integration', async () => {
      const result = await pipeline.process(tailwindTemplate.template, {
        framework: 'vue',
        extensions: ['tailwind'],
        component: tailwindTemplate.component
      });

      expect(result.errors.getErrors().length).toBe(0);
      expect(result.output).toContain('<template>');
      expect(result.output).toContain('class=');
      expect(result.output).toContain('bg-blue-500');
      expect(result.output).toContain('hover:bg-blue-600');
      expect(result.output).toContain('@click="handleClick"');
      expect(result.metadata.extensionsUsed).toContain('vue');
      expect(result.metadata.extensionsUsed).toContain('tailwind');
    });

    it('Svelte + Tailwind integration', async () => {
      const result = await pipeline.process(tailwindTemplate.template, {
        framework: 'svelte',
        extensions: ['tailwind'],
        component: tailwindTemplate.component
      });

      expect(result.errors.getErrors().length).toBe(0);
      expect(result.output).toContain('class=');
      expect(result.output).toContain('bg-blue-500');
      expect(result.output).toContain('hover:bg-blue-600');
      expect(result.output).toContain('on:click={handleClick}');
      expect(result.metadata.extensionsUsed).toContain('svelte');
      expect(result.metadata.extensionsUsed).toContain('tailwind');
    });
  });

  describe('Complex Multi-Extension Scenarios', () => {
    let registry: ExtensionRegistry;
    let pipeline: ProcessingPipeline;

    beforeEach(() => {
      registry = new ExtensionRegistry();
      registry.registerFramework(new ReactFrameworkExtension(false));
      registry.registerFramework(new VueFrameworkExtension(false));
      registry.registerFramework(new SvelteFrameworkExtension(false));
      registry.registerStyling(new BemExtension(false));
      registry.registerStyling(new TailwindExtension(false));
      pipeline = new ProcessingPipeline(registry);
    });

    it('should handle mixed BEM and Tailwind classes', async () => {
      const mixedTemplate: ExtendedTemplate = {
        template: [
          {
            type: 'element',
            tag: 'div',
            attributes: {
              class: 'bg-gradient-to-r from-blue-500 to-purple-600 p-6'
            },
            extensions: {
              bem: { block: 'card', modifiers: ['featured', 'interactive'] }
            },
            children: [
              {
                type: 'element',
                tag: 'h2',
                attributes: {
                  class: 'text-2xl font-bold text-white mb-4'
                },
                extensions: {
                  bem: { element: 'title' }
                },
                children: [{ type: 'text', content: 'Mixed Styling' }]
              }
            ]
          }
        ],
        component: {
          name: 'MixedStylingComponent'
        }
      };

      const result = await pipeline.process(mixedTemplate.template, {
        framework: 'react',
        extensions: ['bem', 'tailwind'],
        component: mixedTemplate.component
      });

      expect(result.errors.getErrors().length).toBe(0);
      expect(result.output).toContain('bg-gradient-to-r');
      expect(result.output).toContain('card--featured');
      expect(result.output).toContain('card--interactive');
      expect(result.output).toContain('card__title');
      expect(result.metadata.extensionsUsed).toContain('react');
      expect(result.metadata.extensionsUsed).toContain('bem');
      expect(result.metadata.extensionsUsed).toContain('tailwind');
    });

    it('should process complex nested logic with multiple frameworks', async () => {
      const frameworks = ['react', 'vue', 'svelte'] as const;

      for (const framework of frameworks) {
        const result = await pipeline.process(complexTemplate.template, {
          framework,
          extensions: ['bem', 'tailwind'],
          component: complexTemplate.component
        });

        expect(result.errors.getErrors().length).toBe(0);
        expect(result.output).toContain('Hero Title');
        expect(result.output).toContain('Card content');
        expect(result.output).toContain('container');
        expect(result.output).toContain('mx-auto');
        expect(result.output).toContain('hero__title');
        expect(result.output).toContain('hero__card');
        expect(result.metadata.extensionsUsed).toContain(framework);
        expect(result.metadata.extensionsUsed).toContain('bem');
        expect(result.metadata.extensionsUsed).toContain('tailwind');
      }
    });
  });

  describe('Extension Coordination and Conflicts', () => {
    let registry: ExtensionRegistry;
    let pipeline: ProcessingPipeline;

    beforeEach(() => {
      registry = new ExtensionRegistry();
      registry.registerFramework(new ReactFrameworkExtension(false));
      registry.registerStyling(new BemExtension(false));
      registry.registerStyling(new TailwindExtension(false));
      pipeline = new ProcessingPipeline(registry);
    });

    it('should handle class attribute conflicts gracefully', async () => {
      const conflictTemplate: ExtendedTemplate = {
        template: [
          {
            type: 'element',
            tag: 'div',
            attributes: {
              class: 'existing-class bg-red-500'
            },
            extensions: {
              bem: { block: 'component', element: 'wrapper' }
            },
            children: [{ type: 'text', content: 'Conflict resolution' }]
          }
        ],
        component: {
          name: 'ConflictComponent'
        }
      };

      const result = await pipeline.process(conflictTemplate.template, {
        framework: 'react',
        extensions: ['bem', 'tailwind'],
        component: conflictTemplate.component
      });

      expect(result.errors.getErrors().length).toBe(0);
      expect(result.output).toContain('Conflict resolution');
      expect(result.output).toContain('existing-class');
      expect(result.output).toContain('bg-red-500');
      expect(result.output).toContain('component__wrapper');
    });

    it('should maintain proper extension execution order', async () => {
      const orderTemplate: ExtendedTemplate = {
        template: [
          {
            type: 'element',
            tag: 'button',
            attributes: {
              class: 'btn-primary hover:bg-blue-600'
            },
            extensions: {
              bem: { block: 'button', modifiers: ['large', 'primary'] }
            },
            children: [{ type: 'text', content: 'Order test' }]
          }
        ],
        component: {
          name: 'OrderTestComponent'
        }
      };

      const result = await pipeline.process(orderTemplate.template, {
        framework: 'react',
        extensions: ['bem', 'tailwind'],
        component: orderTemplate.component
      });

      expect(result.errors.getErrors().length).toBe(0);
      expect(result.metadata.extensionsUsed).toContain('bem');
      expect(result.metadata.extensionsUsed).toContain('tailwind');
      expect(result.output).toContain('Order test');
      // Both extensions should process the class attribute
      expect(result.output).toContain('button--large');
      expect(result.output).toContain('button--primary');
      expect(result.output).toContain('hover:bg-blue-600');
    });
  });

  describe('Cross-Framework Consistency Validation', () => {
    let registry: ExtensionRegistry;
    let pipeline: ProcessingPipeline;

    beforeEach(() => {
      registry = new ExtensionRegistry();
      registry.registerFramework(new ReactFrameworkExtension(false));
      registry.registerFramework(new VueFrameworkExtension(false));
      registry.registerFramework(new SvelteFrameworkExtension(false));
      registry.registerStyling(new BemExtension(false));
      registry.registerStyling(new TailwindExtension(false));
      pipeline = new ProcessingPipeline(registry);
    });

    it('should produce equivalent concepts across frameworks', async () => {
      const sharedTemplate: ExtendedTemplate = {
        template: [
          {
            type: 'element',
            tag: 'div',
            attributes: {
              class: 'container'
            },
            children: [
              {
                type: 'if',
                condition: 'showContent',
                then: [
                  {
                    type: 'element',
                    tag: 'h1',
                    children: [{ type: 'text', content: 'Title' }]
                  }
                ]
              },
              {
                type: 'for',
                items: 'items',
                item: 'item',
                key: 'item.id',
                children: [
                  {
                    type: 'element',
                    tag: 'p',
                    children: [{ type: 'text', content: 'Item' }]
                  }
                ]
              }
            ]
          }
        ],
        component: {
          name: 'ConsistencyComponent',
          props: { showContent: 'boolean', items: 'any[]' }
        }
      };

      const frameworks = ['react', 'vue', 'svelte'] as const;
      const results: Array<{ framework: string; concepts: any; output: string }> = [];

      for (const framework of frameworks) {
        const result = await pipeline.process(sharedTemplate.template, {
          framework,
          extensions: ['bem'],
          component: sharedTemplate.component
        });

        expect(result.errors.getErrors().length).toBe(0);
        results.push({
          framework,
          concepts: result.metadata.conceptsExtracted || {},
          output: result.output
        });
      }

      // Validate that all frameworks processed the same template structure
      for (let i = 1; i < results.length; i++) {
        const prev = results[i - 1];
        const curr = results[i];
        
        // All should contain the same text content
        expect(curr.output).toContain('Title');
        expect(curr.output).toContain('Item');
        
        // All should have processed the conditional and loop
        expect(curr.output).not.toBe('');
        expect(prev.output).not.toBe('');
        
        // Basic structural validation - all should have div, h1, p elements
        expect(curr.output).toMatch(/<div[^>]*>/);
        expect(curr.output).toMatch(/<h1[^>]*>Title<\/h1>/);
        expect(curr.output).toMatch(/<p[^>]*>Item<\/p>/);
      }
    });

    it('should handle event normalization across frameworks', async () => {
      const eventTemplate: ExtendedTemplate = {
        template: [
          {
            type: 'element',
            tag: 'button',
            attributes: {
              onClick: 'handleClick',
              onMouseEnter: 'handleHover',
              onFocus: 'handleFocus'
            },
            children: [{ type: 'text', content: 'Interactive Button' }]
          }
        ],
        component: {
          name: 'EventComponent'
        }
      };

      // Test React - should use onClick syntax
      const reactResult = await pipeline.process(eventTemplate.template, {
        framework: 'react',
        component: eventTemplate.component
      });

      expect(reactResult.errors.getErrors().length).toBe(0);
      expect(reactResult.output).toContain('onClick={handleClick}');
      expect(reactResult.output).toContain('onMouseEnter={handleHover}');
      expect(reactResult.output).toContain('onFocus={handleFocus}');

      // Test Vue - should use @click syntax
      const vueResult = await pipeline.process(eventTemplate.template, {
        framework: 'vue',
        component: eventTemplate.component
      });

      expect(vueResult.errors.getErrors().length).toBe(0);
      expect(vueResult.output).toContain('@click="handleClick"');
      expect(vueResult.output).toContain('@mouseenter="handleHover"');
      expect(vueResult.output).toContain('@focus="handleFocus"');

      // Test Svelte - should use on:click syntax
      const svelteResult = await pipeline.process(eventTemplate.template, {
        framework: 'svelte',
        component: eventTemplate.component
      });

      expect(svelteResult.errors.getErrors().length).toBe(0);
      expect(svelteResult.output).toContain('on:click={handleClick}');
      expect(svelteResult.output).toContain('on:mouseenter={handleHover}');
      expect(svelteResult.output).toContain('on:focus={handleFocus}');

      // All should contain the same text content
      expect(reactResult.output).toContain('Interactive Button');
      expect(vueResult.output).toContain('Interactive Button');
      expect(svelteResult.output).toContain('Interactive Button');
    });

    it('should handle class attribute consistently across frameworks', async () => {
      const classTemplate: ExtendedTemplate = {
        template: [
          {
            type: 'element',
            tag: 'div',
            attributes: {
              class: 'bg-blue-500 text-white p-4'
            },
            extensions: {
              bem: { block: 'component', modifiers: ['primary'] }
            },
            children: [{ type: 'text', content: 'Styled content' }]
          }
        ],
        component: {
          name: 'ClassComponent'
        }
      };

      const frameworks = ['react', 'vue', 'svelte'] as const;
      
      for (const framework of frameworks) {
        const result = await pipeline.process(classTemplate.template, {
          framework,
          extensions: ['bem', 'tailwind'],
          component: classTemplate.component
        });

        expect(result.errors.getErrors().length).toBe(0);
        expect(result.output).toContain('Styled content');
        
        // All frameworks should preserve the original classes
        expect(result.output).toContain('bg-blue-500');
        expect(result.output).toContain('text-white');
        expect(result.output).toContain('p-4');
        
        // All frameworks should add BEM classes
        expect(result.output).toContain('component--primary');
        
        // Framework-specific class attribute handling
        if (framework === 'react') {
          expect(result.output).toContain('className=');
        } else {
          expect(result.output).toContain('class=');
        }
      }
    });

    it('should handle template logic consistency', async () => {
      const logicTemplate: ExtendedTemplate = {
        template: [
          {
            type: 'fragment',
            children: [
              {
                type: 'comment',
                content: 'Conditional section'
              },
              {
                type: 'if',
                condition: 'user.isLoggedIn',
                then: [
                  {
                    type: 'element',
                    tag: 'nav',
                    children: [
                      {
                        type: 'for',
                        items: 'menuItems',
                        item: 'item',
                        index: 'index',
                        children: [
                          {
                            type: 'element',
                            tag: 'a',
                            attributes: {
                              href: '{item.href}'
                            },
                            children: [{ type: 'text', content: 'Menu Item' }]
                          }
                        ]
                      }
                    ]
                  }
                ],
                else: [
                  {
                    type: 'element',
                    tag: 'div',
                    children: [{ type: 'text', content: 'Please log in' }]
                  }
                ]
              }
            ]
          }
        ],
        component: {
          name: 'LogicComponent',
          props: { user: 'any', menuItems: 'any[]' }
        }
      };

      const frameworks = ['react', 'vue', 'svelte'] as const;
      
      for (const framework of frameworks) {
        const result = await pipeline.process(logicTemplate.template, {
          framework,
          component: logicTemplate.component
        });

        expect(result.errors.getErrors().length).toBe(0);
        
        // All should contain the same content
        expect(result.output).toContain('Menu Item');
        expect(result.output).toContain('Please log in');
        
        // All should have processed the comment
        if (framework === 'react') {
          expect(result.output).toContain('{/* Conditional section */}');
        } else {
          expect(result.output).toContain('<!-- Conditional section -->');
        }
        
        // All should have nav and a elements
        expect(result.output).toContain('<nav');
        expect(result.output).toContain('<a');
      }
    });

    it('should maintain consistent component structure across frameworks', async () => {
      const structureTemplate: ExtendedTemplate = {
        template: [
          {
            type: 'element',
            tag: 'main',
            attributes: {
              class: 'app-container'
            },
            children: [
              {
                type: 'element',
                tag: 'header',
                attributes: {
                  role: 'banner'
                },
                children: [{ type: 'text', content: 'Header' }]
              },
              {
                type: 'element',
                tag: 'section',
                attributes: {
                  'aria-label': 'Main content'
                },
                children: [{ type: 'text', content: 'Content' }]
              },
              {
                type: 'element',
                tag: 'footer',
                attributes: {
                  role: 'contentinfo'
                },
                children: [{ type: 'text', content: 'Footer' }]
              }
            ]
          }
        ],
        component: {
          name: 'StructureComponent'
        }
      };

      const frameworks = ['react', 'vue', 'svelte'] as const;
      
      for (const framework of frameworks) {
        const result = await pipeline.process(structureTemplate.template, {
          framework,
          component: structureTemplate.component
        });

        expect(result.errors.getErrors().length).toBe(0);
        
        // All should maintain semantic HTML structure
        expect(result.output).toContain('<main');
        expect(result.output).toContain('class="app-container"');
        expect(result.output).toContain('<header');
        expect(result.output).toContain('role="banner"');
        expect(result.output).toContain('<section');
        expect(result.output).toContain('aria-label="Main content"');
        expect(result.output).toContain('<footer');
        expect(result.output).toContain('role="contentinfo"');
        
        // All should contain the same text content
        expect(result.output).toContain('Header');
        expect(result.output).toContain('Content');
        expect(result.output).toContain('Footer');
      }
    });
  });
});
