import { describe, it, expect } from 'vitest';
import { TemplateEngine } from '@js-template-engine/core';
import { ReactExtension } from '@js-template-engine/extension-react';

const simpleTemplate = {
  type: 'element' as const,
  tag: 'Button',
  attributes: { label: 'Click me' },
};

describe('React extension integration', () => {
  it('renders a simple component with React extension', async () => {
    const engine = new TemplateEngine([new ReactExtension()], false);
    const result = await engine.render([simpleTemplate], {
      fileExtension: '.jsx',
    });
    const output = result.output;
    expect(output).toContain('Click me');
    expect(output).toContain('Button');
  });
});
