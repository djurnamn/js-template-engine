import { describe, it, expect } from 'vitest';
import { ProcessingPipeline, ExtensionRegistry } from '@js-template-engine/core';
import { ReactExtension } from '@js-template-engine/extension-react';

const simpleTemplate = {
  type: 'element' as const,
  tag: 'Button',
  attributes: { label: 'Click me' },
};

describe('React extension integration', () => {
  it('renders a simple component with React extension', async () => {
    const registry = new ExtensionRegistry();
    registry.registerFramework(new ReactExtension(false));
    const pipeline = new ProcessingPipeline(registry);
    
    const result = await pipeline.process([simpleTemplate], {
      framework: 'react',
      language: 'javascript'
    });
    
    expect(result.errors.getErrors().length).toBe(0);
    expect(result.output).toContain('Click me');
    expect(result.output).toContain('Button');
  });
});
