import { describe, expect, it } from 'vitest';

import { layerStyleObjects, mergeStyleObjects } from '../src/merge-styles';
import {
  serializeRules,
  serializeRulesScss,
  toKebabCaseProperty,
} from '../src/html/styles';

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
      mergeStyleObjects(
        { ':hover': { color: 'red' } },
        { ':hover': { $expression: 'x' } as never }
      )
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

describe('layerStyleObjects', () => {
  const dark = '@media (prefers-color-scheme: dark)';
  const medium = '@media (min-width: 48rem)';

  it('layers an authored block into the last contributed self block holding its key', () => {
    const layered = layerStyleObjects(
      {
        [medium]: { padding: '1rem' },
        [dark]: { color: 'white' },
        '&': { [medium]: { [dark]: { color: 'gray' } } },
      },
      { [medium]: { [dark]: { color: 'black' } } }
    );
    expect(JSON.stringify(layered)).toBe(
      JSON.stringify({
        [medium]: { padding: '1rem' },
        [dark]: { color: 'white' },
        '&': { [medium]: { [dark]: { color: 'black' } } },
      })
    );
    const hover = '@media (hover: hover)';
    const twoKeys = layerStyleObjects(
      {
        [hover]: { ':hover': { color: 'red' } },
        ':first-child': { color: 'gray' },
        '&': {
          [hover]: { ':hover': { color: 'orange' } },
          ':first-child': { color: 'silver' },
        },
      },
      {
        ':first-child': { color: 'blue' },
        [hover]: { ':hover': { color: 'green' } },
      }
    );
    expect(JSON.stringify(twoKeys)).toBe(
      JSON.stringify({
        [hover]: { ':hover': { color: 'red' } },
        ':first-child': { color: 'gray' },
        '&': {
          [hover]: { ':hover': { color: 'orange' } },
          ':first-child': { color: 'blue' },
        },
        ':is(&)': { [hover]: { ':hover': { color: 'green' } } },
      })
    );
    const nested = layerStyleObjects(
      {
        ':hover': { color: 'red' },
        [dark]: { color: 'white' },
        '&': { ':hover': { color: 'blue' }, ':is(&)': { ':hover': {} } },
      },
      { ':hover': { color: 'black' }, ':focus': { color: 'green' } }
    );
    expect(JSON.stringify(nested)).toBe(
      JSON.stringify({
        ':hover': { color: 'red' },
        [dark]: { color: 'white' },
        '&': {
          ':hover': { color: 'blue' },
          ':is(&)': { ':hover': { color: 'black' } },
        },
        ':focus': { color: 'green' },
      })
    );
  });

  it('merges in place where neither layer is reordered', () => {
    const layered = layerStyleObjects(
      {
        paddingInline: '1rem',
        backgroundColor: 'blue',
        borderRadius: '0.375rem',
        ':hover': { color: 'red' },
        [medium]: { padding: '2rem' },
      },
      { backgroundColor: 'rebeccapurple', ':hover': { color: 'blue' } }
    );
    expect(Object.entries(layered)).toEqual([
      ['paddingInline', '1rem'],
      ['backgroundColor', 'rebeccapurple'],
      ['borderRadius', '0.375rem'],
      [':hover', { color: 'blue' }],
      [medium, { padding: '2rem' }],
    ]);
  });

  it('keeps contributed blocks in their order (dark:text-white md:text-black)', () => {
    const layered = layerStyleObjects(
      { [dark]: { color: '#fff' }, [medium]: { color: '#000' } },
      { '&[data-x]': { padding: '1px' }, [dark]: { margin: '0' } }
    );
    expect(Object.entries(layered)).toEqual([
      [dark, { color: '#fff' }],
      [medium, { color: '#000' }],
      ['&[data-x]', { padding: '1px' }],
      ['&', { [dark]: { margin: '0' } }],
    ]);
  });

  it('keeps an authored block after the contributed one it overrides', () => {
    const layered = layerStyleObjects(
      { [dark]: { color: '#fff' } },
      { [medium]: { color: 'red' }, [dark]: { margin: '0' } }
    );
    expect(Object.entries(layered)).toEqual([
      [dark, { color: '#fff' }],
      [medium, { color: 'red' }],
      ['&', { [dark]: { margin: '0' } }],
    ]);
  });

  it('keeps authored declarations in order and after what they override', () => {
    expect(
      Object.entries(
        layerStyleObjects(
          { paddingLeft: '1rem', padding: '0.5rem' },
          { padding: '1rem', paddingLeft: '2rem' }
        )
      )
    ).toEqual([
      ['padding', '1rem'],
      ['paddingLeft', '2rem'],
    ]);
    expect(
      Object.entries(
        layerStyleObjects(
          { paddingLeft: '1rem', padding: '0.5rem' },
          { paddingLeft: '2rem' }
        )
      )
    ).toEqual([
      ['padding', '0.5rem'],
      ['paddingLeft', '2rem'],
    ]);
    expect(
      Object.entries(
        layerStyleObjects(
          { width: '1rem', inlineSize: '2rem' },
          { width: '3rem' }
        )
      )
    ).toEqual([
      ['inlineSize', '2rem'],
      ['width', '3rem'],
    ]);
  });

  it('keeps a hand-written dark override after the authored key before it', () => {
    const selectorDark = ':where(:root:is([data-mode="dark"])) &';
    const layered = layerStyleObjects(
      { padding: '1rem', [selectorDark]: { backgroundColor: 'black' } },
      {
        '&[data-featured="true"]': { boxShadow: 'indigo' },
        [selectorDark]: {
          boxShadow: 'white',
          '&[data-featured="true"]': { boxShadow: 'indigo-500' },
        },
      }
    );
    expect(Object.entries(layered)).toEqual([
      ['padding', '1rem'],
      [selectorDark, { backgroundColor: 'black' }],
      ['&[data-featured="true"]', { boxShadow: 'indigo' }],
      [
        '&',
        {
          [selectorDark]: {
            boxShadow: 'white',
            '&[data-featured="true"]': { boxShadow: 'indigo-500' },
          },
        },
      ],
    ]);
  });

  it('layers inside a block merged in place', () => {
    const layered = layerStyleObjects(
      { [medium]: { ':hover': { color: 'red' }, ':focus': { color: 'blue' } } },
      { [medium]: { ':focus': { margin: '0' }, ':hover': { margin: '1px' } } }
    );
    expect(layered).toEqual({
      [medium]: {
        ':hover': { color: 'red' },
        ':focus': { color: 'blue', margin: '0' },
        '&': { ':hover': { margin: '1px' } },
      },
    });
  });

  it('picks a self key no other key uses', () => {
    const layered = layerStyleObjects(
      { ':hover': { color: 'red' }, '&': { color: 'blue' } },
      { ':focus': { margin: '0' }, ':hover': { margin: '1px' } }
    );
    expect(Object.keys(layered)).toEqual([':hover', '&', ':focus', ':is(&)']);
  });
});

