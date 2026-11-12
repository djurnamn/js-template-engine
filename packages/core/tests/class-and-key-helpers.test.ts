import { describe, expect, it } from 'vitest';

import {
  isKeyEventModifier,
  KEY_EVENT_MODIFIER_KEYS,
  keyGuardStatement,
} from '../src/key-event-modifiers';
import { parenthesizeClassExpression } from '../src/class-expression';
import {
  classAttributeQuote,
  classStringLiteral,
  escapeClassAttributeValue,
  groupConditionalClasses,
  isReferenceExpression,
  joinConditions,
  quoteClassAttributeValue,
  withoutConditionalClasses,
} from '../src/class-list';
import { classExpressions, normalizeClassList } from '../src/normalize';

describe('normalizeClassList', () => {
  it('excludes expression entries from the literal class list', () => {
    expect(
      normalizeClassList(['card', { $expression: 'className' }, 'card'])
    ).toEqual(['card']);
    expect(normalizeClassList({ $expression: 'className' })).toEqual([]);
  });
});

describe('classExpressions', () => {
  it('returns nothing for literal-only values', () => {
    expect(classExpressions(undefined)).toEqual([]);
    expect(classExpressions('card card--active')).toEqual([]);
    expect(classExpressions(['card'])).toEqual([]);
  });

  it('collects trimmed expressions in authored order', () => {
    expect(classExpressions({ $expression: ' className ' })).toEqual([
      'className',
    ]);
    expect(
      classExpressions([
        { $expression: 'first' },
        'card',
        { $expression: 'second' },
      ])
    ).toEqual(['first', 'second']);
  });

  it('does not deduplicate expressions (runtime values)', () => {
    expect(
      classExpressions([{ $expression: 'same' }, { $expression: 'same' }])
    ).toEqual(['same', 'same']);
  });
});

describe('parenthesizeClassExpression', () => {
  it('leaves atoms and additive concatenations untouched', () => {
    // These bind at least as tightly as the surrounding `' ' +`, so wrapping
    // them would only add noise (and churn every passthrough golden).
    expect(parenthesizeClassExpression('className')).toBe('className');
    expect(parenthesizeClassExpression('props.tone')).toBe('props.tone');
    expect(parenthesizeClassExpression('tone?.value')).toBe('tone?.value');
    expect(parenthesizeClassExpression("'Block--' + variant")).toBe(
      "'Block--' + variant"
    );
  });

  it('wraps a top-level logical or ternary operator', () => {
    expect(parenthesizeClassExpression("active ? 'on' : 'off'")).toBe(
      "(active ? 'on' : 'off')"
    );
    expect(parenthesizeClassExpression("variant || 'default'")).toBe(
      "(variant || 'default')"
    );
    expect(parenthesizeClassExpression('tone ?? fallback')).toBe(
      '(tone ?? fallback)'
    );
    // `&&` is a hazard in the `' ' +` operand slot (unlike the React
    // short-circuit scanner, which excludes it).
    expect(parenthesizeClassExpression("active && 'is-active'")).toBe(
      "(active && 'is-active')"
    );
  });

  it('ignores operators nested inside parentheses or string literals', () => {
    expect(parenthesizeClassExpression("base('a || b')")).toBe("base('a || b')");
    expect(parenthesizeClassExpression("prefix + (a || b)")).toBe(
      'prefix + (a || b)'
    );
  });

  it('trims before inspecting', () => {
    expect(parenthesizeClassExpression("  variant || 'x'  ")).toBe(
      "(variant || 'x')"
    );
  });
});

describe('key event modifiers', () => {
  it('recognizes exactly the ten key-guard modifiers', () => {
    expect(Object.keys(KEY_EVENT_MODIFIER_KEYS)).toHaveLength(10);
    expect(isKeyEventModifier('enter')).toBe(true);
    expect(isKeyEventModifier('arrow-up')).toBe(true);
    expect(isKeyEventModifier('prevent')).toBe(false);
    expect(isKeyEventModifier('once')).toBe(false);
  });

  it('guards on the corresponding KeyboardEvent.key value', () => {
    expect(keyGuardStatement('enter')).toBe(
      "if (event.key !== 'Enter') return;"
    );
    expect(keyGuardStatement('space')).toBe("if (event.key !== ' ') return;");
    expect(keyGuardStatement('arrow-left')).toBe(
      "if (event.key !== 'ArrowLeft') return;"
    );
  });
});

describe('groupConditionalClasses', () => {
  it('returns one group per entry when no class repeats', () => {
    expect(
      groupConditionalClasses(
        [
          { condition: 'a', attributes: { class: ['one', 'two'] } },
          { condition: 'b', attributes: { class: ['three'] } },
        ],
        []
      )
    ).toEqual([
      { conditions: ['a'], classes: ['one', 'two'] },
      { conditions: ['b'], classes: ['three'] },
    ]);
  });

  it('gates a class repeated across entries on every entry declaring it', () => {
    expect(
      groupConditionalClasses(
        [
          { condition: "v === 'a'", attributes: { class: ['shared', 'a'] } },
          { condition: "v === 'b'", attributes: { class: ['shared', 'b'] } },
        ],
        []
      )
    ).toEqual([
      { conditions: ["v === 'a'", "v === 'b'"], classes: ['shared'] },
      { conditions: ["v === 'a'"], classes: ['a'] },
      { conditions: ["v === 'b'"], classes: ['b'] },
    ]);
  });

  it('drops a conditional class an unconditional class carries', () => {
    expect(
      groupConditionalClasses(
        [{ condition: 'a', attributes: { class: ['btn', 'btn--lg'] } }],
        ['btn']
      )
    ).toEqual([{ conditions: ['a'], classes: ['btn--lg'] }]);
  });

  it('groups classes gated on equal conditions, whichever entries declare them', () => {
    expect(
      groupConditionalClasses(
        [
          { condition: 'a', attributes: { class: ['one'] } },
          { condition: 'a', attributes: { class: ['two', 'one'] } },
        ],
        []
      )
    ).toEqual([{ conditions: ['a'], classes: ['one', 'two'] }]);
  });
});

