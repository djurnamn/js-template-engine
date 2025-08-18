import { describe, it, expect } from 'vitest';
import { TemplateEngine } from '@js-template-engine/core';
import { BemExtension } from '@js-template-engine/extension-bem';

const bemTemplate = [
  {
    type: 'element' as const,
    tag: 'button',
    attributes: {},
    extensions: {
      bem: { block: 'button', element: 'icon', modifier: 'active' },
    },
    children: [{ type: 'text' as const, content: 'BEM Button' }],
  },
];

describe('BEM extension integration', () => {
  it('renders a component with BEM class output', async () => {
    const engine = new TemplateEngine([new BemExtension()], false);
    const result = await engine.render(bemTemplate, {});
    const output = result.output;
    expect(output).toContain('button__icon');
    expect(output).toContain('button__icon--active');
    expect(output).toContain('BEM Button');
  });
});