describe('self keys in serialized rules', () => {
  const dark = '@media (prefers-color-scheme: dark)';
  const vocabulary = [{ baseClass: 'card', modifierSeparator: '--' }];
  // The authored `&` takes the self key, so the later blocks go under `:is(&)`.
  const layered = layerStyleObjects(
    { [dark]: { color: 'white' } },
    {
      '&': { color: 'a' },
      '&[x]': { color: 'b' },
      [dark]: { margin: '0' },
      '&.card--featured': { color: 'f' },
    }
  );

  it('falls back to :is(&) when & is taken', () => {
    expect(Object.keys(layered)).toEqual([dark, '&', '&[x]', ':is(&)']);
  });

  it('keeps a BEM collapse inside a self key', () => {
    const css = serializeRules('.card', layered, vocabulary).join('\n');
    expect(css).toContain('.card--featured {');
    expect(css).not.toContain(':is(');
    expect(css).not.toContain('.card.card--featured');
    const scss = serializeRulesScss('.card', layered, vocabulary);
    expect(scss).toContain('&--featured {');
    expect(scss).not.toContain(':is(');
  });
});

describe('toKebabCaseProperty', () => {
  it('kebab-cases a camelCase property', () => {
    expect(toKebabCaseProperty('borderRadius')).toBe('border-radius');
  });

  it('leaves a custom property untouched, capitals included', () => {
    // Custom property names are case-sensitive: a capital is part of the name,
    // not a word boundary, so `--kit-component--Badge--size` must survive.
    expect(toKebabCaseProperty('--badge-size')).toBe('--badge-size');
    expect(toKebabCaseProperty('--kit-component--Badge--size')).toBe(
      '--kit-component--Badge--size'
    );
  });
});
