import type { TemplateNode } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import {
  collectNamedSlotNames,
  rewriteSlotReferences,
  withShadowedSlotNames,
} from '../src/slots';

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

  describe('a name the expression binds itself shadows the slot', () => {
    const optionSlot = new Set(['option']);
    const vue = (name: string): string => `$slots.${name}`;
    const cases: Array<[string, string, string]> = [
      [
        'an arrow parameter',
        'options.find((option) => option.value === picked)?.label',
        'options.find((option) => option.value === picked)?.label',
      ],
      [
        'an unparenthesized arrow parameter',
        'options.map(option => option.label).join(", ") || option',
        'options.map(option => option.label).join(", ") || $slots.option',
      ],
      [
        'a function parameter',
        'options.filter(function (option) { return option.enabled; })',
        'options.filter(function (option) { return option.enabled; })',
      ],
      [
        'a destructured parameter',
        'options.map(({ option, label: name }) => option ?? name)',
        'options.map(({ option, label: name }) => option ?? name)',
      ],
      [
        'a renamed destructured parameter',
        'options.map(({ value: option }) => option)',
        'options.map(({ value: option }) => option)',
      ],
      [
        'a nested array pattern',
        'pairs.map(([key, [option]]) => key + option)',
        'pairs.map(([key, [option]]) => key + option)',
      ],
      [
        'a defaulted parameter, whose default still reads the slot',
        'render((option = fallback) => option, option)',
        'render((option = fallback) => option, $slots.option)',
      ],
      [
        'a rest parameter',
        'join((...option) => option.length)',
        'join((...option) => option.length)',
      ],
      [
        'a typed parameter and return type',
        'options.some((option: Option): boolean => option.selected)',
        'options.some((option: Option): boolean => option.selected)',
      ],
      [
        'a const declaration in a block body',
        'run(() => { const option = pick(); return option; }) && option',
        'run(() => { const option = pick(); return option; }) && $slots.option',
      ],
      [
        'a destructuring let declaration',
        'run(() => { let { option } = state; return option; })',
        'run(() => { let { option } = state; return option; })',
      ],
      [
        'a catch binding',
        'run(() => { try { return go(); } catch (option) { return option; } })',
        'run(() => { try { return go(); } catch (option) { return option; } })',
      ],
      [
        'a for-of binding',
        'run(() => { for (const option of options) { use(option); } return option; })',
        'run(() => { for (const option of options) { use(option); } return $slots.option; })',
      ],
      [
        'a function declaration in a block',
        'run(() => { function option() { return 1; } return option(); })',
        'run(() => { function option() { return 1; } return option(); })',
      ],
      [
        'a named function expression',
        'run(function option(depth) { return depth ? option(depth - 1) : 0; })',
        'run(function option(depth) { return depth ? option(depth - 1) : 0; })',
      ],
    ];
    it.each(cases)('%s', (_label, expression, expected) => {
      expect(rewriteSlotReferences(expression, optionSlot, vue)).toBe(expected);
    });

    it('reads a slot in a destructured default, which is not the binding', () => {
      expect(
        rewriteSlotReferences(
          'items.map(({ a = option }) => a)',
          optionSlot,
          vue
        )
      ).toBe('items.map(({ a = $slots.option }) => a)');
    });

    it('reads a function type in a parameter annotation as a type, not an arrow', () => {
      expect(
        rewriteSlotReferences(
          'run((cb: (option: Option) => void = (x) => option) => cb)',
          optionSlot,
          vue
        )
      ).toBe(
        'run((cb: (option: Option) => void = (x) => $slots.option) => cb)'
      );
    });

    it('scopes declarations in catch, labeled and case blocks', () => {
      expect(
        rewriteSlotReferences(
          'run(() => { try { go(); } catch { const option = 1; use(option); } return option; })',
          optionSlot,
          vue
        )
      ).toBe(
        'run(() => { try { go(); } catch { const option = 1; use(option); } return $slots.option; })'
      );
      expect(
        rewriteSlotReferences(
          'run((kind) => { switch (kind) { case 1: { const option = 2; return option; } } return option; })',
          optionSlot,
          vue
        )
      ).toBe(
        'run((kind) => { switch (kind) { case 1: { const option = 2; return option; } } return $slots.option; })'
      );
      expect(
        rewriteSlotReferences(
          'run(() => { const value = flag ? 1 : { option }; return value; })',
          optionSlot,
          vue
        )
      ).toBe(
        'run(() => { const value = flag ? 1 : { option: $slots.option }; return value; })'
      );
    });

    it('scopes a parameter to its own function only', () => {
      expect(
        rewriteSlotReferences(
          'option && options.find((option) => option.value) && option',
          optionSlot,
          vue
        )
      ).toBe(
        '$slots.option && options.find((option) => option.value) && $slots.option'
      );
      expect(
        rewriteSlotReferences('flag ? (x) => x : option', optionSlot, vue)
      ).toBe('flag ? (x) => x : $slots.option');
    });

    it('reads object literal keys as keys and keeps shorthand keys', () => {
      expect(
        rewriteSlotReferences('{ option: 1, value: option }', optionSlot, vue)
      ).toBe('{ option: 1, value: $slots.option }');
      expect(rewriteSlotReferences('{ option }', optionSlot, vue)).toBe(
        '{ option: $slots.option }'
      );
      expect(
        rewriteSlotReferences(
          'items.map((item) => ({ item, option }))',
          optionSlot,
          vue
        )
      ).toBe('items.map((item) => ({ item, option: $slots.option }))');
    });

    it('rewrites a spread of the slot', () => {
      expect(rewriteSlotReferences('[...option]', optionSlot, vue)).toBe(
        '[...$slots.option]'
      );
    });
  });
});

describe('withShadowedSlotNames', () => {
  it('leaves the shadowed names out while the subtree renders, then restores them', () => {
    const scope = {
      namedSlots: new Set(['option', 'icon']) as ReadonlySet<string>,
    };
    const inside = withShadowedSlotNames(scope, ['option', undefined], () =>
      rewriteSlotReferences(
        'option.label && icon',
        scope.namedSlots,
        (name) => `$slots.${name}`
      )
    );
    expect(inside).toBe('option.label && $slots.icon');
    expect([...scope.namedSlots]).toEqual(['option', 'icon']);
  });

  it('restores the slots when the subtree throws', () => {
    const enclosing = new Set(['option']);
    const scope = { namedSlots: enclosing as ReadonlySet<string> };
    expect(() =>
      withShadowedSlotNames(scope, ['option'], () => {
        throw new Error('render failed');
      })
    ).toThrow('render failed');
    expect(scope.namedSlots).toBe(enclosing);
  });
});
