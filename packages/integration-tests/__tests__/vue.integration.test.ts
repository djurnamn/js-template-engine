import { describe, it, expect } from 'vitest';
import { ProcessingPipeline, ExtensionRegistry } from '@js-template-engine/core';
import { VueExtension } from '@js-template-engine/extension-vue';

const simpleTemplate = [
  {
    type: 'element' as const,
    tag: 'Button',
    attributes: { label: 'Click me' },
    children: [
      {
        type: 'element' as const,
        tag: 'span',
        attributes: {},
        children: [{ type: 'text' as const, content: 'Slot content' }],
      },
    ],
  },
];

describe('Vue extension integration', () => {
  it('renders a component with slots and props', async () => {
    const registry = new ExtensionRegistry();
    registry.registerFramework(new VueExtension(false));
    const pipeline = new ProcessingPipeline(registry);
    
    const result = await pipeline.process(simpleTemplate, {
      framework: 'vue',
      language: 'javascript'
    });
    
    expect(result.errors.getErrors().length).toBe(0);
    expect(result.output).toContain('Click me');
    expect(result.output).toContain('Slot content');
    expect(result.output).toContain('<Button');
    expect(result.output).toContain('<span');
  });
});
