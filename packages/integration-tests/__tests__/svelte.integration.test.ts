import { describe, it, expect, beforeEach } from 'vitest';
import {
  ProcessingPipeline,
  ExtensionRegistry,
} from '@js-template-engine/core';
import { SvelteExtension } from '@js-template-engine/extension-svelte';
import { BemExtension } from '@js-template-engine/extension-bem';
import type { ExtendedTemplate } from '@js-template-engine/types';

describe('Svelte Framework Extension Integration', () => {
  describe('Basic Component Rendering', () => {
    let registry: ExtensionRegistry;
    let pipeline: ProcessingPipeline;

    beforeEach(() => {
      registry = new ExtensionRegistry();
      registry.registerFramework(new SvelteExtension());
      pipeline = new ProcessingPipeline(registry);
    });

    it('should process simple components with Svelte syntax', async () => {
      const template = [
        {
          type: 'element' as const,
          tag: 'Button',
          attributes: { label: 'Click me' },
          children: [{ type: 'text' as const, content: 'Button Text' }],
        },
      ];

      const result = await pipeline.process(template, {
        framework: 'svelte',
      });

      expect(result.errors.getErrors().length).toBe(0);
      expect(result.output).toContain('Button Text');
      expect(result.output).toContain('<Button');
      expect(result.output).toContain('label="Click me"');
    });

    it('should process events with Svelte on: syntax', async () => {
      const template: ExtendedTemplate = {
        template: [
          {
            type: 'element',
            tag: 'button',
            attributes: {
              'on:click': 'handleClick',
            },
            children: [{ type: 'text', content: 'Click me' }],
          },
        ],
        component: {
          name: 'EventComponent',
        },
      };

      const result = await pipeline.process(template.template, {
        framework: 'svelte',
        component: template.component,
      });

      expect(result.output).toContain('on:click={handleClick}');
      expect(result.output).toContain('Click me');
      expect(result.errors.getErrors().length).toBe(0);
    });

    it('should process conditionals with Svelte {#if} blocks', async () => {
      const template: ExtendedTemplate = {
        template: [
          {
            type: 'if',
            condition: 'isVisible',
            then: [
              {
                type: 'element',
                tag: 'div',
                children: [{ type: 'text', content: 'Visible content' }],
              },
            ],
            else: [
              {
                type: 'element',
                tag: 'div',
                children: [{ type: 'text', content: 'Hidden content' }],
              },
            ],
          },
        ],
        component: {
          name: 'ConditionalComponent',
          props: { isVisible: 'boolean' },
        },
      };

      const result = await pipeline.process(template.template, {
        framework: 'svelte',
        component: template.component,
      });

      expect(result.output).toContain('{#if isVisible}');
      expect(result.output).toContain('{:else}');
      expect(result.output).toContain('{/if}');
      expect(result.output).toContain('Visible content');
      expect(result.output).toContain('Hidden content');
      expect(result.errors.getErrors().length).toBe(0);
    });

    it('should process iterations with Svelte {#each} blocks', async () => {
      const template: ExtendedTemplate = {
        template: [
          {
            type: 'for',
            items: 'items',
            item: 'item',
            index: 'index',
            key: 'item.id',
            children: [
              {
                type: 'element',
                tag: 'li',
                children: [{ type: 'text', content: 'List item' }],
              },
            ],
          },
        ],
        component: {
          name: 'ListComponent',
          props: { items: 'any[]' },
        },
      };

      const result = await pipeline.process(template.template, {
        framework: 'svelte',
        component: template.component,
      });

      expect(result.output).toContain('{#each items as item, index (item.id)}');
      expect(result.output).toContain('{/each}');
      expect(result.output).toContain('List item');
      expect(result.errors.getErrors().length).toBe(0);
    });

    it('should process slots correctly', async () => {
      const template: ExtendedTemplate = {
        template: [
          {
            type: 'element',
            tag: 'Card',
            attributes: { title: 'Card Title' },
            children: [
              {
                type: 'element',
                tag: 'slot',
                attributes: { name: 'header' },
                children: [{ type: 'text', content: 'Header content' }],
              },
              {
                type: 'element',
                tag: 'slot',
                attributes: {},
                children: [{ type: 'text', content: 'Default slot content' }],
              },
            ],
          },
        ],
        component: {
          name: 'CardComponent',
        },
      };

      const result = await pipeline.process(template.template, {
        framework: 'svelte',
        component: template.component,
      });

      expect(result.output).toContain('<slot name="header">');
      expect(result.output).toContain('<slot>');
      expect(result.output).toContain('Header content');
      expect(result.output).toContain('Default slot content');
      expect(result.errors.getErrors().length).toBe(0);
    });

    it('should handle dynamic attributes with Svelte binding', async () => {
      const template: ExtendedTemplate = {
        template: [
          {
            type: 'element',
            tag: 'input',
            attributes: {
              type: 'text',
              'bind:value': 'inputValue',
              disabled: '{isDisabled}',
            },
          },
        ],
        component: {
          name: 'InputComponent',
          props: { inputValue: 'string', isDisabled: 'boolean' },
        },
      };

      const result = await pipeline.process(template.template, {
        framework: 'svelte',
        component: template.component,
      });

      expect(result.output).toContain('bind:value={inputValue}');
      expect(result.output).toContain('disabled={isDisabled}');
      expect(result.errors.getErrors().length).toBe(0);
    });

    it('should process comment nodes correctly', async () => {
      const template: ExtendedTemplate = {
        template: [
          {
            type: 'element',
            tag: 'div',
            children: [
              {
                type: 'comment',
                content: 'This is a Svelte comment',
              },
              {
                type: 'text',
                content: 'Hello Svelte',
              },
            ],
          },
        ],
        component: {
          name: 'SvelteTestComponent',
        },
      };

      const result = await pipeline.process(template.template, {
        framework: 'svelte',
        component: template.component,
      });

      expect(result.output).toContain('<!-- This is a Svelte comment -->');
      expect(result.output).toContain('Hello Svelte');
      expect(result.errors.getErrors().length).toBe(0);
    });

    it('should process fragment nodes correctly', async () => {
      const template: ExtendedTemplate = {
        template: [
          {
            type: 'fragment',
            children: [
              {
                type: 'element',
                tag: 'h1',
                children: [{ type: 'text', content: 'Title' }],
              },
              {
                type: 'element',
                tag: 'p',
                children: [{ type: 'text', content: 'Content' }],
              },
            ],
          },
        ],
        component: {
          name: 'SvelteFragmentComponent',
        },
      };

      const result = await pipeline.process(template.template, {
        framework: 'svelte',
        component: template.component,
      });

      expect(result.output).toContain('<h1>Title</h1>');
      expect(result.output).toContain('<p>Content</p>');
      expect(result.errors.getErrors().length).toBe(0);
    });
  });

  describe('Complex Template Logic', () => {
    let registry: ExtensionRegistry;
    let pipeline: ProcessingPipeline;

    beforeEach(() => {
      registry = new ExtensionRegistry();
      registry.registerFramework(new SvelteExtension());
      pipeline = new ProcessingPipeline(registry);
    });

    it('should handle nested logic blocks', async () => {
      const template: ExtendedTemplate = {
        template: [
          {
            type: 'fragment',
            children: [
              {
                type: 'comment',
                content: 'Nested logic container',
              },
              {
                type: 'for',
                items: 'items',
                item: 'item',
                children: [
                  {
                    type: 'if',
                    condition: 'item.visible',
                    then: [
                      {
                        type: 'element',
                        tag: 'div',
                        children: [{ type: 'text', content: 'Visible item' }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        component: {
          name: 'NestedSvelteComponent',
          props: { items: 'any[]' },
        },
      };

      const result = await pipeline.process(template.template, {
        framework: 'svelte',
        component: template.component,
      });

      expect(result.output).toContain('<!-- Nested logic container -->');
      expect(result.output).toContain('{#each items as item}');
      expect(result.output).toContain('{#if item.visible}');
      expect(result.output).toContain('Visible item');
      expect(result.output).toContain('{/if}');
      expect(result.output).toContain('{/each}');
      expect(result.errors.getErrors().length).toBe(0);
    });

    it('should handle multiple event handlers', async () => {
      const template: ExtendedTemplate = {
        template: [
          {
            type: 'element',
            tag: 'button',
            attributes: {
              'on:click': 'handleClick',
              'on:mouseenter': 'handleHover',
              'on:keydown': 'handleKeydown',
            },
            children: [{ type: 'text', content: 'Multi-event button' }],
          },
        ],
        component: {
          name: 'MultiEventComponent',
        },
      };

      const result = await pipeline.process(template.template, {
        framework: 'svelte',
        component: template.component,
      });

      expect(result.output).toContain('on:click={handleClick}');
      expect(result.output).toContain('on:mouseenter={handleHover}');
      expect(result.output).toContain('on:keydown={handleKeydown}');
      expect(result.output).toContain('Multi-event button');
      expect(result.errors.getErrors().length).toBe(0);
    });
  });

  describe('BEM Extension Integration', () => {
    let registry: ExtensionRegistry;
    let pipeline: ProcessingPipeline;

    beforeEach(() => {
      registry = new ExtensionRegistry();
      registry.registerFramework(new SvelteExtension());
      registry.registerStyling(new BemExtension(false));
      pipeline = new ProcessingPipeline(registry);
    });

    it('should integrate with BEM extension correctly', async () => {
      const template: ExtendedTemplate = {
        template: [
          {
            type: 'element',
            tag: 'div',
            extensions: {
              bem: { block: 'card', modifiers: ['primary'] },
            },
            children: [
              {
                type: 'comment',
                content: 'Card content',
              },
              {
                type: 'if',
                condition: 'showTitle',
                then: [
                  {
                    type: 'element',
                    tag: 'h2',
                    extensions: {
                      bem: { element: 'title' },
                    },
                    children: [{ type: 'text', content: 'Title' }],
                  },
                ],
              },
            ],
          },
        ],
        component: {
          name: 'SvelteCardComponent',
          props: { showTitle: 'boolean' },
        },
      };

      const result = await pipeline.process(template.template, {
        framework: 'svelte',
        extensions: ['bem'],
        component: template.component,
      });

      expect(result.output).toMatch(/class="card[^"]*primary[^"]*"/);
      expect(result.output).toContain('<!-- Card content -->');
      expect(result.output).toContain('{#if showTitle}');
      expect(result.output).toContain('class="card__title"');
      expect(result.errors.getErrors().length).toBe(0);
    });

    it('should handle BEM with iterations correctly', async () => {
      const template: ExtendedTemplate = {
        template: [
          {
            type: 'element',
            tag: 'ul',
            extensions: {
              bem: { block: 'menu' },
            },
            children: [
              {
                type: 'for',
                items: 'menuItems',
                item: 'menuItem',
                children: [
                  {
                    type: 'element',
                    tag: 'li',
                    extensions: {
                      bem: {
                        element: 'item',
                        modifiers: ['{menuItem.active ? "active" : ""}'],
                      },
                    },
                    children: [{ type: 'text', content: 'Menu Item' }],
                  },
                ],
              },
            ],
          },
        ],
        component: {
          name: 'SvelteMenuComponent',
          props: { menuItems: 'any[]' },
        },
      };

      const result = await pipeline.process(template.template, {
        framework: 'svelte',
        extensions: ['bem'],
        component: template.component,
      });

      expect(result.output).toContain('class="menu"');
      expect(result.output).toContain('{#each menuItems as menuItem}');
      expect(result.output).toContain('class="menu__item');
      expect(result.output).toContain('Menu Item');
      expect(result.errors.getErrors().length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    let registry: ExtensionRegistry;
    let pipeline: ProcessingPipeline;

    beforeEach(() => {
      registry = new ExtensionRegistry();
      registry.registerFramework(new SvelteExtension());
      pipeline = new ProcessingPipeline(registry);
    });

    it('should handle malformed if nodes gracefully', async () => {
      const template: ExtendedTemplate = {
        template: [
          {
            type: 'if',
            condition: '', // Empty condition
            then: [], // Empty then branch
          },
        ],
        component: {
          name: 'ErrorTestComponent',
        },
      };

      const result = await pipeline.process(template.template, {
        framework: 'svelte',
        component: template.component,
      });

      // Should not crash and should handle gracefully
      expect(result.output).toBeDefined();
      expect(result.errors).toBeDefined();
    });

    it('should handle malformed for nodes gracefully', async () => {
      const template: ExtendedTemplate = {
        template: [
          {
            type: 'for',
            items: '', // Empty items
            item: '', // Empty item variable
            children: [],
          },
        ],
        component: {
          name: 'ErrorTestComponent',
        },
      };

      const result = await pipeline.process(template.template, {
        framework: 'svelte',
        component: template.component,
      });

      // Should not crash and should handle gracefully
      expect(result.output).toBeDefined();
      expect(result.errors).toBeDefined();
    });

    it('should handle missing framework extension gracefully', async () => {
      const emptyRegistry = new ExtensionRegistry();
      const emptyPipeline = new ProcessingPipeline(emptyRegistry);

      const template = [
        {
          type: 'element' as const,
          tag: 'div',
          children: [{ type: 'text' as const, content: 'Test' }],
        },
      ];

      const result = await emptyPipeline.process(template, {
        framework: 'svelte',
      });

      expect(result.errors.getErrors().length).toBeGreaterThan(0);
      expect(result.errors.getErrors()[0].message).toContain(
        "Framework extension 'svelte' not found"
      );
    });
  });

  describe('TypeScript Integration', () => {
    let registry: ExtensionRegistry;
    let pipeline: ProcessingPipeline;

    beforeEach(() => {
      registry = new ExtensionRegistry();
      registry.registerFramework(new SvelteExtension());
      pipeline = new ProcessingPipeline(registry);
    });

    it('should generate TypeScript-compatible Svelte components', async () => {
      const template: ExtendedTemplate = {
        template: [
          {
            type: 'element',
            tag: 'div',
            children: [
              {
                type: 'text',
                content: 'TypeScript Svelte Component',
              },
            ],
          },
        ],
        component: {
          name: 'TypeScriptSvelteComponent',
          props: { message: 'string', count: 'number' },
        },
      };

      const result = await pipeline.process(template.template, {
        framework: 'svelte',
        component: template.component,
      });

      expect(result.output).toContain('TypeScript Svelte Component');
      expect(result.errors.getErrors().length).toBe(0);
      // TypeScript-specific assertions would depend on the Svelte extension implementation
    });
  });
});
