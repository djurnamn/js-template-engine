import { process, type StylingContext } from '@js-template-engine/core';
import type { ElementNode, Template } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import { tailwind } from '../src/tailwind-extension';

const context: StylingContext = {
  ancestorElements: [],
  warn() {
    throw new Error('the tailwind extension never warns');
  },
  fail(message): never {
    throw new Error(message);
  },
};

function element(
  classes: string | string[] | undefined,
  tag = 'div'
): ElementNode {
  return {
    type: 'element',
    tag,
    extensions: classes === undefined ? undefined : { tailwind: { classes } },
  };
}

describe('tailwind', () => {
  it('contributes classes in declared order', () => {
    expect(
      tailwind().contributeClasses(element(['px-4', 'py-2']), context)
    ).toEqual(['px-4', 'py-2']);
  });

  it('normalizes the string form', () => {
    expect(
      tailwind().contributeClasses(element('px-4  py-2 px-4'), context)
    ).toEqual(['px-4', 'py-2']);
  });

  it('passes variant-prefixed classes through verbatim', () => {
    expect(
      tailwind().contributeClasses(
        element(['md:px-6', 'hover:bg-blue-700']),
        context
      )
    ).toEqual(['md:px-6', 'hover:bg-blue-700']);
  });

  it('contributes nothing without an override', () => {
    expect(
      tailwind().contributeClasses({ type: 'element', tag: 'div' }, context)
    ).toEqual([]);
    expect(tailwind().contributeClasses(element(undefined), context)).toEqual(
      []
    );
  });
});

describe('process with tailwind', () => {
  it('appends utility classes after static classes', () => {
    const template: Template = [
      {
        type: 'element',
        tag: 'button',
        attributes: { class: ['button'] },
        extensions: { tailwind: { classes: ['px-4', 'py-2'] } },
        children: [{ type: 'text', content: 'Save' }],
      },
    ];
    const result = process(template, { extensions: [tailwind()] });
    expect(result.files[0].content).toContain(
      '<button class="button px-4 py-2">'
    );
  });

  it('never targets utility classes in generated CSS', () => {
    const template: Template = [
      {
        type: 'element',
        tag: 'div',
        attributes: { style: { ':hover': { opacity: '0.5' } } },
        extensions: { tailwind: { classes: ['px-4'] } },
      },
    ];
    const result = process(template, { extensions: [tailwind()] });
    const html = result.files[0].content;
    expect(html).toContain('class="px-4"');
    expect(html).toContain('[data-jte-node="0"]:hover');
    expect(html).not.toContain('.px-4');
  });
});