describe('joinConditions', () => {
  it('parenthesizes a lone condition that binds looser than a ternary test', () => {
    expect(joinConditions(['a ? b : c'])).toBe('(a ? b : c)');
    expect(joinConditions(['a, b'])).toBe('(a, b)');
    expect(joinConditions(['(() => a)() || x => x'])).toBe('((() => a)() || x => x)');
    expect(joinConditions(['open = true'])).toBe('(open = true)');
    expect(joinConditions(['count += 1'])).toBe('(count += 1)');
    expect(joinConditions(['value ??= fallback'])).toBe('(value ??= fallback)');
  });

  it('leaves a lone condition that binds tightly as it is', () => {
    for (const condition of [
      'a || b',
      'a && !b',
      "size === 'large'",
      'a !== b',
      'a == b',
      'a <= b && c >= d',
      'item?.open ?? false',
      'pick(a, b)',
      "check('?')",
      'list.map((x) => x).length > 0',
    ]) {
      expect(joinConditions([condition])).toBe(condition);
    }
  });

  it('returns a single condition as it is and parenthesizes several', () => {
    expect(joinConditions(['isOpen'])).toBe('isOpen');
    expect(joinConditions(["v === 'a'", ' v === "b" '])).toBe(
      "(v === 'a') || (v === \"b\")"
    );
  });
});

describe('isReferenceExpression', () => {
  it('accepts identifiers and member chains only', () => {
    expect(isReferenceExpression('className')).toBe(true);
    expect(isReferenceExpression(' props.tone ')).toBe(true);
    expect(isReferenceExpression('theme?.tone')).toBe(true);
    expect(isReferenceExpression("on ? 'a' : 'b'")).toBe(false);
    expect(isReferenceExpression('cn(tone)')).toBe(false);
    expect(isReferenceExpression("'Block--' + tone")).toBe(false);
  });
});

describe('class attribute escaping', () => {
  it('leaves &, > and the other quote verbatim', () => {
    const value = "[&_svg:not([class*='size-'])]:size-4 has-[>svg]:px-3";
    expect(escapeClassAttributeValue(value)).toBe(value);
    expect(quoteClassAttributeValue(value)).toBe(`"${value}"`);
  });

  it('escapes an & that would begin a character reference', () => {
    expect(escapeClassAttributeValue('[&amp]:x [&#1]:y [&_a]:z')).toBe(
      '[&amp;amp]:x [&amp;#1]:y [&_a]:z'
    );
  });

  it('delimits a value carrying only double quotes with single quotes', () => {
    expect(classAttributeQuote('after:content-["*"]')).toBe("'");
    expect(quoteClassAttributeValue('after:content-["*"]')).toBe(
      `'after:content-["*"]'`
    );
    expect(quoteClassAttributeValue(`a-["x"] b-['y']`)).toBe(
      `"a-[&quot;x&quot;] b-['y']"`
    );
  });
});

describe('classStringLiteral', () => {
  it('picks the first delimiter the text does not contain', () => {
    expect(classStringLiteral('btn')).toBe("'btn'");
    expect(classStringLiteral("[class*='size-']:x")).toBe(
      `"[class*='size-']:x"`
    );
    expect(
      classStringLiteral("[class*='size-']:x", { allowDoubleQuote: false })
    ).toBe("`[class*='size-']:x`");
    expect(classStringLiteral(`a-['x'] b-["y"]`)).toBe("`a-['x'] b-[\"y\"]`");
  });

  it('escapes the single-quoted form when no delimiter fits', () => {
    expect(classStringLiteral("a-['x'] b-[\"y\"] c-[`z`]")).toBe(
      "'a-[\\'x\\'] b-[\"y\"] c-[`z`]'"
    );
    expect(classStringLiteral('a\\b')).toBe("'a\\\\b'");
  });
});

describe('withoutConditionalClasses', () => {
  it('drops the class of each entry and keeps its other attributes under its condition', () => {
    expect(
      withoutConditionalClasses([
        {
          condition: 'open',
          attributes: { class: 'box--open', 'aria-expanded': 'true' },
        },
        { condition: 'busy', attributes: { class: ['box--busy'] } },
      ])
    ).toEqual([
      { condition: 'open', attributes: { 'aria-expanded': 'true' } },
      { condition: 'busy', attributes: {} },
    ]);
  });

  it('returns an entry that sets no class as it is', () => {
    const entry = { condition: 'open', attributes: { 'aria-expanded': 'true' } };
    expect(withoutConditionalClasses([entry])[0]).toBe(entry);
  });
});
