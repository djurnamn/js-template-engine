import { describe, it, expect } from 'vitest';
import { TemplateEngine } from '@js-template-engine/core';
import { ReactExtension } from '@js-template-engine/extension-react';

const simpleTemplate = {
  tag: 'Button',
  attributes: { label: 'Click me' }
};

describe('React extension integration', () => {
  it('renders a simple component with React extension', async () => {
    const engine = new TemplateEngine([new ReactExtension()], false);
    const output = await engine.render([simpleTemplate], { fileExtension: '.jsx' });
    expect(output).toContain('Click me');
    expect(output).toContain('Button');
  });
});
