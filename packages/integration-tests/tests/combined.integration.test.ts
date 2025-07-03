import { describe, it, expect } from 'vitest';
import { TemplateEngine } from '@js-template-engine/core';
import { ReactExtension } from '@js-template-engine/extension-react';
import { VueExtension } from '@js-template-engine/extension-vue';
import { BemExtension } from '@js-template-engine/extension-bem';

const template = [
  {
    type: 'element' as const,
    tag: 'Button',
    attributes: { label: 'Combined' },
    extensions: {
      bem: { block: 'button', element: 'icon', modifier: 'active' }
    },
    children: [
      { type: 'text' as const, content: 'Combined Test' }
    ]
  }
];

describe('Combined extensions integration', () => {
  it('renders with React and BEM extensions', async () => {
    const engine = new TemplateEngine([
      new ReactExtension(),
      new BemExtension()
    ], false);
    const output = await engine.render(template, { fileExtension: '.jsx' });
    expect(output).toContain('Combined Test');
    expect(output).toContain('button__icon');
    expect(output).toContain('Button');
  });

  it('throws or errors when combining React and Vue extensions', async () => {
    expect(() => {
      new TemplateEngine([
        new ReactExtension(),
        new VueExtension()
      ], false);
    }).toThrow('Multiple renderer extensions detected: react, vue. Only one renderer extension can be used at a time.');
  });
}); 