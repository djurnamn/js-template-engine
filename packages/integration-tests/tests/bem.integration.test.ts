import { describe, it, expect, beforeEach } from 'vitest';
import { ProcessingPipeline, ExtensionRegistry } from '@js-template-engine/core';
import { BemExtension } from '@js-template-engine/extension-bem';
import { ReactFrameworkExtension } from '@js-template-engine/extension-react';
import { VueFrameworkExtension } from '@js-template-engine/extension-vue';
import { SvelteFrameworkExtension } from '@js-template-engine/extension-svelte';

const bemTemplate = [
  {
    type: 'element' as const,
    tag: 'button',
    attributes: {
      class: 'button button__icon button--active'
    },
    extensions: {
      bem: { block: 'button', element: 'icon', modifier: 'active' },
    },
    children: [{ type: 'text' as const, content: 'BEM Button' }],
  },
];

const stylingTemplate = [
  {
    type: 'element' as const,
    tag: 'div',
    attributes: {
      class: 'card card__header card__body--highlighted'
    },
    children: [
      { type: 'text' as const, content: 'Card content' }
    ],
  },
];

describe('BEM extension integration', () => {
  let registry: ExtensionRegistry;
  let pipeline: ProcessingPipeline;

  beforeEach(() => {
    registry = new ExtensionRegistry();
    pipeline = new ProcessingPipeline(registry);
  });

  describe('Standalone BEM processing', () => {
    it('should register BEM extension correctly', () => {
      const bemExtension = new BemExtension(false);
      const result = registry.registerStyling(bemExtension);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(registry.getStyling('bem')).toBe(bemExtension);
    });

    it('should process styling concepts independently', async () => {
      const bemExtension = new BemExtension(false);
      registry.registerStyling(bemExtension);

      const result = await pipeline.process(stylingTemplate, {
        extensions: ['bem']
      });

      expect(result.output).toBeTruthy();
      expect(result.errors.getErrors()).toEqual([]);
      expect(result.metadata.extensionsUsed).toContain('bem');
    });
  });

  describe('Framework coordination', () => {
    it('should coordinate BEM with React extension', async () => {
      const bemExtension = new BemExtension(false);
      const reactExtension = new ReactFrameworkExtension();
      
      registry.registerStyling(bemExtension);
      registry.registerFramework(reactExtension);

      const result = await pipeline.process(stylingTemplate, {
        framework: 'react',
        extensions: ['bem'],
        component: { name: 'TestComponent' }
      });

      expect(result.output).toBeTruthy();
      expect(result.output).toContain('className=');
      expect(result.output).toContain('card');
      expect(result.metadata.extensionsUsed).toContain('bem');
      expect(result.metadata.extensionsUsed).toContain('react');
    });

    it('should coordinate BEM with Vue extension', async () => {
      const bemExtension = new BemExtension(false);
      const vueExtension = new VueFrameworkExtension();
      
      registry.registerStyling(bemExtension);
      registry.registerFramework(vueExtension);

      const result = await pipeline.process(stylingTemplate, {
        framework: 'vue',
        extensions: ['bem'],
        component: { name: 'TestComponent' }
      });

      expect(result.output).toBeTruthy();
      expect(result.output).toContain('<template>');
      expect(result.output).toContain('class=');
      expect(result.output).toContain('card');
      expect(result.metadata.extensionsUsed).toContain('bem');
      expect(result.metadata.extensionsUsed).toContain('vue');
    });

    it('should coordinate BEM with Svelte extension', async () => {
      const bemExtension = new BemExtension(false);
      const svelteExtension = new SvelteFrameworkExtension();
      
      registry.registerStyling(bemExtension);
      registry.registerFramework(svelteExtension);

      const result = await pipeline.process(stylingTemplate, {
        framework: 'svelte',
        extensions: ['bem'],
        component: { name: 'TestComponent' }
      });

      expect(result.output).toBeTruthy();
      expect(result.output).toContain('<script');
      expect(result.output).toContain('class=');
      expect(result.output).toContain('card');
      expect(result.metadata.extensionsUsed).toContain('bem');
      expect(result.metadata.extensionsUsed).toContain('svelte');
    });
  });

  describe('SCSS generation', () => {
    it('should generate SCSS output for BEM classes', async () => {
      const bemExtension = new BemExtension(false);
      registry.registerStyling(bemExtension);

      const complexTemplate = [
        {
          type: 'element' as const,
          tag: 'div',
          attributes: {
            class: 'navigation navigation__item navigation__item--active navigation__link'
          },
          children: []
        }
      ];

      const result = await pipeline.process(complexTemplate, {
        extensions: ['bem']
      });

      expect(result.metadata.extensionsUsed).toContain('bem');
      // SCSS should be available in the options.styleOutput
    });
  });

  describe('Legacy BEM functionality preservation', () => {
    it('renders a component with BEM class output using legacy API', async () => {
      const bemExtension = new BemExtension(false);
      registry.registerStyling(bemExtension);

      const result = await pipeline.process(bemTemplate, {
        extensions: ['bem']
      });

      expect(result.output).toContain('BEM Button');
      expect(result.metadata.extensionsUsed).toContain('bem');
    });

    it('should preserve existing BEM node processing', () => {
      const bemExtension = new BemExtension(false);
      const node = {
        type: 'element' as const,
        tag: 'button',
        attributes: {},
        extensions: {
          bem: { block: 'button', element: 'icon', modifier: 'active' },
        },
        children: []
      };

      bemExtension.onNodeVisit(node, []);
      
      expect(node.attributes.class).toContain('button__icon');
      expect(node.attributes.class).toContain('button__icon--active');
    });
  });

  describe('Error handling', () => {
    it('should handle missing framework extension gracefully', async () => {
      const bemExtension = new BemExtension(false);
      registry.registerStyling(bemExtension);

      const result = await pipeline.process(stylingTemplate, {
        framework: 'nonexistent',
        extensions: ['bem']
      });

      expect(result.errors.getErrors().length).toBeGreaterThan(0);
      expect(result.errors.getErrors()[0].message).toContain('Framework extension \'nonexistent\' not found');
    });

    it('should handle empty styling concepts', async () => {
      const bemExtension = new BemExtension(false);
      registry.registerStyling(bemExtension);

      const emptyTemplate = [
        {
          type: 'element' as const,
          tag: 'div',
          attributes: {},
          children: []
        }
      ];

      const result = await pipeline.process(emptyTemplate, {
        extensions: ['bem']
      });

      expect(result.errors.getErrors()).toEqual([]);
      expect(result.metadata.extensionsUsed).toContain('bem');
    });
  });
});
