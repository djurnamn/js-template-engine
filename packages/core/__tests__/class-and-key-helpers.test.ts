import { describe, expect, it } from 'vitest';

import {
  isKeyEventModifier,
  KEY_EVENT_MODIFIER_KEYS,
  keyGuardStatement,
} from '../src/key-event-modifiers';
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
