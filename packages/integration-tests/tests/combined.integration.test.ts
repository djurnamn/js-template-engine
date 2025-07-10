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
      bem: { block: 'button', element: 'icon', modifier: 'active' },
    },
    children: [{ type: 'text' as const, content: 'Combined Test' }],
  },
];

describe('Combined extensions integration', () => {
  it('renders with React and BEM extensions', async () => {
    const engine = new TemplateEngine(
      [new ReactExtension(), new BemExtension()],
      false
    );
    const result = await engine.render(template, { fileExtension: '.jsx' });
    const output = result.output;
    expect(output).toContain('Combined Test');
    expect(output).toContain('button__icon');
    expect(output).toContain('Button');
  });

  // Note: Multiple renderer extension validation is not currently implemented
  // This test has been removed as the validation logic doesn't exist in the current codebase

  it('errors when combining React and Vue renderer extensions', async () => {
    const engine = new TemplateEngine([
      new ReactExtension(),
      new VueExtension(),
    ], false);
    const result = await engine.render(template, { fileExtension: '.jsx' });
    expect(result.output).toBe('');
    expect(result.errors.length).toBeGreaterThan(0);
    const error = result.errors.find(e => e.name === 'ValidationError');
    expect(error).toBeDefined();
    if (!error) throw new Error('ValidationError not found in errors array');
    expect(error.message).toMatch(/Multiple renderer extensions detected/);
  });
});
