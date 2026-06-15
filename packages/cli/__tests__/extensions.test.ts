import type { StylingExtension } from '@js-template-engine/core';
import type { ElementNode } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import { buildExtensions } from '../src/extensions';

describe('buildExtensions', () => {
  it('returns no extensions for HTML mode without styling', () => {
    expect(buildExtensions(undefined, [])).toEqual([]);
  });

  it('maps each framework name to its extension', () => {
    for (const name of ['react', 'vue', 'svelte'] as const) {
      const extensions = buildExtensions(name, []);
      expect(extensions.map((extension) => extension.key)).toEqual([name]);
    }
  });

  it('keeps styling extensions in the order given, before the framework', () => {
    const extensions = buildExtensions('react', ['tailwind', 'bem']);
    expect(extensions.map((extension) => extension.key)).toEqual([
      'tailwind',
      'bem',
      'react',
    ]);
  });

  it('forwards separator options to the BEM factory', () => {
    const [extension] = buildExtensions(undefined, ['bem'], {
      elementSeparator: '-',
      modifierSeparator: '_',
    });
    const element: ElementNode = {
      type: 'element',
      tag: 'span',
      extensions: {
        bem: { block: 'button', element: 'icon', modifiers: ['large'] },
      },
    };
    const classes = (extension as StylingExtension).contributeClasses(
      element,
      {
        ancestorElements: [],
        warn: () => {},
        fail: (message): never => {
          throw new Error(message);
        },
      }
    );
    expect(classes).toEqual(['button-icon', 'button-icon_large']);
  });

  it('forwards the output option to the Tailwind factory', () => {
    const element: ElementNode = {
      type: 'element',
      tag: 'span',
      extensions: { tailwind: { classes: ['px-4'] } },
    };
    const context = {
      ancestorElements: [],
      warn: () => {},
      fail: (message: string): never => {
        throw new Error(message);
      },
    };
    const [passThrough] = buildExtensions(undefined, ['tailwind']);
    expect(
      (passThrough as StylingExtension).contributeClasses(element, context)
    ).toEqual(['px-4']);

    const [converting] = buildExtensions(
      undefined,
      ['tailwind'],
      {},
      { output: 'styles' }
    );
    expect(
      (converting as StylingExtension).contributeClasses(element, context)
    ).toEqual([]);
    expect(
      (converting as StylingExtension).contributeStyles?.(element, context)
    ).toEqual({ paddingInline: '1rem' });
  });
});
