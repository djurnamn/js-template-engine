import { describe, expect, it } from 'vitest';

import {
  isKeyEventModifier,
  KEY_EVENT_MODIFIER_KEYS,
  keyGuardStatement,
} from '../src/key-event-modifiers';
import { parenthesizeClassExpression } from '../src/class-expression';
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
