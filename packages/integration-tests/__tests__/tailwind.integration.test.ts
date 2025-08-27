import { describe, it, expect, beforeEach } from 'vitest';
import { ProcessingPipeline, ExtensionRegistry } from '@js-template-engine/core';
import { TailwindExtension } from '@js-template-engine/extension-tailwind';
import { ReactExtension } from '@js-template-engine/extension-react';
import { VueExtension } from '@js-template-engine/extension-vue';
import { SvelteExtension } from '@js-template-engine/extension-svelte';
import type { ExtendedTemplate } from '@js-template-engine/types';

describe('Tailwind Extension Integration', () => {
  describe('Extension Registration', () => {
    let registry: ExtensionRegistry;

    beforeEach(() => {
      registry = new ExtensionRegistry();
    });

    it('should register Tailwind extension correctly', () => {
      const tailwindExtension = new TailwindExtension(false);
      const result = registry.registerStyling(tailwindExtension);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(registry.getStyling('tailwind')).toBe(tailwindExtension);
    });
  });

  describe('Basic Tailwind Processing', () => {
    let registry: ExtensionRegistry;
    let pipeline: ProcessingPipeline;

    beforeEach(() => {
      registry = new ExtensionRegistry();
      registry.registerStyling(new TailwindExtension(false));
      pipeline = new ProcessingPipeline(registry);
    });

    it('should process basic utility classes', async () => {
      const template = [
        {
          type: 'element' as const,
          tag: 'div',
          attributes: {
            class: 'bg-blue-500 text-white p-4 rounded-lg'
          },
          children: [
            { type: 'text' as const, content: 'Styled content' }
          ]
        }
      ];

      const result = await pipeline.process(template, {
        extensions: ['tailwind']
      });

      expect(result.output).toBeTruthy();
      expect(result.errors.getErrors()).toEqual([]);
      expect(result.output).toContain('Styled content');
    });

    it('should handle empty class attributes', async () => {
      const template = [
        {
          type: 'element' as const,
          tag: 'div',
          attributes: {
            class: ''
          },
          children: [
            { type: 'text' as const, content: 'Empty class' }
          ]
        }
      ];

      const result = await pipeline.process(template, {
        extensions: ['tailwind']
      });

      expect(result.output).toBeTruthy();
      expect(result.output).toContain('Empty class');
      expect(result.errors.getErrors().length).toBe(0);
    });

    it('should handle missing class attributes', async () => {
      const template = [
        {
          type: 'element' as const,
          tag: 'div',
          attributes: {},
          children: [
            { type: 'text' as const, content: 'No class attribute' }
          ]
        }
      ];

      const result = await pipeline.process(template, {
        extensions: ['tailwind']
      });

      expect(result.output).toBeTruthy();
      expect(result.output).toContain('No class attribute');
      expect(result.errors.getErrors().length).toBe(0);
    });
  });

  describe('React + Tailwind Integration', () => {
    let registry: ExtensionRegistry;
    let pipeline: ProcessingPipeline;

    beforeEach(() => {
      registry = new ExtensionRegistry();
      registry.registerFramework(new ReactExtension(false));
      registry.registerStyling(new TailwindExtension(false));
      pipeline = new ProcessingPipeline(registry);
    });

    it('should integrate with React framework correctly', async () => {
      const template: ExtendedTemplate = {
        template: [
          {
            type: 'element',
            tag: 'div',
            attributes: {
              class: 'bg-blue-500 text-white p-4'
            },
            children: [
              {
                type: 'element',
                tag: 'button',
                attributes: {
                  class: 'bg-white text-blue-500 px-4 py-2',
                  onClick: 'handleClick'
                },
                children: [{ type: 'text', content: 'Click me' }]
              }
            ]
          }
        ],
        component: {
          name: 'ReactTailwindComponent',
          imports: ['import React from "react";']
        }
      };

      const result = await pipeline.process(template.template, {
        framework: 'react',
        extensions: ['tailwind'],
        component: template.component
      });

      expect(result.output).toContain('className=');
      expect(result.output).toContain('bg-blue-500');
      expect(result.output).toContain('onClick={handleClick}');
      expect(result.output).toContain('Click me');
      expect(result.metadata.extensionsUsed).toContain('react');
      expect(result.errors.getErrors().length).toBe(0);
    });
  });

  describe('Vue + Tailwind Integration', () => {
    let registry: ExtensionRegistry;
    let pipeline: ProcessingPipeline;

    beforeEach(() => {
      registry = new ExtensionRegistry();
      registry.registerFramework(new VueExtension(false));
      registry.registerStyling(new TailwindExtension(false));
      pipeline = new ProcessingPipeline(registry);
    });

    it('should integrate with Vue framework correctly', async () => {
      const template: ExtendedTemplate = {
        template: [
          {
            type: 'element',
            tag: 'div',
            attributes: {
              class: 'bg-purple-500 text-white p-6'
            },
            children: [
              {
                type: 'element',
                tag: 'button',
                attributes: {
                  class: 'bg-white text-purple-500 px-6 py-2',
                  '@click': 'handleClick'
                },
                children: [{ type: 'text', content: 'Vue Button' }]
              }
            ]
          }
        ],
        component: {
          name: 'VueTailwindComponent'
        }
      };

      const result = await pipeline.process(template.template, {
        framework: 'vue',
        extensions: ['tailwind'],
        component: template.component
      });

      expect(result.output).toContain('<template>');
      expect(result.output).toContain('class="bg-purple-500');
      expect(result.output).toContain('@click="handleClick"');
      expect(result.output).toContain('Vue Button');
      expect(result.metadata.extensionsUsed).toContain('vue');
      expect(result.errors.getErrors().length).toBe(0);
    });
  });

  describe('Svelte + Tailwind Integration', () => {
    let registry: ExtensionRegistry;
    let pipeline: ProcessingPipeline;

    beforeEach(() => {
      registry = new ExtensionRegistry();
      registry.registerFramework(new SvelteExtension(false));
      registry.registerStyling(new TailwindExtension(false));
      pipeline = new ProcessingPipeline(registry);
    });

    it('should integrate with Svelte framework correctly', async () => {
      const template: ExtendedTemplate = {
        template: [
          {
            type: 'element',
            tag: 'div',
            attributes: {
              class: 'min-h-screen bg-gradient-to-br from-indigo-500'
            },
            children: [
              {
                type: 'element',
                tag: 'button',
                attributes: {
                  class: 'bg-white text-gray-800 px-6 py-3',
                  'on:click': 'handleClick'
                },
                children: [{ type: 'text', content: 'Svelte Button' }]
              }
            ]
          }
        ],
        component: {
          name: 'SvelteTailwindComponent'
        }
      };

      const result = await pipeline.process(template.template, {
        framework: 'svelte',
        extensions: ['tailwind'],
        component: template.component
      });

      expect(result.output).toContain('class="min-h-screen');
      expect(result.output).toContain('on:click={handleClick}');
      expect(result.output).toContain('Svelte Button');
      expect(result.metadata.extensionsUsed).toContain('svelte');
      expect(result.errors.getErrors().length).toBe(0);
    });
  });

  describe('Complex Scenarios', () => {
    let registry: ExtensionRegistry;
    let pipeline: ProcessingPipeline;

    beforeEach(() => {
      registry = new ExtensionRegistry();
      registry.registerFramework(new ReactExtension(false));
      registry.registerStyling(new TailwindExtension(false));
      pipeline = new ProcessingPipeline(registry);
    });

    it('should handle conditional styling', async () => {
      const template: ExtendedTemplate = {
        template: [
          {
            type: 'if',
            condition: 'isActive',
            then: [
              {
                type: 'element',
                tag: 'div',
                attributes: {
                  class: 'bg-green-500 text-white p-4'
                },
                children: [{ type: 'text', content: 'Active state' }]
              }
            ],
            else: [
              {
                type: 'element',
                tag: 'div',
                attributes: {
                  class: 'bg-gray-300 text-gray-700 p-4'
                },
                children: [{ type: 'text', content: 'Inactive state' }]
              }
            ]
          }
        ],
        component: {
          name: 'ConditionalTailwindComponent',
          props: { isActive: 'boolean' },
          imports: ['import React from "react";']
        }
      };

      const result = await pipeline.process(template.template, {
        framework: 'react',
        extensions: ['tailwind'],
        component: template.component
      });

      expect(result.output).toContain('bg-green-500');
      expect(result.output).toContain('bg-gray-300');
      expect(result.output).toContain('{isActive ?');
      expect(result.metadata.extensionsUsed).toContain('react');
      expect(result.errors.getErrors().length).toBe(0);
    });

    it('should handle list rendering', async () => {
      const template: ExtendedTemplate = {
        template: [
          {
            type: 'element',
            tag: 'ul',
            attributes: {
              class: 'space-y-2 bg-gray-50 p-4'
            },
            children: [
              {
                type: 'for',
                items: 'items',
                item: 'item',
                key: 'item.id',
                children: [
                  {
                    type: 'element',
                    tag: 'li',
                    attributes: {
                      class: 'bg-white p-3 rounded shadow'
                    },
                    children: [{ type: 'text', content: 'List item' }]
                  }
                ]
              }
            ]
          }
        ],
        component: {
          name: 'TailwindListComponent',
          props: { items: 'any[]' },
          imports: ['import React from "react";']
        }
      };

      const result = await pipeline.process(template.template, {
        framework: 'react',
        extensions: ['tailwind'],
        component: template.component
      });

      expect(result.output).toContain('space-y-2');
      expect(result.output).toContain('bg-white');
      expect(result.output).toContain('{items.map(');
      expect(result.metadata.extensionsUsed).toContain('react');
      expect(result.errors.getErrors().length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    let registry: ExtensionRegistry;
    let pipeline: ProcessingPipeline;

    beforeEach(() => {
      registry = new ExtensionRegistry();
      registry.registerStyling(new TailwindExtension(false));
      pipeline = new ProcessingPipeline(registry);
    });

    it('should handle templates with mixed valid/invalid classes gracefully', async () => {
      const template = [
        {
          type: 'element' as const,
          tag: 'div',
          attributes: {
            class: 'valid-class bg-blue-500'
          },
          children: [
            { type: 'text' as const, content: 'Mixed classes' }
          ]
        }
      ];

      const result = await pipeline.process(template, {
        extensions: ['tailwind']
      });

      expect(result.output).toBeTruthy();
      expect(result.output).toContain('Mixed classes');
      // Should not crash, may or may not have errors depending on implementation
    });
  });
});