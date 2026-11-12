import { describe, expect, it } from 'vitest';

import { mergeAttributeOverride } from '../src/attribute-overrides';

describe('mergeAttributeOverride', () => {
  it('merges per key, the override winning', () => {
    expect(
      mergeAttributeOverride(
        { type: 'button', title: 'Save' },
        { type: 'submit', name: 'save' }
      )
    ).toEqual({ type: 'submit', title: 'Save', name: 'save' });
  });

  it('removes a key the override sets to null', () => {
    expect(
      mergeAttributeOverride(
        { type: 'checkbox', indeterminate: { $expression: 'mixed' } },
        { indeterminate: null, ref: { $expression: 'setMixed' } }
      )
    ).toEqual({ type: 'checkbox', ref: { $expression: 'setMixed' } });
  });

  it('removes a class or style as any other key', () => {
    expect(
      mergeAttributeOverride(
        { class: ['box'], style: { color: 'red' }, id: 'a' },
        { class: null, style: null }
      )
    ).toEqual({ id: 'a' });
  });

  it('leaves the attributes alone without an override, and drops a key nothing sets', () => {
    expect(mergeAttributeOverride({ id: 'a' }, undefined)).toEqual({ id: 'a' });
    expect(mergeAttributeOverride(undefined, { title: null })).toEqual({});
  });
});
