import type { TemplateNode } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import { collectNamedSlotNames, rewriteSlotReferences } from '../src/slots';

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

describe('rewriteSlotReferences', () => {
  const slots = new Set(['icon', 'prefix']);
  const presence = (name: string): string => `$$slots.${name}`;

  it('rewrites a bare slot identifier', () => {
    expect(rewriteSlotReferences('icon', slots, presence)).toBe('$$slots.icon');
  });

  it('rewrites a negated slot reference', () => {
    expect(rewriteSlotReferences('!icon', slots, presence)).toBe(
      '!$$slots.icon'
    );
  });

  it('rewrites every slot reference inside a compound expression', () => {
    expect(rewriteSlotReferences('icon && size > 2', slots, presence)).toBe(
      '$$slots.icon && size > 2'
    );
    expect(rewriteSlotReferences('!icon || prefix', slots, presence)).toBe(
      '!$$slots.icon || $$slots.prefix'
    );
  });

  it('leaves identifiers that name no declared slot verbatim', () => {
    expect(rewriteSlotReferences('pressed', slots, presence)).toBe('pressed');
    expect(rewriteSlotReferences('iconLabel', slots, presence)).toBe(
      'iconLabel'
    );
  });

  it('does not rewrite a member-access tail', () => {
    expect(rewriteSlotReferences('props.icon', slots, presence)).toBe(
      'props.icon'
    );
    expect(rewriteSlotReferences('foo?.icon', slots, presence)).toBe(
      'foo?.icon'
    );
    expect(rewriteSlotReferences('a . icon', slots, presence)).toBe('a . icon');
  });

  it('does not rewrite a slot name inside a string literal', () => {
    expect(rewriteSlotReferences("state === 'icon'", slots, presence)).toBe(
      "state === 'icon'"
    );
    expect(rewriteSlotReferences('icon ? "icon" : x', slots, presence)).toBe(
      '$$slots.icon ? "icon" : x'
    );
  });

  it('is idempotent on already-rewritten output', () => {
    const once = rewriteSlotReferences('!icon', slots, presence)!;
    expect(rewriteSlotReferences(once, slots, presence)).toBe(once);
  });

  it('returns the expression unchanged when there are no named slots', () => {
    expect(rewriteSlotReferences('!icon', new Set(), presence)).toBe('!icon');
  });

  it('returns undefined for an absent expression (an else branch)', () => {
    expect(rewriteSlotReferences(undefined, slots, presence)).toBeUndefined();
  });
});
