import { describe, expect, it } from 'vitest';

import { optionalPropType } from '../src/optional-prop-type';

describe('optionalPropType', () => {
  it('widens a type with | undefined', () => {
    expect(optionalPropType('string')).toBe('string | undefined');
    expect(optionalPropType("'primary' | 'secondary'")).toBe(
      "'primary' | 'secondary' | undefined"
    );
    expect(optionalPropType('Array<string | number>')).toBe(
      'Array<string | number> | undefined'
    );
  });

  it('keeps a type that already admits undefined at its top level', () => {
    expect(optionalPropType('boolean | undefined')).toBe('boolean | undefined');
    expect(optionalPropType('undefined | string')).toBe('undefined | string');
  });

  it('keeps any and unknown, which admit undefined, as written', () => {
    expect(optionalPropType('any')).toBe('any');
    expect(optionalPropType('unknown')).toBe('unknown');
    expect(optionalPropType(' any ')).toBe('any');
    expect(optionalPropType('string | unknown')).toBe('string | unknown');
    expect(optionalPropType('Array<any>')).toBe('Array<any> | undefined');
    expect(optionalPropType('anyValue')).toBe('anyValue | undefined');
  });

  it('does not count an undefined nested in a member or a string', () => {
    expect(optionalPropType('Array<string | undefined>')).toBe(
      'Array<string | undefined> | undefined'
    );
    expect(optionalPropType("'undefined'")).toBe("'undefined' | undefined");
  });

  it('parenthesizes a function or conditional type first', () => {
    expect(optionalPropType('(value: string) => void')).toBe(
      '((value: string) => void) | undefined'
    );
    expect(optionalPropType('(item: Item) => string | undefined')).toBe(
      '((item: Item) => string | undefined) | undefined'
    );
    expect(optionalPropType("T extends string ? 'text' : 'other'")).toBe(
      "(T extends string ? 'text' : 'other') | undefined"
    );
    expect(optionalPropType('string | ((value: string) => void)')).toBe(
      'string | ((value: string) => void) | undefined'
    );
  });
});
