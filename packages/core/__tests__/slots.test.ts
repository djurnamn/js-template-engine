import type { TemplateNode } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import { collectNamedSlotNames, slotConditionTarget } from '../src/slots';

describe('collectNamedSlotNames', () => {
  it('collects named slots, descending into wrappers, conditionals, iterations, and fallbacks', () => {
    const nodes: TemplateNode[] = [
      {
        type: 'element',
        tag: 'div',
        children: [
          { type: 'slot', name: 'icon' },
          {
            type: 'conditional',
            conditions: [
              {
                statement: 'if',
                condition: 'x',
                children: [{ type: 'slot', name: 'prefix' }],
              },
            ],
          },
          {
            type: 'iteration',
            items: 'items',
            item: 'item',
            children: [{ type: 'slot', name: 'row' }],
          },
          {
            type: 'slot',
            name: 'outer',
            fallback: [{ type: 'slot', name: 'inner' }],
          },
        ],
      },
    ];
    expect(collectNamedSlotNames(nodes)).toEqual(
      new Set(['icon', 'prefix', 'row', 'outer', 'inner'])
    );
  });

  it('excludes the default (unnamed) slot', () => {
    expect(collectNamedSlotNames([{ type: 'slot' }])).toEqual(new Set());
  });
});

describe('slotConditionTarget', () => {
  const slots = new Set(['icon', 'prefix']);

  it('matches a bare identifier naming a declared slot', () => {
    expect(slotConditionTarget('icon', slots)).toBe('icon');
    expect(slotConditionTarget('  icon  ', slots)).toBe('icon');
  });

  it('does not match an identifier that names no declared slot', () => {
    expect(slotConditionTarget('pressed', slots)).toBeUndefined();
  });

  it('does not match a compound expression that merely contains a slot name', () => {
    expect(slotConditionTarget('icon && size > 2', slots)).toBeUndefined();
    expect(slotConditionTarget('props.icon', slots)).toBeUndefined();
    expect(slotConditionTarget('!icon', slots)).toBeUndefined();
  });

  it('returns undefined for an absent condition (an else branch)', () => {
    expect(slotConditionTarget(undefined, slots)).toBeUndefined();
  });
});
