import { describe, it, expect } from 'vitest';
import { TemplateEngine } from '@js-template-engine/core';
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
    const engine = new TemplateEngine([new VueExtension()], false);
    const result = await engine.render(simpleTemplate, {
      language: 'javascript'
    });
    const output = result.output;
    expect(output).toContain('Click me');
    expect(output).toContain('Slot content');
    expect(output).toContain('<Button');
    expect(output).toContain('<span');
  });
});
