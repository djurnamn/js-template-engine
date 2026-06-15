import {
  process,
  type StylingContext,
} from '@js-template-engine/core';
import type { ElementNode, Template } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import { bem } from '../src/bem-extension';

function element(
  overrides: NonNullable<ElementNode['extensions']>['bem'],
  tag = 'div'
): ElementNode {
  return { type: 'element', tag, extensions: { bem: overrides } };
}

function context(
  ancestorElements: ElementNode[] = [],
  warnings: string[] = []
): StylingContext {
  return {
    ancestorElements,
    warn(message) {
      warnings.push(message);
    },
    fail(message): never {
      throw new Error(message);
    },
  };
}

describe('bem', () => {
  it('contributes the block class', () => {
    expect(bem().contributeClasses(element({ block: 'button' }), context()))
      .toEqual(['button']);
  });

  it('joins block and element', () => {
    expect(
      bem().contributeClasses(
        element({ block: 'button', element: 'icon' }),
        context()
      )
    ).toEqual(['button__icon']);
  });

  it('appends one class per modifier in declared order', () => {
    expect(
      bem().contributeClasses(
        element({ block: 'button', modifiers: ['primary', 'large'] }),
        context()
      )
    ).toEqual(['button', 'button--primary', 'button--large']);
  });

  it('attaches modifiers to the block__element base', () => {
    expect(
      bem().contributeClasses(
        element({ block: 'card', element: 'title', modifiers: ['centered'] }),
        context()
      )
    ).toEqual(['card__title', 'card__title--centered']);
  });

  it('uses the configured separators', () => {
    expect(
      bem({ elementSeparator: '-', modifierSeparator: '_' }).contributeClasses(
        element({ block: 'button', element: 'icon', modifiers: ['large'] }),
        context()
      )
    ).toEqual(['button-icon', 'button-icon_large']);
  });

  it('inherits the nearest ancestor declared block', () => {
    const outer = element({ block: 'card' }, 'article');
    const inner = element({ block: 'media' }, 'figure');
    expect(
      bem().contributeClasses(
        element({ element: 'caption' }),
        context([outer, inner])
      )
    ).toEqual(['media__caption']);
  });

  it('inherits through ancestors that declare only an element', () => {
    const root = element({ block: 'card' }, 'article');
    const body = element({ element: 'body' }, 'section');
    expect(
      bem().contributeClasses(element({ element: 'title' }), context([root, body]))
    ).toEqual(['card__title']);
  });

  it('inherits a block for modifier-only overrides', () => {
    expect(
      bem().contributeClasses(
        element({ modifiers: ['active'] }),
        context([element({ block: 'tab' }, 'nav')])
      )
    ).toEqual(['tab', 'tab--active']);
  });

  it('contributes nothing without an override', () => {
    const warnings: string[] = [];
    expect(
      bem().contributeClasses(
        { type: 'element', tag: 'div' },
        context([], warnings)
      )
    ).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('contributes nothing for an empty override without warning', () => {
    const warnings: string[] = [];
    expect(bem().contributeClasses(element({}), context([], warnings))).toEqual(
      []
    );
    expect(warnings).toEqual([]);
  });

  it('warns when element or modifiers have no effective block', () => {
    const warnings: string[] = [];
    expect(
      bem().contributeClasses(element({ element: 'icon' }), context([], warnings))
    ).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('no effective block');
  });

  it('treats empty strings as absent', () => {
    expect(
      bem().contributeClasses(
        element({ block: '', element: 'icon' }),
        context([element({ block: 'button' }, 'span')])
      )
    ).toEqual(['button__icon']);
  });
});

describe('process with bem', () => {
  const template: Template = [
    {
      type: 'element',
      tag: 'article',
      attributes: { class: ['featured'] },
      extensions: { bem: { block: 'card' } },
      children: [
        {
          type: 'element',
          tag: 'h2',
          attributes: { style: { ':hover': { color: 'red' } } },
          extensions: { bem: { element: 'title', modifiers: ['centered'] } },
          children: [{ type: 'text', content: 'Hello' }],
        },
      ],
    },
  ];

  it('renders merged class lists and targets the BEM class', () => {
    const result = process(template, { extensions: [bem()] });
    const html = result.files[0].content;
    expect(html).toContain('<article class="featured card">');
    expect(html).toContain(
      '<h2 class="card__title card__title--centered">'
    );
    expect(html).toContain('.card__title:hover');
    expect(result.warnings).toEqual([]);
  });

  it('reports the node path when no effective block exists', () => {
    const orphan: Template = [element({ element: 'icon' }, 'span')];
    const result = process(orphan, { extensions: [bem()] });
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].nodePath).toBe('children[0]');
  });
});
