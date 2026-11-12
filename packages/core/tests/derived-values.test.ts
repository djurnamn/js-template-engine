import { describe, expect, it } from 'vitest';

import {
  arrowBodyOf,
  derivedComment,
  derivedValuesOf,
} from '../src/derived-values';
import {
  flattenTemplateLiterals,
  tokenizeExpression,
} from '../src/expression-scope';
import { propAliases } from '../src/local-bindings';

describe('derived values', () => {
  it('lists the derived values in declaration order', () => {
    expect(derivedValuesOf({ derived: { b: 'a + 1', a: '1' } })).toEqual([
      { name: 'b', expression: 'a + 1' },
      { name: 'a', expression: '1' },
    ]);
    expect(derivedValuesOf({})).toEqual([]);
  });

  it('parenthesizes an object literal as an arrow body only', () => {
    expect(arrowBodyOf('  { total }  ')).toBe('({ total })');
    expect(arrowBodyOf(' rows.length ')).toBe('rows.length');
  });

  it('writes a one-line comment naming the value and its expression', () => {
    expect(derivedComment({ name: 'total', expression: 'a +\n    b' })).toBe(
      'total = a + b'
    );
  });

  it('keeps a prop alias clear of the derived names', () => {
    expect(
      propAliases(['aria-label'], { derived: { ariaLabel: "'x'" } }).get(
        'aria-label'
      )
    ).not.toBe('ariaLabel');
  });

  it('splits a template literal at its placeholders', () => {
    const tokens = flattenTemplateLiterals(
      tokenizeExpression('`${count} of ${{ total }.total}`')
    );
    expect(tokens.map((token) => token.text).join('')).toBe(
      '`${count} of ${{ total }.total}`'
    );
    expect(
      tokens
        .filter((token) => token.kind === 'identifier')
        .map((token) => token.text)
    ).toEqual(['count', 'total', 'total']);
  });
});
