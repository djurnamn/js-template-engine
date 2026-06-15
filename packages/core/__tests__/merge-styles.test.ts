import { describe, expect, it } from 'vitest';

import { mergeStyleObjects } from '../src/merge-styles';

describe('mergeStyleObjects', () => {
  it('keeps base order and appends override-only keys', () => {
    expect(
      Object.entries(
        mergeStyleObjects(
          { padding: '1rem', color: 'blue' },
          { margin: '2rem' }
        )
      )
    ).toEqual([
      ['padding', '1rem'],
      ['color', 'blue'],
      ['margin', '2rem'],
    ]);
  });

  it('lets the override win property conflicts', () => {
    expect(
      mergeStyleObjects(
        { backgroundColor: 'blue', padding: '1rem' },
        { backgroundColor: 'rebeccapurple' }
      )
    ).toEqual({ backgroundColor: 'rebeccapurple', padding: '1rem' });
  });

  it('compares plain properties across camelCase and kebab-case', () => {
    expect(
      mergeStyleObjects(
        { backgroundColor: 'blue' },
        { 'background-color': 'red' }
      )
    ).toEqual({ 'background-color': 'red' });
    expect(
      mergeStyleObjects({ '--badge-size': '1rem' }, { '--badge-size': '2rem' })
    ).toEqual({ '--badge-size': '2rem' });
  });

  it('merges nested selector blocks recursively', () => {
    expect(
      mergeStyleObjects(
        { ':hover': { color: 'red', opacity: '0.5' } },
        { ':hover': { color: 'blue' }, '@media print': { display: 'none' } }
      )
    ).toEqual({
      ':hover': { color: 'blue', opacity: '0.5' },
      '@media print': { display: 'none' },
    });
  });

  it('replaces a leaf with a block (and a block with a leaf) wholesale', () => {
    expect(
      mergeStyleObjects({ ':hover': { color: 'red' } }, { ':hover': { $expression: 'x' } as never })
    ).toEqual({ ':hover': { $expression: 'x' } });
  });

  it('compares selector keys verbatim', () => {
    expect(
      mergeStyleObjects(
        { '.button--large &': { fontSize: '2rem' } },
        { '.button--small &': { fontSize: '1rem' } }
      )
    ).toEqual({
      '.button--large &': { fontSize: '2rem' },
      '.button--small &': { fontSize: '1rem' },
    });
  });
});
