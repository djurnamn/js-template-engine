import { describe, expect, it } from 'vitest';

import {
  readExpressionIdentifiers,
  tokenizeExpression,
} from '../src/expression-scope';

/** The names a script uses here, keywords left out. */
const NAMES = new Set(['isOpen', 'shown', 'label', 'list', 'x', 'i', 'c', 'other']);

/** Each free identifier of `source` among {@link NAMES}, in order. */
function freeNames(source: string): string[] {
  const tokens = tokenizeExpression(source);
  const readings = readExpressionIdentifiers(tokens);
  return tokens
    .filter((token, index) => NAMES.has(token.text) && readings.get(index)?.free === true)
    .map((token) => token.text);
}

describe('tokenizeExpression', () => {
  it('reads a regular expression literal where an operand is expected', () => {
    const tokens = tokenizeExpression("const r = /isOpen/g; const q = /'/; z");
    expect(tokens.filter((token) => token.kind === 'regex').map((token) => token.text)).toEqual([
      '/isOpen/g',
      "/'/",
    ]);
    expect(tokens.at(-1)).toEqual({ kind: 'identifier', text: 'z' });
  });

  it('keeps a slash inside a character class and an escaped one in the literal', () => {
    const tokens = tokenizeExpression('split(/[/\\/]/)');
    expect(tokens.map((token) => token.text)).toEqual(['split', '(', '/[/\\/]/', ')']);
  });

  it('reads a division after an operand', () => {
    for (const source of ['a / b / 2', '(a) / b', 'list[0] / 2', '1 / x']) {
      expect(tokenizeExpression(source).some((token) => token.kind === 'regex')).toBe(false);
    }
  });

  it('reads a regular expression after a keyword and at the start', () => {
    expect(tokenizeExpression('return /x/.test(y)')[2]).toEqual({ kind: 'regex', text: '/x/' });
    expect(tokenizeExpression('/x/.test(y)')[0]).toEqual({ kind: 'regex', text: '/x/' });
  });

  it('reads a division after a postfix increment or decrement', () => {
    for (const source of ['a-- / 2 + isOpen / 3', 'list[0]++ / 2 / isOpen', '(a)-- / b / c']) {
      expect(tokenizeExpression(source).some((token) => token.kind === 'regex')).toBe(false);
    }
    expect(tokenizeExpression('x = ++/a/.lastIndex').some((token) => token.kind === 'regex')).toBe(true);
  });

  it('leaves a lone slash with no closing one on its line a punctuator', () => {
    expect(tokenizeExpression('= /\nx').map((token) => token.kind)).toEqual([
      'punctuator',
      'space',
      'punctuator',
      'space',
      'identifier',
    ]);
  });
});

describe('readExpressionIdentifiers', () => {
  it('reads a class field name as no reference, its initializer as one', () => {
    expect(freeNames('class Box { isOpen = isOpen; static count = 0\n  label }')).toEqual(['isOpen']);
    expect(freeNames('class Box { readonly isOpen: boolean = shown }')).toEqual(['shown']);
  });

  it('reads a private name as no reference', () => {
    expect(freeNames('class Box { #isOpen = isOpen; get shown() { return this.#isOpen; } }')).toEqual(['isOpen']);
  });

  it('reads an object key or method named class as no class body', () => {
    expect(freeNames('const o = { class: { isOpen }, other }; const p = { class() { return label; } };')).toEqual([
      'isOpen',
      'other',
      'label',
    ]);
    const tokens = tokenizeExpression('const o = { class: { isOpen } };');
    const readings = readExpressionIdentifiers(tokens);
    const index = tokens.findIndex((token) => token.text === 'isOpen');
    expect(readings.get(index)?.shorthandProperty).toBe(true);
  });

  it('reads a field initializer on its own line as a reference', () => {
    expect(freeNames('class Box {\n  a =\n    isOpen\n}')).toEqual(['isOpen']);
  });

  it('reads a label and the break naming it as no reference', () => {
    expect(freeNames('isOpen: for (const x of list) { if (x) break isOpen; continue isOpen; }')).toEqual(['list']);
  });

  it('still reads a conditional branch and a case as references', () => {
    expect(freeNames('const a = c ? isOpen : other; switch (x) { case isOpen: break; }')).toEqual([
      'c',
      'isOpen',
      'other',
      'x',
      'isOpen',
    ]);
  });

  it('scopes a var to its function, not its block', () => {
    expect(freeNames('function f() { if (x) { var isOpen = 1; } return isOpen; } isOpen')).toEqual([
      'x',
      'isOpen',
    ]);
    expect(freeNames('function f() { for (var i = 0; i < 2; i++) {} return i; }')).toEqual([]);
  });

  it('reads a name in a regular expression as no reference', () => {
    expect(freeNames("const r = /isOpen/; const q = /'/; isOpen")).toEqual(['isOpen']);
  });
});
