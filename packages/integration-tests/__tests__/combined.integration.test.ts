import { describe, it, expect } from 'vitest';
import { ProcessingPipeline, ExtensionRegistry } from '@js-template-engine/core';
import { ReactFrameworkExtension } from '@js-template-engine/extension-react';
import { VueFrameworkExtension } from '@js-template-engine/extension-vue';
import { BemExtension } from '@js-template-engine/extension-bem';

const template = [
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

describe('Combined extensions integration', () => {
  it('renders with React and BEM extensions', async () => {
    const registry = new ExtensionRegistry();
    registry.registerFramework(new ReactFrameworkExtension(false));
    registry.registerStyling(new BemExtension(false));
    const pipeline = new ProcessingPipeline(registry);
    
    const result = await pipeline.process(template, {
      framework: 'react',
      extensions: ['bem'],
      language: 'javascript'
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
    
    const result = await pipeline.process(template, {
      framework: 'react', // Only one framework is specified
      extensions: ['bem'],
      language: 'javascript'
    });
    
    expect(result.errors.getErrors().length).toBe(0);
    expect(result.metadata.extensionsUsed).toContain('react');
    expect(result.metadata.extensionsUsed).not.toContain('vue');
  });
});
