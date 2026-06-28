import { TemplateError } from '@js-template-engine/core';
import { describe, expect, it } from 'vitest';

import { collectSlotProps, normalizeSlotName } from '../src/props';

describe('normalizeSlotName', () => {
  it('converts kebab-case and snake_case to camelCase', () => {
    expect(normalizeSlotName('navigation-menu')).toBe('navigationMenu');
    expect(normalizeSlotName('footer_content')).toBe('footerContent');
    expect(normalizeSlotName('header')).toBe('header');
  });

  it('prefixes names starting with a digit', () => {
    expect(normalizeSlotName('123invalid')).toBe('_123invalid');
  });
});

describe('collectSlotProps', () => {
  it('collects slots in document order with the default slot as children', () => {
    expect(
      collectSlotProps(
        [
          {
            type: 'element',
            tag: 'header',
            children: [{ type: 'slot', name: 'header' }],
          },
          { type: 'slot' },
        ],
        {}
      )
    ).toEqual([
      { slotName: 'header', propName: 'header', exposes: [] },
      { slotName: undefined, propName: 'children', exposes: [] },
    ]);
  });

  it('deduplicates repeated uses of the same slot name', () => {
    expect(
      collectSlotProps([{ type: 'slot' }, { type: 'slot' }], {})
    ).toEqual([{ slotName: undefined, propName: 'children', exposes: [] }]);
  });

  it('captures a scoped slot exposes record in normalized form', () => {
    expect(
      collectSlotProps(
        [{ type: 'slot', exposes: { api: 'api', state: { value: 'machine.state', type: 'State' } } }],
        {}
      )
    ).toEqual([
      {
        slotName: undefined,
        propName: 'children',
        exposes: [
          { name: 'api', value: 'api' },
          { name: 'state', value: 'machine.state', type: 'State' },
        ],
      },
    ]);
  });

  it('rejects two slot names normalizing to the same prop name', () => {
    expect(() =>
      collectSlotProps(
        [{ type: 'slot', name: 'nav-menu' }, { type: 'slot', name: 'navMenu' }],
        {}
      )
    ).toThrowError(TemplateError);
  });

  it('rejects a slot colliding with a declared prop', () => {
    expect(() =>
      collectSlotProps([{ type: 'slot', name: 'header' }], {
        header: { type: 'string' },
      })
    ).toThrowError(TemplateError);
  });
});
