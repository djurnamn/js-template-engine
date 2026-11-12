import { process, type StylingContext } from '@js-template-engine/core';
import type { ElementNode, Template } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import {
  compareVariantSets,
  convertUtilityClasses,
  looksLikeUtilityClass,
} from '../src/conversion/convert';
import { registeredPropertyRules } from '../src/conversion/registered-properties';
import { compareVariants, isDarkSelector } from '../src/conversion/variants';
import { tailwind } from '../src/tailwind-extension';

function fail(message: string): never {
  throw new Error(message);
}

function convert(...classes: string[]) {
  return convertUtilityClasses(classes, fail);
}

const context: StylingContext = {
  ancestorElements: [],
  warn(message) {
    throw new Error(`unexpected warning: ${message}`);
  },
  error: fail,
  fail,
};

const COMPOSED_BOX_SHADOW =
  'var(--tw-inset-shadow, 0 0 #0000), var(--tw-inset-ring-shadow, 0 0 #0000), var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow, 0 0 #0000)';

function element(classes: string | string[]): ElementNode {
  return { type: 'element', tag: 'div', extensions: { tailwind: { classes } } };
}

describe('utility conversion', () => {
  it('resolves spacing against the default scale', () => {
    expect(convert('p-4', 'px-6', 'py-1.5', 'pt-px', 'p-0')).toEqual({
      padding: '0',
      paddingInline: '1.5rem',
      paddingBlock: '0.375rem',
      paddingTop: '1px',
    });
  });

  it('resolves negative values', () => {
    expect(convert('-mt-2', '-mx-px', '-left-2', '-z-10')).toEqual({
      marginTop: '-0.5rem',
      marginInline: '-1px',
      left: '-0.5rem',
      zIndex: '-10',
    });
  });

  it('resolves fractions to v4 calc form, negated when negative', () => {
    expect(convert('w-1/2', '-top-1/2')).toEqual({
      width: 'calc(1 / 2 * 100%)',
      top: 'calc(calc(1 / 2 * 100%) * -1)',
    });
  });

  it('resolves sizing keywords and the container scale', () => {
    expect(convert('w-full', 'h-screen', 'min-w-fit', 'max-w-lg')).toEqual({
      width: '100%',
      height: '100vh',
      minWidth: 'fit-content',
      maxWidth: '32rem',
    });
  });

  it('resolves the named max-w sizes and min/max fractions', () => {
    expect(convert('max-w-prose')).toEqual({ maxWidth: '65ch' });
    expect(convert('max-w-screen-sm')).toEqual({ maxWidth: '40rem' });
    expect(convert('max-w-screen-2xl')).toEqual({ maxWidth: '96rem' });
    expect(convert('max-w-1/2', 'min-w-1/3', 'max-h-2/3', 'min-h-1/4')).toEqual(
      {
        maxWidth: 'calc(1 / 2 * 100%)',
        minWidth: 'calc(1 / 3 * 100%)',
        maxHeight: 'calc(2 / 3 * 100%)',
        minHeight: 'calc(1 / 4 * 100%)',
      }
    );
    expect(() => convert('w-screen-sm')).toThrow('unsupported value');
  });

  it('rejects the sizing keywords Tailwind v4 does not define', () => {
    for (const candidate of [
      'max-w-auto',
      'max-h-auto',
      'basis-min',
      'basis-max',
      'basis-fit',
    ]) {
      expect(() => convert(candidate)).toThrow(
        `Cannot convert Tailwind utility '${candidate}': unsupported value`
      );
    }
    expect(convert('basis-auto', 'basis-full')).toEqual({ flexBasis: '100%' });
    expect(convert('max-w-full', 'max-h-fit')).toEqual({
      maxWidth: '100%',
      maxHeight: 'fit-content',
    });
  });

  it('resolves palette colors, opacity modifiers via color-mix', () => {
    expect(convert('bg-blue-600', 'text-red-500/50', 'border-white')).toEqual({
      backgroundColor: 'oklch(54.6% 0.245 262.881)',
      color: 'color-mix(in oklab, oklch(63.7% 0.237 25.331) 50%, transparent)',
      borderColor: '#fff',
    });
  });

  it('resolves text sizes with their paired line height', () => {
    expect(convert('text-sm')).toEqual({
      fontSize: '0.875rem',
      lineHeight: 'calc(1.25 / 0.875)',
    });
    expect(convert('text-base/7')).toEqual({
      fontSize: '1rem',
      lineHeight: '1.75rem',
    });
  });

  it('disambiguates the text and font namespaces', () => {
    expect(convert('text-center', 'font-semibold', 'font-mono')).toEqual({
      textAlign: 'center',
      fontWeight: '600',
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    });
  });

  it('resolves border sides, styles, and radii', () => {
    expect(convert('border', 'border-t-4', 'border-dashed')).toEqual({
      borderWidth: '1px',
      borderTopWidth: '4px',
      borderStyle: 'dashed',
    });
    // The shorthand is a distinct property: declaration order, which the
    // merge preserves, resolves the overlap in CSS.
    expect(convert('rounded-t-lg', 'rounded-full')).toEqual({
      borderTopLeftRadius: '0.5rem',
      borderTopRightRadius: '0.5rem',
      borderRadius: 'calc(infinity * 1px)',
    });
  });

  it("composes shadows through Tailwind's shadow custom properties", () => {
    expect(convert('shadow-md')).toEqual({
      '--tw-shadow':
        '0 4px 6px -1px var(--tw-shadow-color, rgb(0 0 0 / 0.1)), 0 2px 4px -2px var(--tw-shadow-color, rgb(0 0 0 / 0.1))',
      boxShadow: COMPOSED_BOX_SHADOW,
    });
    expect(convert('shadow-none')).toEqual({
      '--tw-shadow': '0 0 #0000',
      boxShadow: COMPOSED_BOX_SHADOW,
    });
    expect(convert('shadow')['--tw-shadow']).toBe(
      '0 1px 3px 0 var(--tw-shadow-color, rgb(0 0 0 / 0.1)), 0 1px 2px -1px var(--tw-shadow-color, rgb(0 0 0 / 0.1))'
    );
  });

  it('reads an arbitrary shadow color through --tw-shadow-color as Tailwind does', () => {
    const shadow = (candidate: string) => convert(candidate)['--tw-shadow'];
    expect(shadow('shadow-[0_0_2px_red]')).toBe(
      '0 0 2px var(--tw-shadow-color, red)'
    );
    expect(shadow('shadow-[0_0_2px_#000,inset_0_1px_red]')).toBe(
      '0 0 2px var(--tw-shadow-color, #000), inset 0 1px var(--tw-shadow-color, red)'
    );
    // No color: currentcolor is appended; one other word is the color.
    expect(shadow('shadow-[0_0_4px]')).toBe(
      '0 0 4px var(--tw-shadow-color, currentcolor)'
    );
    expect(shadow('shadow-[0_0_4px_var(--glow)]')).toBe(
      '0 0 4px var(--tw-shadow-color, var(--glow))'
    );
    // Fewer than two lengths: not a shadow Tailwind rewrites.
    expect(shadow('shadow-(--elevation)')).toBe('var(--elevation)');
    expect(shadow('shadow-[none]')).toBe('none');
  });

  it('sets shadow colors through --tw-shadow-color as Tailwind does', () => {
    const mixed = (color: string) =>
      `color-mix(in oklab, ${color} var(--tw-shadow-alpha, 100%), transparent)`;
    expect(convert('shadow-indigo-500')).toEqual({
      '--tw-shadow-color': mixed('oklch(58.5% 0.233 277.117)'),
    });
    expect(convert('shadow-indigo-500/50')).toEqual({
      '--tw-shadow-color': mixed(
        'color-mix(in oklab, oklch(58.5% 0.233 277.117) 50%, transparent)'
      ),
    });
    expect(convert('shadow-current')).toEqual({
      '--tw-shadow-color': mixed('currentcolor'),
    });
    expect(convert('shadow-inherit')).toEqual({
      '--tw-shadow-color': 'inherit',
    });
    expect(convert('shadow-[#123]/50')).toEqual({
      '--tw-shadow-color': mixed('color-mix(in oklab, #123 50%, transparent)'),
    });
    expect(
      convert('shadow-[color:var(--glow)]', 'shadow-(color:--glow)')
    ).toEqual({ '--tw-shadow-color': mixed('var(--glow)') });
    // An uninferable arbitrary value is a shadow, as in Tailwind.
    expect(convert('shadow-(--glow)')['--tw-shadow']).toBe('var(--glow)');
    expect(convert('shadow-lg', 'shadow-indigo-500/50')).toEqual({
      '--tw-shadow': expect.stringContaining('var(--tw-shadow-color, '),
      boxShadow: COMPOSED_BOX_SHADOW,
      '--tw-shadow-color': expect.stringContaining('50%, transparent)'),
    });
    for (const candidate of [
      'shadow-lg/50',
      'shadow/50',
      'shadow-none/50',
      'shadow-inherit/50',
      'shadow-[0_0_2px_red]/50',
      '-shadow-indigo-500',
    ]) {
      expect(() => convert(candidate)).toThrow('unsupported value');
    }
  });

  it('resolves rings through the composed box-shadow', () => {
    expect(convert('ring-2')).toEqual({
      '--tw-ring-shadow':
        'var(--tw-ring-inset,) 0 0 0 calc(2px + var(--tw-ring-offset-width, 0px)) var(--tw-ring-color, currentcolor)',
      boxShadow: COMPOSED_BOX_SHADOW,
    });
    expect(convert('ring')['--tw-ring-shadow']).toContain('calc(1px + ');
    expect(convert('ring-[3px]')['--tw-ring-shadow']).toContain('calc(3px + ');
    expect(
      convert('ring-[length:var(--ring-width)]')['--tw-ring-shadow']
    ).toContain('calc(var(--ring-width) + ');
    expect(convert('ring-blue-500')).toEqual({
      '--tw-ring-color': 'oklch(62.3% 0.214 259.815)',
    });
    expect(convert('ring-blue-500/50')).toEqual({
      '--tw-ring-color':
        'color-mix(in oklab, oklch(62.3% 0.214 259.815) 50%, transparent)',
    });
    expect(convert('ring-current')).toEqual({
      '--tw-ring-color': 'currentcolor',
    });
    // An uninferable arbitrary value is a color, as in Tailwind.
    expect(convert('ring-[var(--focus)]', 'ring-[#123]')).toEqual({
      '--tw-ring-color': '#123',
    });
    expect(convert('ring-(--focus)')).toEqual({
      '--tw-ring-color': 'var(--focus)',
    });
    expect(convert('ring-inset')).toEqual({ '--tw-ring-inset': 'inset' });
    expect(convert('ring-offset-2')).toEqual({
      '--tw-ring-offset-width': '2px',
      '--tw-ring-offset-shadow':
        'var(--tw-ring-inset,) 0 0 0 var(--tw-ring-offset-width, 0px) var(--tw-ring-offset-color, #fff)',
    });
    expect(convert('ring-offset-white', 'ring-offset-[color:red]')).toEqual({
      '--tw-ring-offset-color': 'red',
    });
    expect(convert('ring-offset-[3px]')['--tw-ring-offset-width']).toBe('3px');
  });

  it('resolves inset rings through the composed box-shadow', () => {
    expect(convert('inset-ring')).toEqual({
      '--tw-inset-ring-shadow':
        'inset 0 0 0 1px var(--tw-inset-ring-color, currentcolor)',
      boxShadow: COMPOSED_BOX_SHADOW,
    });
    expect(convert('inset-ring-2')['--tw-inset-ring-shadow']).toBe(
      'inset 0 0 0 2px var(--tw-inset-ring-color, currentcolor)'
    );
    expect(convert('inset-ring-[3px]')['--tw-inset-ring-shadow']).toBe(
      'inset 0 0 0 3px var(--tw-inset-ring-color, currentcolor)'
    );
    expect(convert('inset-ring-indigo-700/10')).toEqual({
      '--tw-inset-ring-color':
        'color-mix(in oklab, oklch(45.7% 0.24 277.023) 10%, transparent)',
    });
    expect(convert('inset-ring-(--edge)', 'inset-ring-[#123]')).toEqual({
      '--tw-inset-ring-color': '#123',
    });
    expect(convert('inset-ring-1', 'ring-2')).toEqual({
      '--tw-inset-ring-shadow': expect.stringContaining('inset 0 0 0 1px'),
      boxShadow: COMPOSED_BOX_SHADOW,
      '--tw-ring-shadow': expect.stringContaining('calc(2px + '),
    });
    for (const candidate of [
      'inset-ring/50',
      'inset-ring-2/50',
      'inset-ring-1.5',
      '-inset-ring-2',
      'inset-ring-[3px]/50',
    ]) {
      expect(() => convert(candidate)).toThrow('unsupported value');
    }
  });

  it('combines a ring and a shadow on one node as Tailwind does', () => {
    expect(convert('shadow-md', 'ring-2', 'ring-blue-500')).toEqual({
      '--tw-shadow': expect.any(String),
      boxShadow: COMPOSED_BOX_SHADOW,
      '--tw-ring-shadow': expect.stringContaining('calc(2px + '),
      '--tw-ring-color': 'oklch(62.3% 0.214 259.815)',
    });
  });

  it('rejects ring values Tailwind does not generate', () => {
    for (const candidate of [
      'ring-px',
      'ring-1.5',
      'ring-2/50',
      'ring/50',
      '-ring-2',
      'ring-offset',
      'ring-offset-1.5',
      'ring-[3px]/50',
    ]) {
      expect(() => convert(candidate)).toThrow('unsupported value');
    }
  });

  it('resolves transitions to their default timing and duration', () => {
    expect(convert('transition-opacity', 'duration-300')).toEqual({
      transitionProperty: 'opacity',
      transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
      transitionDuration: '300ms',
    });
  });

  it('passes arbitrary values and properties through verbatim', () => {
    expect(
      convert('p-[3px]', 'grid-cols-[200px_1fr]', '[mask-type:luminance]')
    ).toEqual({
      padding: '3px',
      gridTemplateColumns: '200px 1fr',
      'mask-type': 'luminance',
    });
  });

  it('reads type hints on arbitrary values', () => {
    expect(convert('text-[length:var(--size)]')).toEqual({
      fontSize: 'var(--size)',
    });
    expect(convert('text-[color:var(--ink)]')).toEqual({
      color: 'var(--ink)',
    });
    expect(convert('bg-[length:var(--tile)]')).toEqual({
      backgroundSize: 'var(--tile)',
    });
    expect(convert('bg-[position:var(--focus)]')).toEqual({
      backgroundPosition: 'var(--focus)',
    });
    expect(convert('bg-[image:var(--texture)]')).toEqual({
      backgroundImage: 'var(--texture)',
    });
    expect(convert('bg-[color:var(--surface)]/50')).toEqual({
      backgroundColor: 'color-mix(in oklab, var(--surface) 50%, transparent)',
    });
    expect(convert('border-[length:var(--rule)]')).toEqual({
      borderWidth: 'var(--rule)',
    });
    expect(convert('border-t-[color:var(--rule)]')).toEqual({
      borderTopColor: 'var(--rule)',
    });
    expect(convert('font-[number:var(--weight)]')).toEqual({
      fontWeight: 'var(--weight)',
    });
    expect(convert('font-[family-name:var(--face)]')).toEqual({
      fontFamily: 'var(--face)',
    });
    expect(convert('w-[length:var(--width)]')).toEqual({
      width: 'var(--width)',
    });
  });

  it('infers an unhinted arbitrary value the way Tailwind does', () => {
    expect(convert('text-[clamp(1rem,2vw,2rem)]')).toEqual({
      fontSize: 'clamp(1rem, 2vw, 2rem)',
    });
    expect(convert('text-[0.8125rem]', 'text-[#0f172a]')).toEqual({
      fontSize: '0.8125rem',
      color: '#0f172a',
    });
    expect(convert('text-[larger]')).toEqual({ fontSize: 'larger' });
    expect(convert('text-[rebeccapurple]')).toEqual({
      color: 'rebeccapurple',
    });
    expect(convert('bg-[url(/hero_image.png)]')).toEqual({
      backgroundImage: 'url(/hero_image.png)',
    });
    expect(convert('bg-[linear-gradient(red,blue)]')).toEqual({
      backgroundImage: 'linear-gradient(red,blue)',
    });
    expect(convert('bg-[center_top_1rem]')).toEqual({
      backgroundPosition: 'center top 1rem',
    });
    expect(convert('bg-[rgb(0_0_0/0.5)]')).toEqual({
      backgroundColor: 'rgb(0 0 0/0.5)',
    });
    expect(convert('border-[3px]', 'border-[thin]')).toEqual({
      borderWidth: 'thin',
    });
    expect(convert('border-b-[#e2e8f0]')).toEqual({
      borderBottomColor: '#e2e8f0',
    });
    expect(convert('font-[650]', 'font-[Inter,_sans-serif]')).toEqual({
      fontWeight: '650',
      fontFamily: 'Inter, sans-serif',
    });
    expect(convert('shadow-[0_1px_2px_rgb(0_0_0/0.05)]')).toEqual({
      '--tw-shadow': '0 1px 2px var(--tw-shadow-color, rgb(0 0 0/0.05))',
      boxShadow: COMPOSED_BOX_SHADOW,
    });
  });

  it('reads the custom-property shorthand', () => {
    expect(
      convert('bg-(color:--brand)', 'text-(length:--size)', 'p-(--gutter)')
    ).toEqual({
      backgroundColor: 'var(--brand)',
      fontSize: 'var(--size)',
      padding: 'var(--gutter)',
    });
  });

  it('spaces math operators as Tailwind does', () => {
    expect(
      convert(
        'w-[calc(100%-2rem)]',
        'h-[calc(100vh-var(--header-height))]',
        'max-w-[min(100%,calc(60ch+2*1rem))]',
        '[margin:calc(1rem*-1)]'
      )
    ).toEqual({
      width: 'calc(100% - 2rem)',
      height: 'calc(100vh - var(--header-height))',
      maxWidth: 'min(100%, calc(60ch + 2 * 1rem))',
      margin: 'calc(1rem * -1)',
    });
    expect(convert('w-[calc(100%_-_2rem)]')).toEqual({
      width: 'calc(100% - 2rem)',
    });
    expect(convert('top-[calc(1e-2*1px)]')).toEqual({
      top: 'calc(1e-2 * 1px)',
    });
  });

  it("keeps underscores in url() and a var()'s property name", () => {
    expect(
      convert('p-[var(--space_lg,_1rem)]', '[mask-image:url(/a_b.svg)]')
    ).toEqual({
      padding: 'var(--space_lg, 1rem)',
      'mask-image': 'url(/a_b.svg)',
    });
  });

  it('falls back as Tailwind does where the type cannot be inferred', () => {
    expect(
      convert(
        'text-[var(--ink)]',
        'bg-[var(--surface)]',
        'border-[var(--rule)]',
        'shadow-[var(--elevation)]'
      )
    ).toEqual({
      color: 'var(--ink)',
      backgroundColor: 'var(--surface)',
      borderColor: 'var(--rule)',
      '--tw-shadow': 'var(--elevation)',
      boxShadow: COMPOSED_BOX_SHADOW,
    });
    expect(convert('font-[var(--weight)]')).toEqual({
      fontWeight: 'var(--weight)',
    });
    expect(convert('bg-(--brand)')).toEqual({
      backgroundColor: 'var(--brand)',
    });
  });

  it('reads type hints as Tailwind does', () => {
    // A hint the utility does not route takes the fallback, uninferred.
    expect(convert('text-[url:1rem]')).toEqual({ color: '1rem' });
    expect(convert('text-[size:1rem]', 'bg-[size:var(--tile)]')).toEqual({
      fontSize: '1rem',
      backgroundSize: 'var(--tile)',
    });
    // A single-property utility drops any hint.
    expect(convert('w-[foo:1px]', 'duration-[number:300ms]')).toEqual({
      width: '1px',
      transitionDuration: '300ms',
    });
    expect(convert('shadow-[length:var(--elevation)]')).toEqual({
      '--tw-shadow': 'var(--elevation)',
      boxShadow: COMPOSED_BOX_SHADOW,
    });
  });

  it('rejects arbitrary values Tailwind cannot place or a build must resolve', () => {
    expect(() => convert('bg-(brand)')).toThrow(
      'the parenthesized shorthand takes a custom property'
    );
    expect(() => convert('bg-[length:var(--tile)]/50')).toThrow(
      'unsupported value'
    );
    expect(() => convert('w-[calc(theme(spacing.4)-1px)]')).toThrow(
      "Tailwind's theme functions resolve against a Tailwind build"
    );
    expect(() => convert('[margin:--spacing(2)]')).toThrow(
      "Tailwind's theme functions resolve against a Tailwind build"
    );
  });

  it('rejects theme functions wherever they appear in a value', () => {
    for (const candidate of [
      'h-[calc(100dvh-theme(spacing.4))]',
      'w-[calc(100%_-_theme(spacing.1))]',
      'p-[1px_theme(spacing.1)]',
      '[width:calc(1px-theme(spacing.1))]',
      'text-[12px]/[calc(1em-theme(spacing.1))]',
      'm-[--spacing(2)]',
    ]) {
      expect(() => convert(candidate)).toThrow(
        `Cannot convert Tailwind utility '${candidate}': Tailwind's theme functions resolve against a Tailwind build`
      );
    }
    expect(convert('bg-[url(theme(x).png)]', 'p-[var(--theme-gap)]')).toEqual({
      backgroundImage: 'url(theme(x).png)',
      padding: 'var(--theme-gap)',
    });
  });

  it('keeps underscores in url() and var() names after an underscore', () => {
    expect(
      convert(
        'w-[calc(100%_-_var(--a_b))]',
        'p-[1px_var(--a_b)]',
        'm-[1px_url(a_b)]',
        'bg-[url(a_(1)_b.png)]',
        '[mask-image:url(a\\_b.svg)]'
      )
    ).toEqual({
      width: 'calc(100% - var(--a_b))',
      padding: '1px var(--a_b)',
      margin: '1px url(a_b)',
      backgroundImage: 'url(a_(1)_b.png)',
      'mask-image': 'url(a\\_b.svg)',
    });
    expect(convert('text-[var(--my\\_size)]', 'p-[myvar(--a_b)]')).toEqual({
      color: 'var(--my_size)',
      padding: 'myvar(--a b)',
    });
  });

  it('reports every unconvertible utility, converting the rest', () => {
    const reported: string[] = [];
    const style = convertUtilityClasses(
      ['p-4', 'bogus-2', 'hover:rotate-45', 'shadow-lg/50', 'm-2'],
      (message) => reported.push(message)
    );
    expect(style).toEqual({ padding: '1rem', margin: '0.5rem' });
    expect(reported).toEqual([
      "Cannot convert Tailwind utility 'bogus-2': unknown utility",
      "Cannot convert Tailwind utility 'hover:rotate-45': 'rotate' relies on Tailwind's composed custom-property machinery and is outside the supported conversion subset",
      "Cannot convert Tailwind utility 'shadow-lg/50': unsupported value",
    ]);
  });

  it('appends !important for the trailing ! modifier', () => {
    expect(convert('rounded-md!')).toEqual({
      borderRadius: '0.375rem !important',
    });
  });

  it('applies declared order with later declarations winning', () => {
    expect(convert('p-2', 'p-4')).toEqual({ padding: '1rem' });
    expect(convert('p-4', 'p-2')).toEqual({ padding: '0.5rem' });
  });

  it('wraps hover in the v4 hover media query', () => {
    expect(convert('hover:bg-blue-700')).toEqual({
      '@media (hover: hover)': {
        ':hover': { backgroundColor: 'oklch(48.8% 0.243 264.376)' },
      },
    });
  });

  it('maps responsive, dark, and stacked variants to nested blocks', () => {
    expect(convert('md:p-8', 'dark:p-2')).toEqual({
      '@media (min-width: 48rem)': { padding: '2rem' },
      '@media (prefers-color-scheme: dark)': { padding: '0.5rem' },
    });
    expect(convert('md:hover:underline')).toEqual({
      '@media (min-width: 48rem)': {
        '@media (hover: hover)': {
          ':hover': { textDecorationLine: 'underline' },
        },
      },
    });
  });

  it('converts the resize and field-sizing utilities to one declaration each', () => {
    expect(convert('resize')).toEqual({ resize: 'both' });
    expect(convert('resize-none')).toEqual({ resize: 'none' });
    expect(convert('resize-x')).toEqual({ resize: 'horizontal' });
    expect(convert('resize-y')).toEqual({ resize: 'vertical' });
    expect(convert('field-sizing-content')).toEqual({
      fieldSizing: 'content',
    });
    expect(convert('field-sizing-fixed')).toEqual({ fieldSizing: 'fixed' });
    expect(convert('resize-none!')).toEqual({ resize: 'none !important' });
    expect(
      convert('field-sizing-fixed', 'md:resize-y', 'focus:field-sizing-content')
    ).toEqual({
      fieldSizing: 'fixed',
      '@media (min-width: 48rem)': { resize: 'vertical' },
      ':focus': { fieldSizing: 'content' },
    });
    for (const candidate of [
      'resize-both',
      'resize-[both]',
      '-resize',
      'field-sizing-auto',
    ]) {
      expect(() => convert(candidate)).toThrow('unknown utility');
    }
  });

  it('merges utilities sharing a variant into one block', () => {
    expect(convert('md:px-6', 'md:py-3')).toEqual({
      '@media (min-width: 48rem)': {
        paddingInline: '1.5rem',
        paddingBlock: '0.75rem',
      },
    });
  });

  it('maps pseudo-class and pseudo-element variants', () => {
    expect(convert('focus:underline', 'first:mt-0')).toEqual({
      ':focus': { textDecorationLine: 'underline' },
      ':first-child': { marginTop: '0' },
    });
    expect(convert('placeholder:text-gray-400')).toEqual({
      '::placeholder': { color: 'oklch(70.7% 0.022 261.325)' },
    });
    expect(convert('user-invalid:mt-0', 'user-valid:mb-0')).toEqual({
      ':user-invalid': { marginTop: '0' },
      ':user-valid': { marginBottom: '0' },
    });
  });

  it('maps aria-* and data-* variants to attribute selectors as Tailwind v4 does', () => {
    expect(
      convert(
        'aria-checked:bg-indigo-600',
        'aria-[sort=ascending]:p-1',
        'data-active:p-2',
        'data-[state=open]:p-3'
      )
    ).toEqual({
      '&[aria-checked="true"]': {
        backgroundColor: 'oklch(51.1% 0.262 276.966)',
      },
      '&[aria-sort="ascending"]': { padding: '0.25rem' },
      '&[data-active]': { padding: '0.5rem' },
      '&[data-state="open"]': { padding: '0.75rem' },
    });
  });

  it('writes a bracketed aria-* or data-* body as Tailwind v4 quotes it', () => {
    expect(
      convert(
        'aria-[expanded]:p-1',
        "data-[state='open']:p-2",
        'data-[lang|=en_i]:p-3',
        'data-[size=extra_large]:p-4',
        'data-[state=_closed]:p-5',
        "data-[label=_'a_b']:p-6"
      )
    ).toEqual({
      '&[aria-expanded]': { padding: '0.25rem' },
      "&[data-state='open']": { padding: '0.5rem' },
      '&[data-lang|="en" i]': { padding: '0.75rem' },
      '&[data-size="extra large"]': { padding: '1rem' },
      // Tailwind 4 trims the value, and keeps a quoted one as written.
      '&[data-state="closed"]': { padding: '1.25rem' },
      "&[data-label= 'a b']": { padding: '1.5rem' },
    });
  });

  it('stacks aria-* and data-* variants with pseudo-class and dark variants', () => {
    expect(
      convert('hover:aria-checked:text-white', 'dark:data-[featured=true]:p-2')
    ).toEqual({
      '@media (hover: hover)': {
        ':hover': { '&[aria-checked="true"]': { color: '#fff' } },
      },
      '@media (prefers-color-scheme: dark)': {
        '&[data-featured="true"]': { padding: '0.5rem' },
      },
    });
    expect(
      convertUtilityClasses(['dark:aria-selected:p-1'], fail, {
        darkSelector: '[data-mode="dark"]',
      })
    ).toEqual({
      ':where(:root:is([data-mode="dark"])) &': {
        '&[aria-selected="true"]': { padding: '0.25rem' },
      },
    });
  });

  it('maps group-* and peer-* variants to the selectors Tailwind v4 composes', () => {
    expect(convert('group-hover:underline')).toEqual({
      '@media (hover: hover)': {
        '&:is(:where(.group):hover *)': { textDecorationLine: 'underline' },
      },
    });
    expect(convert('peer-checked:p-2')).toEqual({
      '&:is(:where(.peer):checked ~ *)': { padding: '0.5rem' },
    });
    expect(convert('group-focus/card:p-2', 'peer-invalid/email:p-1')).toEqual({
      '&:is(:where(.group\\/card):focus *)': { padding: '0.5rem' },
      '&:is(:where(.peer\\/email):invalid ~ *)': { padding: '0.25rem' },
    });
    expect(
      Object.keys(
        convert(
          'group-first:p-1',
          'group-aria-expanded:p-1',
          'group-aria-[sort=ascending]:p-1',
          'group-data-active:p-1',
          'group-data-[state=open]:p-1'
        )
      )
    ).toEqual([
      '&:is(:where(.group):first-child *)',
      '&:is(:where(.group)[aria-expanded="true"] *)',
      '&:is(:where(.group)[aria-sort="ascending"] *)',
      '&:is(:where(.group)[data-active] *)',
      '&:is(:where(.group)[data-state="open"] *)',
    ]);
  });

  it('maps open: as Tailwind v4 does, on the node and after group-', () => {
    expect(convert('open:p-1')).toEqual({
      ':is([open], :popover-open, :open)': { padding: '0.25rem' },
    });
    expect(Object.keys(convert('group-open:p-1'))).toEqual([
      '&:is(:where(.group):is([open], :popover-open, :open) *)',
    ]);
    expect(compareVariants('target', 'open')).toBeLessThan(0);
    expect(compareVariants('open', 'checked')).toBeLessThan(0);
  });

  it('reads the leading ! as Tailwind v4 does', () => {
    expect(convert('hover:!p-1')).toEqual({
      '@media (hover: hover)': { ':hover': { padding: '0.25rem !important' } },
    });
    expect(convert('!-mt-2')).toEqual({ marginTop: '-0.5rem !important' });
    expect(convert('shadow-inner')['--tw-shadow']).toBe(
      'inset 0 2px 4px 0 var(--tw-shadow-color, rgb(0 0 0 / 0.05))'
    );
  });

  it('reads a bracketed group-* or peer-* selector as Tailwind v4 does', () => {
    const key = (candidate: string) => Object.keys(convert(candidate))[0];
    expect(key('group-[.is-open]:p-1')).toBe(
      '&:is(:where(.group):is(.is-open) *)'
    );
    expect(key('group-[&.is-open]:p-1')).toBe('&:is(:where(.group).is-open *)');
    expect(key('group-[.theme-dark_&]:p-1')).toBe(
      '&:is(.theme-dark :where(.group) *)'
    );
    expect(key('group-[_:hover]:p-1')).toBe(
      '&:is(:where(.group):is(:hover) *)'
    );
    expect(key('group-[.a,.b]:p-1')).toBe('&:is(:where(.group):is(.a, .b) *)');
    expect(key('group-[&.a,&.b]:p-1')).toBe(
      '&:is(:is(:where(.group).a, :where(.group).b) *)'
    );
    expect(key('peer-[.is-dirty]/field:p-1')).toBe(
      '&:is(:where(.peer\\/field):is(.is-dirty) ~ *)'
    );
  });

  it('stacks group-* and peer-* variants with other variants, leftmost outermost', () => {
    expect(convert('md:group-hover:underline')).toEqual({
      '@media (min-width: 48rem)': {
        '@media (hover: hover)': {
          '&:is(:where(.group):hover *)': { textDecorationLine: 'underline' },
        },
      },
    });
    expect(convert('group-hover:dark:underline')).toEqual({
      '@media (hover: hover)': {
        '&:is(:where(.group):hover *)': {
          '@media (prefers-color-scheme: dark)': {
            textDecorationLine: 'underline',
          },
        },
      },
    });
    expect(convert('focus:peer-checked:ring-2')).toEqual({
      ':focus': {
        '&:is(:where(.peer):checked ~ *)': {
          '--tw-ring-shadow': expect.stringContaining('calc(2px + '),
          boxShadow: COMPOSED_BOX_SHADOW,
        },
      },
    });
  });

  it('rejects group-* and peer-* variants Tailwind does not compose', () => {
    for (const candidate of [
      'group-md:p-1',
      'group-dark:p-1',
      'group-placeholder:p-1',
      'peer-motion-safe:p-1',
    ]) {
      expect(() => convert(candidate)).toThrow(
        'variant takes a pseudo-class variant (hover, focus, checked), aria-* or data-*, or a bracketed selector after'
      );
    }
    // Compounds Tailwind does compose, over variants outside the subset.
    for (const candidate of [
      'group-has-checked:p-1',
      'peer-has-[.x]:p-1',
      'group-not-checked:p-1',
      'group-in-focus:p-1',
      'group-group-hover:p-1',
      'peer-group-hover/card:p-1',
      'group-inert:p-1',
      'peer-ltr:p-1',
    ]) {
      const variant = candidate.slice(0, candidate.lastIndexOf(':'));
      expect(() => convert(candidate)).toThrow(
        `Cannot convert Tailwind utility '${candidate}': the '${variant.replace(/\/.*$/, '')}' variant is outside the supported conversion subset`
      );
    }
    for (const candidate of [
      'group-[]:p-1',
      'group-[>li]:p-1',
      'peer-[~.x]:p-1',
      'group-[@media(print)]:p-1',
      'group-[.a{}]:p-1',
    ]) {
      expect(() => convert(candidate)).toThrow(
        'takes a bracketed selector that is not empty, relative'
      );
    }
    for (const candidate of ['group-hover/[card]:p-1', 'group-hover/a.b:p-1']) {
      expect(() => convert(candidate)).toThrow(
        "takes letters, digits, '-' and '_'"
      );
    }
  });

  it('rejects a malformed aria-* or data-* variant', () => {
    for (const candidate of ['aria-checked/item:p-1', 'data-:p-1']) {
      expect(() => convert(candidate)).toThrow(
        'variant takes a name (aria-checked, data-active) or a bracketed attribute'
      );
    }
    for (const candidate of [
      'aria-[]:p-1',
      'data-[a;b]:p-1',
      'data-[a_b]:p-1',
      'data-[a_b=c]:p-1',
      'data-[_state=open]:p-1',
      'group-data-[a_b]:p-1',
    ]) {
      expect(() => convert(candidate)).toThrow(
        candidate.startsWith('group-')
          ? 'variant takes an aria-* or data-* variant with a name'
          : 'is empty, does not open with an attribute name and then an operator or its end, or holds [, ], {, } or ;'
      );
    }
    // Whitespace after the name is kept, as Tailwind keeps it.
    expect(Object.keys(convert('data-[state_=open]:p-1'))).toEqual([
      '&[data-state ="open"]',
    ]);
    expect(Object.keys(convert('data-[state=a_b]:p-1'))).toEqual([
      '&[data-state="a b"]',
    ]);
    expect(() => convert('has-aria-checked:p-1')).toThrow(
      "the 'has-aria-checked' variant targets other elements"
    );
  });

  it('rejects unknown utilities and values', () => {
    expect(() => convert('bogus-4')).toThrow(
      "Cannot convert Tailwind utility 'bogus-4': unknown utility"
    );
    expect(() => convert('p-bogus')).toThrow(
      "Cannot convert Tailwind utility 'p-bogus': unsupported value"
    );
  });

  it('rejects utilities outside the self-contained subset', () => {
    expect(() => convert('drop-shadow-md')).toThrow(
      'outside the supported conversion subset'
    );
    for (const candidate of [
      'inset-shadow-sm',
      'inset-shadow',
      'inset-shadow-red-500',
      'hover:inset-shadow-xs',
    ]) {
      expect(() => convert(candidate)).toThrow(
        `Cannot convert Tailwind utility '${candidate}': 'inset-shadow' is outside the supported conversion subset`
      );
    }
    // A longer table root still wins over the excluded prefix.
    expect(convert('inset-x-2')).toEqual({
      insetInline: '0.5rem',
    });
    expect(() => convert('space-x-4')).toThrow(
      'styles sibling elements through child combinators'
    );
    expect(() => convert('-translate-x-2')).toThrow(
      'composed custom-property machinery'
    );
    expect(() => convert('bg-linear-to-r')).toThrow(
      'outside the supported conversion subset'
    );
    expect(() => convert('transition')).toThrow(
      'outside the supported conversion subset'
    );
    expect(() => convert('animate-spin')).toThrow(
      'requires generated @keyframes rules'
    );
  });

  it('rejects variants outside the subset', () => {
    expect(() => convert('has-checked:bg-red-500')).toThrow(
      "the 'has-checked' variant targets other elements"
    );
    expect(() => convert('before:bg-red-500')).toThrow(
      "the 'before' variant relies on Tailwind's composed custom-property machinery"
    );
    expect(() => convert('max-sm:p-2')).toThrow(
      "the 'max-sm' variant is outside the supported conversion subset"
    );
    expect(() => convert('[&:nth-child(3)]:p-2')).toThrow(
      'arbitrary variants are outside the supported conversion subset'
    );
    for (const variant of [
      'inert',
      'ltr',
      'rtl',
      'autofill',
      'default',
      'in-range',
      'out-of-range',
    ]) {
      expect(() => convert(`${variant}:p-2`)).toThrow(
        `Cannot convert Tailwind utility '${variant}:p-2': the '${variant}' variant is outside the supported conversion subset`
      );
    }
    expect(() => convert('bogus:p-2')).toThrow("unknown variant 'bogus'");
  });

  it('says Tailwind v4 variants it does not map are outside the subset, not unknown', () => {
    for (const variant of [
      '*',
      '**',
      'details-content',
      'starting',
      'noscript',
      'portrait',
      'landscape',
      'contrast-more',
      'contrast-less',
      'forced-colors',
      'inverted-colors',
      'pointer-coarse',
      'any-pointer-fine',
      'nth-3',
      'nth-last-2',
      'nth-of-type-4',
      'nth-last-of-type-[2n+1]',
      'nth-[3n]',
      'min-md',
      'min-[600px]',
      '@md',
      '@max-lg',
      '@min-xl',
      '@[400px]',
      '@min-[30rem]',
      '@sm/sidebar',
    ]) {
      expect(() => convert(`${variant}:p-2`)).toThrow(
        `Cannot convert Tailwind utility '${variant}:p-2': the '${variant}' variant is outside the supported conversion subset`
      );
    }
    // Tailwind composes nth-* after group- and peer-, not the others.
    expect(() => convert('group-nth-3:p-2')).toThrow(
      "the 'group-nth-3' variant is outside the supported conversion subset"
    );
    expect(() => convert('group-forced-colors:p-2')).toThrow(
      'variant takes a pseudo-class variant (hover, focus, checked), aria-* or data-*, or a bracketed selector after'
    );
    // Shapes Tailwind does not define stay unknown.
    for (const variant of [
      'nth',
      'nth-x',
      '@',
      'min-',
      'min-foo',
      '@foo',
      '@container',
      '@max-foo',
      'pointer',
      'bogus',
    ]) {
      expect(() => convert(`${variant}:p-2`)).toThrow(
        `unknown variant '${variant}'`
      );
    }
  });

  it('says Tailwind v4 utilities it does not map are outside the subset, not unknown', () => {
    for (const [candidate, name] of [
      ['@container', '@container'],
      ['@container/sidebar', '@container'],
      ['@container-normal', '@container'],
      ['@container-[scroll-state]', '@container'],
      ['mask-add', 'mask-add'],
      ['zoom-50', 'zoom'],
      ['scrollbar-thin', 'scrollbar-thin'],
      ['scrollbar-thumb-red-500', 'scrollbar-thumb'],
      ['overflow-ellipsis', 'overflow-ellipsis'],
      ['decoration-clone', 'decoration-clone'],
      ['flex-shrink-0', 'flex-shrink'],
      ['text-shadow-lg/20', 'text-shadow'],
      ['text-shadow-red-500/50', 'text-shadow'],
      ['-col-3', 'col'],
      ['indent-px', 'indent'],
      ['contain-inline-size', 'contain'],
      ['origin-top-left', 'origin'],
      ['tab-4', 'tab'],
      ['scheme-dark', 'scheme-dark'],
      ['float-left', 'float-left'],
      ['hover:clear-both', 'clear-both'],
      ['table-auto', 'table-auto'],
      ['container', 'container'],
      ['mix-blend-multiply', 'mix-blend-multiply'],
      ['cursor-n-resize', 'cursor-n-resize'],
      ['list-item', 'list-item'],
      ['ms-2', 'ms'],
      ['-ms-2', 'ms'],
      ['ps-[3px]', 'ps'],
      ['start-0', 'start'],
      ['inline-4', 'inline'],
      ['col-3', 'col'],
      ['origin-top', 'origin'],
      ['placeholder-red-500/50', 'placeholder'],
      ['bg-size-[10px]', 'bg-size'],
      ['text-shadow-sm', 'text-shadow'],
      ['border-s-2', 'border-s'],
      ['rounded-s-lg', 'rounded-s'],
      ['flex-grow', 'flex-grow'],
    ]) {
      expect(() => convert(candidate)).toThrow(
        `Cannot convert Tailwind utility '${candidate}': '${name}' is outside the supported conversion subset`
      );
    }
    // A longer root the converter maps still claims its values.
    expect(() => convert('col-span-bogus')).toThrow(
      "Cannot convert Tailwind utility 'col-span-bogus': unsupported value"
    );
    expect(convert('inline-flex')).toEqual({ display: 'inline-flex' });
    expect(convert('inset-x-2')).toEqual({ insetInline: '0.5rem' });
    // A static utility takes no leading -, and names Tailwind does not
    // define stay unknown.
    for (const candidate of ['-float-left', 'scheme-bogus', 'containers']) {
      expect(() => convert(candidate)).toThrow(
        `Cannot convert Tailwind utility '${candidate}': unknown utility`
      );
    }
    // Tailwind gives text-shadow no bare form; the text root claims it.
    expect(() => convert('text-shadow')).toThrow(
      "Cannot convert Tailwind utility 'text-shadow': unsupported value"
    );
    // A Tailwind root followed by a value it does not take is a plain
    // class name, bare or behind a variant or !.
    for (const name of [
      'start-panel',
      'row-header',
      'col-left',
      'block-title',
      'inline-icon',
      'tab-list',
      'mask-overlay',
      'origin-story',
      'contain-box',
      'placeholder-text',
      'indent-auto',
      '-col-auto',
      '@container-foo',
    ]) {
      for (const candidate of [
        name,
        `md:${name}`,
        `hover:${name}`,
        `!${name}`,
      ]) {
        expect(() => convert(candidate)).toThrow(
          `Cannot convert Tailwind utility '${candidate}': unknown utility`
        );
        expect(looksLikeUtilityClass(candidate)).toBe(false);
      }
    }
  });

  it('converts outline widths, styles, colors and offsets as Tailwind v4 writes them', () => {
    expect(convert('outline-2')).toEqual({
      outlineStyle: 'var(--tw-outline-style, solid)',
      outlineWidth: '2px',
    });
    expect(convert('outline')).toEqual({
      outlineStyle: 'var(--tw-outline-style, solid)',
      outlineWidth: '1px',
    });
    expect(convert('outline-dashed')).toEqual({
      '--tw-outline-style': 'dashed',
      outlineStyle: 'dashed',
    });
    expect(convert('outline-indigo-600/50', 'outline-offset-2')).toEqual({
      outlineColor:
        'color-mix(in oklab, oklch(51.1% 0.262 276.966) 50%, transparent)',
      outlineOffset: '2px',
    });
    expect(convert('-outline-offset-2', 'outline-[3px]')).toEqual({
      outlineOffset: 'calc(2px * -1)',
      outlineStyle: 'var(--tw-outline-style, solid)',
      outlineWidth: '3px',
    });
    // An arbitrary value whose type is not a width is a color, as in Tailwind.
    expect(convert('outline-[var(--ring)]')).toEqual({
      outlineColor: 'var(--ring)',
    });
    expect(convert('focus:outline-hidden')).toEqual({
      ':focus': {
        '--tw-outline-style': 'none',
        outlineStyle: 'none',
        '@media (forced-colors: active)': {
          outline: '2px solid transparent',
          outlineOffset: '2px',
        },
      },
    });
    expect(() => convert('outline-offset-px')).toThrow('unsupported value');
  });

  it('converts line clamping, text wrapping and font smoothing', () => {
    expect(convert('line-clamp-3')).toEqual({
      overflow: 'hidden',
      display: '-webkit-box',
      '-webkit-box-orient': 'vertical',
      '-webkit-line-clamp': '3',
    });
    expect(convert('line-clamp-none')).toEqual({
      overflow: 'visible',
      display: 'block',
      '-webkit-box-orient': 'horizontal',
      '-webkit-line-clamp': 'unset',
    });
    expect(convert('text-balance', 'antialiased')).toEqual({
      textWrap: 'balance',
      '-webkit-font-smoothing': 'antialiased',
      '-moz-osx-font-smoothing': 'grayscale',
    });
  });

  it('composes numeric variants through their custom properties', () => {
    expect(convert('tabular-nums', 'slashed-zero')).toEqual({
      '--tw-numeric-spacing': 'tabular-nums',
      '--tw-slashed-zero': 'slashed-zero',
      fontVariantNumeric:
        'var(--tw-ordinal,) var(--tw-slashed-zero,) var(--tw-numeric-figure,) var(--tw-numeric-spacing,) var(--tw-numeric-fraction,)',
    });
    expect(convert('normal-nums')).toEqual({ fontVariantNumeric: 'normal' });
  });

  it('converts viewport sizes', () => {
    expect(
      convert('min-h-dvh', 'h-svh', 'max-h-lh', 'w-dvw', 'max-w-screen')
    ).toEqual({
      minHeight: '100dvh',
      height: '100svh',
      maxHeight: '1lh',
      width: '100dvw',
      maxWidth: '100vw',
    });
    expect(() => convert('w-lh')).toThrow('unsupported value');
  });

  it('converts decoration, place, columns, SVG, accent and scroll utilities', () => {
    expect(
      convert(
        'decoration-2',
        'decoration-wavy',
        'decoration-sky-500',
        'underline-offset-4'
      )
    ).toEqual({
      textDecorationThickness: '2px',
      textDecorationStyle: 'wavy',
      textDecorationColor: 'oklch(68.5% 0.169 237.323)',
      textUnderlineOffset: '4px',
    });
    expect(
      convert('place-items-center', 'place-content-between', 'columns-xs')
    ).toEqual({
      placeItems: 'center',
      placeContent: 'space-between',
      columns: '20rem',
    });
    expect(convert('fill-current', 'stroke-2', 'stroke-[var(--ink)]')).toEqual({
      fill: 'currentcolor',
      strokeWidth: '2',
      stroke: 'var(--ink)',
    });
    expect(convert('accent-auto', 'caret-white', '-scroll-mt-4')).toEqual({
      accentColor: 'auto',
      caretColor: '#fff',
      scrollMarginTop: '-1rem',
    });
    expect(convert('snap-start', 'snap-always')).toEqual({
      scrollSnapAlign: 'start',
      scrollSnapStop: 'always',
    });
    expect(() => convert('snap-x')).toThrow(
      "'snap' relies on Tailwind's composed custom-property machinery"
    );
  });

  it('converts arbitrary custom and vendor-prefixed properties', () => {
    expect(
      convert('[--gutter:calc(1rem+2px)]', '[-webkit-line-clamp:2]')
    ).toEqual({
      '--gutter': 'calc(1rem + 2px)',
      '-webkit-line-clamp': '2',
    });
  });

  it('writes dark: under a dark selector when one is given', () => {
    const withSelector = (darkSelector: string, ...classes: string[]) =>
      convertUtilityClasses(classes, fail, { darkSelector });
    expect(withSelector(':root[data-mode="dark"] &', 'dark:p-2')).toEqual({
      ':root[data-mode="dark"] &': { padding: '0.5rem' },
    });
    expect(withSelector('&:where(.dark, .dark *)', 'dark:p-2')).toEqual({
      '&:where(.dark, .dark *)': { padding: '0.5rem' },
    });
    expect(
      withSelector('.dark, [data-theme="night"]', 'hover:dark:p-2')
    ).toEqual({
      '@media (hover: hover)': {
        ':hover': {
          ':where(:root:is(.dark, [data-theme="night"])) &': {
            padding: '0.5rem',
          },
        },
      },
    });
  });
});

describe("tailwind({ output: 'styles' })", () => {
  it('contributes no classes', () => {
    expect(
      tailwind({ output: 'styles' }).contributeClasses(
        element(['px-4', 'py-2']),
        context
      )
    ).toEqual([]);
  });

  it('contributes the group and peer marker classes and converts the rest', () => {
    const extension = tailwind({ output: 'styles' });
    const node = element([
      'group',
      'group/card',
      'peer',
      'peer/email',
      'group-hover:underline',
      'p-2',
    ]);
    expect(extension.contributeClasses(node, context)).toEqual([
      'group',
      'group/card',
      'peer',
      'peer/email',
    ]);
    expect(extension.contributeStyles?.(node, context)).toEqual({
      padding: '0.5rem',
      '@media (hover: hover)': {
        '&:is(:where(.group):hover *)': { textDecorationLine: 'underline' },
      },
    });
  });

  it('contributes the converted style object', () => {
    expect(
      tailwind({ output: 'styles' }).contributeStyles?.(
        element('px-4 hover:underline'),
        context
      )
    ).toEqual({
      paddingInline: '1rem',
      '@media (hover: hover)': {
        ':hover': { textDecorationLine: 'underline' },
      },
    });
  });

  it('contributes no styles without an override', () => {
    expect(
      tailwind({ output: 'styles' }).contributeStyles?.(
        { type: 'element', tag: 'div' },
        context
      )
    ).toBeUndefined();
  });

  it('rejects a dark selector that is not a selector', () => {
    for (const darkSelector of [
      '',
      '  ',
      '@media print',
      '.dark { color: red }',
      '.dark &, [data-mode="dark"]',
      '.dark,',
    ]) {
      expect(() => tailwind({ output: 'styles', darkSelector })).toThrow(
        'tailwind({ darkSelector }) takes a selector'
      );
    }
  });

  it('accepts selector lists that agree on &', () => {
    expect(isDarkSelector('.dark, [data-mode="dark"]')).toBe(true);
    expect(isDarkSelector('.dark &, [data-mode="dark"] &')).toBe(true);
    expect(isDarkSelector(':is(.a, .b) &')).toBe(true);
    expect(isDarkSelector('.dark &, [data-mode="dark"]')).toBe(false);
  });

  it('contributes no styles in the default classes mode', () => {
    expect(
      tailwind().contributeStyles?.(element(['px-4']), context)
    ).toBeUndefined();
  });
});

describe("process with tailwind({ output: 'styles' })", () => {
  it('emits CSS instead of utility classes', () => {
    const template: Template = [
      {
        type: 'element',
        tag: 'button',
        attributes: { class: ['button'] },
        extensions: { tailwind: { classes: ['px-4', 'hover:bg-blue-700'] } },
        children: [{ type: 'text', content: 'Save' }],
      },
    ];
    const result = process(template, {
      extensions: [tailwind({ output: 'styles' })],
    });
    const html = result.files[0].content;
    expect(html).toContain('<button class="button">');
    expect(html).not.toContain('px-4');
    expect(html).toContain('.button {\n  padding-inline: 1rem;\n}');
    expect(html).toContain('@media (hover: hover)');
    expect(html).toContain('.button:hover');
  });

  it('emits dark: under the dark selector', () => {
    const template: Template = [
      {
        type: 'element',
        tag: 'div',
        attributes: { class: ['panel'] },
        extensions: {
          tailwind: {
            classes: ['bg-white', 'dark:bg-gray-900', 'md:dark:p-4'],
          },
        },
      },
    ];
    const css = process(template, {
      extensions: [
        tailwind({
          output: 'styles',
          darkSelector: ':root[data-mode="dark"] &',
        }),
      ],
    }).files[0].content;
    expect(css).toContain(
      ':root[data-mode="dark"] .panel {\n  background-color: oklch(21% 0.034 264.665);\n}'
    );
    expect(css).toContain(
      '@media (min-width: 48rem) {\n  :root[data-mode="dark"] .panel {\n    padding: 1rem;\n  }\n}'
    );
    expect(css).not.toContain('prefers-color-scheme');
  });

  it('lets authored style properties win over converted utilities', () => {
    const template: Template = [
      {
        type: 'element',
        tag: 'div',
        attributes: {
          class: ['panel'],
          style: { backgroundColor: 'rebeccapurple' },
        },
        extensions: { tailwind: { classes: ['bg-blue-600', 'p-2'] } },
      },
    ];
    const result = process(template, {
      extensions: [tailwind({ output: 'styles' })],
    });
    const css = result.files[0].content;
    expect(css).toContain('background-color: rebeccapurple;');
    expect(css).not.toContain('oklch');
    expect(css).toContain('padding: 0.5rem;');
  });

  describe('layers authored styles over converted ones', () => {
    const dark = ':where(:root:is([data-mode="dark"])) &';
    const darkSelector = ':where(:root:is([data-mode="dark"])) .panel';

    /** The emitted rules, each as its selector and declarations on one line. */
    function rules(classes: string[], style: Record<string, unknown>) {
      const result = process(
        [
          {
            type: 'element',
            tag: 'div',
            attributes: { class: ['panel'], style },
            extensions: { tailwind: { classes } },
          } as ElementNode,
        ],
        {
          extensions: [
            tailwind({ output: 'styles', darkSelector: '[data-mode="dark"]' }),
          ],
        }
      );
      const css = result.files[0].content;
      return [...css.matchAll(/([^{}\n][^{}]*?) \{([^{}]*)\}/g)].map(
        ([, selector, body]) =>
          `${selector.trim().split('\n').pop()} { ${body
            .trim()
            .split(/\s*\n\s*/)
            .join(' ')} }`
      );
    }

    it("keeps converted rules in Tailwind's variant order (A)", () => {
      expect(
        rules(['dark:text-white', 'md:text-black'], {
          '&[data-x]': { padding: '1px' },
          [dark]: { margin: '0' },
        })
      ).toEqual([
        '.panel { color: #000; }',
        `${darkSelector} { color: #fff; }`,
        '.panel[data-x] { padding: 1px; }',
        `${darkSelector} { margin: 0; }`,
      ]);
    });

    it('keeps an authored rule after a converted one it shares a selector with (B)', () => {
      expect(
        rules(['dark:text-white'], {
          '@media (min-width: 48rem)': { color: 'red' },
          [dark]: { margin: '0' },
        })
      ).toEqual([
        `${darkSelector} { color: #fff; }`,
        '.panel { color: red; }',
        `${darkSelector} { margin: 0; }`,
      ]);
    });

    it('keeps authored declarations in order, after what they override (C)', () => {
      expect(
        rules(['pl-4', 'p-2'], { padding: '1rem', paddingLeft: '2rem' })
      ).toEqual(['.panel { padding: 1rem; padding-left: 2rem; }']);
    });

    it('orders white-space and text-wrap as one family', () => {
      expect(
        rules(['text-balance', 'whitespace-nowrap'], { textWrap: 'wrap' })
      ).toEqual(['.panel { white-space: nowrap; text-wrap: wrap; }']);
      expect(
        rules(['whitespace-nowrap', 'text-balance'], { whiteSpace: 'normal' })
      ).toEqual(['.panel { text-wrap: balance; white-space: normal; }']);
    });

    it('keeps a hand-written dark override after the authored key before it', () => {
      const style = {
        color: 'gray',
        '&[data-featured="true"]': { color: 'red' },
        [dark]: {
          color: 'white',
          '&[data-featured="true"]': { color: 'pink' },
        },
      };
      const authoredOrder = [
        '.panel { padding: 1rem; color: gray; }',
        '.panel[data-featured="true"] { color: red; }',
        `${darkSelector} { color: white; }`,
        `${darkSelector}[data-featured="true"] { color: pink; }`,
      ];
      expect(rules(['p-4'], style)).toEqual(authoredOrder);
      expect(rules(['p-4', 'dark:bg-black'], style)).toEqual([
        authoredOrder[0],
        `${darkSelector} { background-color: #000; }`,
        ...authoredOrder.slice(1),
      ]);
    });

    it('merges in place where neither layer is reordered', () => {
      expect(
        rules(['bg-blue-600', 'rounded-md', 'focus:underline', 'md:p-4'], {
          backgroundColor: 'rebeccapurple',
          ':focus': { outlineColor: 'red' },
        })
      ).toEqual([
        '.panel { background-color: rebeccapurple; border-radius: 0.375rem; }',
        '.panel:focus { text-decoration-line: underline; outline-color: red; }',
        '.panel { padding: 1rem; }',
      ]);
    });
  });

  it('marks selector-less nodes with data-jte-node', () => {
    const template: Template = [
      {
        type: 'element',
        tag: 'span',
        extensions: { tailwind: { classes: ['block', 'text-sm'] } },
      },
    ];
    const result = process(template, {
      extensions: [tailwind({ output: 'styles' })],
    });
    const html = result.files[0].content;
    expect(html).toContain('<span data-jte-node="Component-0">');
    expect(html).toContain('[data-jte-node="Component-0"] {');
  });

  it('raises a processing error carrying the node path', () => {
    const template: Template = [
      {
        type: 'element',
        tag: 'div',
        extensions: { tailwind: { classes: ['rotate-45'] } },
      },
    ];
    expect(() =>
      process(template, { extensions: [tailwind({ output: 'styles' })] })
    ).toThrow(
      /rotate.*outside the supported conversion subset.*children\[0\]/s
    );
  });

  it('reports every unconvertible utility of the template in one error', () => {
    const template: Template = [
      {
        type: 'element',
        tag: 'div',
        extensions: { tailwind: { classes: ['bogus-2', 'p-4', 'rotate-45'] } },
        children: [
          {
            type: 'element',
            tag: 'span',
            extensions: { tailwind: { classes: ['shadow-lg/50'] } },
          },
        ],
      },
    ];
    expect(() =>
      process(template, { extensions: [tailwind({ output: 'styles' })] })
    ).toThrow(
      [
        '3 styling errors:',
        "  Cannot convert Tailwind utility 'bogus-2': unknown utility (at children[0])",
        "  Cannot convert Tailwind utility 'rotate-45': 'rotate' relies on Tailwind's composed custom-property machinery and is outside the supported conversion subset (at children[0])",
        "  Cannot convert Tailwind utility 'shadow-lg/50': unsupported value (at children[0].children[0])",
      ].join('\n')
    );
  });

  it('warns about utilities left in conditional and expression classes', () => {
    const template: Template = [
      {
        type: 'element',
        tag: 'button',
        attributes: {
          class: [
            'button',
            {
              $expression:
                "active ? 'bg-blue-600 is-active' : `text-sm ${tone}`",
            },
          ],
        },
        conditionalAttributes: [
          {
            condition: 'disabled',
            attributes: { class: ['opacity-50 button--disabled', 'ring-2'] },
          },
        ],
        extensions: { tailwind: { classes: ['px-4'] } },
      },
    ];
    const result = process(template, {
      extensions: [tailwind({ output: 'styles' })],
    });
    expect(result.warnings).toEqual([
      {
        message:
          "Tailwind utilities in conditionalAttributes are not converted under output: 'styles' and stay class names with no CSS behind them: 'opacity-50', 'ring-2'. Give a condition its styles as a conditionalAttributes entry that pairs a class of your own with a style instead; the style becomes that class's rule",
        nodePath: 'children[0]',
      },
      {
        message:
          "Tailwind utilities in a class expression are not converted under output: 'styles' and stay class names with no CSS behind them: 'bg-blue-600', 'text-sm'. Give a condition its styles as a conditionalAttributes entry that pairs a class of your own with a style instead; the style becomes that class's rule",
        nodePath: 'children[0]',
      },
    ]);
  });

  it('reads utilities with a variant or a leading ! as utilities', () => {
    expect(looksLikeUtilityClass('data-[state=open]:bg-accent')).toBe(true);
    expect(looksLikeUtilityClass('aria-expanded:bg-muted')).toBe(true);
    expect(looksLikeUtilityClass('!bg-brand')).toBe(true);
    expect(looksLikeUtilityClass('!p-4')).toBe(true);
    expect(looksLikeUtilityClass('hover:ring-2')).toBe(true);
    // A theme token on its own reads as a plain name.
    expect(looksLikeUtilityClass('bg-primary')).toBe(false);
    expect(looksLikeUtilityClass('content-wrapper')).toBe(false);
    expect(looksLikeUtilityClass('data-[x]:card__title')).toBe(false);
    // A Tailwind v4 utility outside the subset reads as one with a variant
    // or a leading !, as a known root with an unknown value does.
    expect(looksLikeUtilityClass('hover:float-left')).toBe(true);
    expect(looksLikeUtilityClass('!ms-2')).toBe(true);
    expect(looksLikeUtilityClass('container')).toBe(false);
    expect(looksLikeUtilityClass('start-panel')).toBe(false);
  });

  it('skips comparison operands and scans conditional expressions', () => {
    const warnings: string[] = [];
    tailwind({ output: 'styles' }).contributeStyles?.(
      {
        type: 'element',
        tag: 'div',
        attributes: {
          class: [
            {
              $expression:
                "variant === 'flex' ? 'p-4' : size !== \"block\" && 'm-2'",
            },
          ],
        },
        conditionalAttributes: [
          {
            condition: 'open',
            attributes: { class: [{ $expression: "'underline'" }] },
          },
        ],
      },
      { ...context, warn: (message) => warnings.push(message) }
    );
    expect(warnings).toEqual([
      expect.stringContaining(
        "a class expression are not converted under output: 'styles' and stay class names with no CSS behind them: 'p-4', 'm-2', 'underline'."
      ),
    ]);
  });

  it('does not warn about plain class names or in classes mode', () => {
    const template: Template = [
      {
        type: 'element',
        tag: 'div',
        attributes: { class: [{ $expression: "open ? 'menu--open' : ''" }] },
        conditionalAttributes: [
          {
            condition: 'compact',
            attributes: { class: ['menu--compact', 'content-wrapper'] },
          },
        ],
        extensions: { tailwind: { classes: ['p-2'] } },
      },
    ];
    expect(
      process(template, { extensions: [tailwind({ output: 'styles' })] })
        .warnings
    ).toEqual([]);
    const utilityTemplate: Template = [
      {
        type: 'element',
        tag: 'div',
        conditionalAttributes: [
          { condition: 'compact', attributes: { class: ['p-1'] } },
        ],
      },
    ];
    expect(
      process(utilityTemplate, { extensions: [tailwind()] }).warnings
    ).toEqual([]);
  });
});

describe('registered custom properties', () => {
  const names = (...classes: string[]) =>
    [
      ...(registeredPropertyRules([convert(...classes)]) ?? '').matchAll(
        /@property (--[\w-]+)/g
      ),
    ].map((match) => match[1]);
  const shadowGroup = [
    '--tw-shadow',
    '--tw-shadow-color',
    '--tw-shadow-alpha',
    '--tw-inset-shadow',
    '--tw-inset-shadow-color',
    '--tw-inset-shadow-alpha',
    '--tw-ring-color',
    '--tw-ring-shadow',
    '--tw-inset-ring-color',
    '--tw-inset-ring-shadow',
    '--tw-ring-inset',
    '--tw-ring-offset-width',
    '--tw-ring-offset-color',
    '--tw-ring-offset-shadow',
  ];
  const numericGroup = [
    '--tw-ordinal',
    '--tw-slashed-zero',
    '--tw-numeric-figure',
    '--tw-numeric-spacing',
    '--tw-numeric-fraction',
  ];

  it('registers what Tailwind v4 registers for the utilities used', () => {
    for (const candidate of [
      'shadow-md',
      'shadow-none',
      'ring',
      'ring-inset',
      'inset-ring',
      'inset-ring-2',
      'shadow-indigo-500/50',
      'shadow-inherit',
    ]) {
      expect(names(candidate)).toEqual(shadowGroup);
    }
    expect(names('hover:ring-2')).toEqual(shadowGroup);
    expect(names('outline-2')).toEqual(['--tw-outline-style']);
    expect(names('tabular-nums')).toEqual(numericGroup);
    expect(names('outline-2', 'shadow-sm', 'tabular-nums')).toEqual([
      ...numericGroup,
      ...shadowGroup,
      '--tw-outline-style',
    ]);
    for (const candidate of [
      'ring-blue-500',
      'inset-ring-blue-500',
      'ring-offset-2',
      'outline-dashed',
      'normal-nums',
      'p-4',
    ]) {
      expect(registeredPropertyRules([convert(candidate)])).toBeUndefined();
    }
  });

  it('writes the rules as Tailwind v4 does', () => {
    const rules = registeredPropertyRules([convert('ring-2')]);
    expect(rules).toContain(
      '@property --tw-shadow {\n  syntax: "*";\n  inherits: false;\n  initial-value: 0 0 #0000;\n}'
    );
    expect(rules).toContain(
      '@property --tw-ring-offset-width {\n  syntax: "<length>";\n  inherits: false;\n  initial-value: 0px;\n}'
    );
    expect(rules).toContain(
      '@property --tw-ring-color {\n  syntax: "*";\n  inherits: false;\n}'
    );
  });

  it('emits the rules once per component, after its rules', () => {
    const css = process(
      [
        {
          type: 'element',
          tag: 'div',
          attributes: { class: ['card'] },
          extensions: { tailwind: { classes: ['ring-1'] } },
          children: [
            {
              type: 'element',
              tag: 'button',
              attributes: { class: ['card__action'] },
              extensions: { tailwind: { classes: ['shadow-sm'] } },
            },
          ],
        },
      ],
      { extensions: [tailwind({ output: 'styles' })] }
    ).files[0].content;
    expect(css.match(/@property --tw-shadow \{/g)).toHaveLength(1);
    expect(css.indexOf('@property')).toBeGreaterThan(
      css.indexOf('.card__action {')
    );
    expect(
      process(
        [
          {
            type: 'element',
            tag: 'div',
            extensions: { tailwind: { classes: ['ring-1'] } },
          },
        ],
        { extensions: [tailwind()] }
      ).files[0].content
    ).not.toContain('@property');
  });
});

describe('variant order', () => {
  const dark = ':where(:root:is([data-mode="dark"])) .p';

  function emittedWithStyle(
    classes: string[],
    style: Record<string, unknown>
  ): string[] {
    return emitted(classes, '[data-mode="dark"]', style);
  }

  /** The emitted rules in order, each with its at-rules and selector on one line. */
  function emitted(
    classes: string[],
    darkSelector?: string,
    style?: Record<string, unknown>
  ): string[] {
    const result = process(
      [
        {
          type: 'element',
          tag: 'a',
          attributes: {
            class: ['p'],
            ...(style === undefined ? {} : { style }),
          } as ElementNode['attributes'],
          extensions: { tailwind: { classes } },
        },
      ],
      {
        extensions: [
          tailwind({
            output: 'styles',
            ...(darkSelector === undefined ? {} : { darkSelector }),
          }),
        ],
      }
    );
    const rules: string[] = [];
    const context: string[] = [];
    for (const line of result.files[0].content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.endsWith('{')) {
        context.push(trimmed.slice(0, -1).trim());
      } else if (trimmed === '}') {
        context.pop();
      } else if (trimmed.includes(':') && trimmed.endsWith(';')) {
        rules.push(`${context.join(' ')} { ${trimmed} }`);
      }
    }
    return rules;
  }

  const hover = '@media (hover: hover)';
  const darkMedia = '@media (prefers-color-scheme: dark)';
  const indigo500 = 'background-color: oklch(58.5% 0.233 277.117);';
  const indigo600 = 'background-color: oklch(51.1% 0.262 276.966);';

  it('emits dark:hover: after hover:, whatever the class order', () => {
    const expected = [
      `${hover} .p:hover { ${indigo600} }`,
      `${darkMedia} .p { color: #fff; }`,
      `${darkMedia} ${hover} .p:hover { ${indigo500} }`,
    ];
    expect(
      emitted([
        'dark:text-white',
        'hover:bg-indigo-600',
        'dark:hover:bg-indigo-500',
      ])
    ).toEqual(expected);
    expect(
      emitted([
        'dark:hover:bg-indigo-500',
        'dark:text-white',
        'hover:bg-indigo-600',
      ])
    ).toEqual(expected);
  });

  it('sorts hover:dark: with dark:hover:', () => {
    expect(
      emitted(
        ['hover:dark:bg-indigo-500', 'hover:bg-indigo-600'],
        '[data-mode="dark"]'
      )
    ).toEqual([
      `${hover} .p:hover { ${indigo600} }`,
      `${hover} ${dark}:hover { ${indigo500} }`,
    ]);
  });

  it('emits dark:focus-visible: after focus-visible:', () => {
    expect(
      emitted(
        [
          'dark:text-white',
          'dark:focus-visible:bg-indigo-500',
          'focus-visible:bg-indigo-600',
        ],
        '[data-mode="dark"]'
      )
    ).toEqual([
      `.p:focus-visible { ${indigo600} }`,
      `${dark} { color: #fff; }`,
      `${dark}:focus-visible { ${indigo500} }`,
    ]);
  });

  it('emits dark:data-[x=y]: after data-[x=y]:', () => {
    expect(
      emitted(
        [
          'dark:text-white',
          'data-[featured=true]:bg-indigo-600',
          'dark:data-[featured=true]:bg-indigo-500',
        ],
        '[data-mode="dark"]'
      )
    ).toEqual([
      `.p[data-featured="true"] { ${indigo600} }`,
      `${dark} { color: #fff; }`,
      `${dark}[data-featured="true"] { ${indigo500} }`,
    ]);
    expect(
      emitted(['dark:aria-checked:bg-indigo-500', 'aria-checked:bg-indigo-600'])
    ).toEqual([
      `.p[aria-checked="true"] { ${indigo600} }`,
      `${darkMedia} .p[aria-checked="true"] { ${indigo500} }`,
    ]);
  });

  it('orders by variant: hover, focus, attributes, breakpoints, then dark', () => {
    expect(
      emitted([
        'dark:p-1',
        'lg:p-2',
        'md:p-3',
        'data-active:p-4',
        'focus:p-5',
        'hover:p-6',
        'p-7',
      ])
    ).toEqual([
      '.p { padding: 1.75rem; }',
      `${hover} .p:hover { padding: 1.5rem; }`,
      '.p:focus { padding: 1.25rem; }',
      '.p[data-active] { padding: 1rem; }',
      '@media (min-width: 48rem) .p { padding: 0.75rem; }',
      '@media (min-width: 64rem) .p { padding: 0.5rem; }',
      `${darkMedia} .p { padding: 0.25rem; }`,
    ]);
  });

  it('emits a stacked rule as a second rule rather than hoist it before an earlier one', () => {
    expect(
      emitted(
        ['md:dark:bg-indigo-500', 'dark:bg-white', 'md:bg-indigo-600'],
        '[data-mode="dark"]'
      )
    ).toEqual([
      `@media (min-width: 48rem) .p { ${indigo600} }`,
      `${dark} { background-color: #fff; }`,
      `@media (min-width: 48rem) ${dark} { ${indigo500} }`,
    ]);
    expect(
      convertUtilityClasses(['md:dark:p-1', 'dark:p-2', 'md:p-3'], fail)
    ).toEqual({
      '@media (min-width: 48rem)': { padding: '0.75rem' },
      '@media (prefers-color-scheme: dark)': { padding: '0.5rem' },
      '&': {
        '@media (min-width: 48rem)': {
          '@media (prefers-color-scheme: dark)': { padding: '0.25rem' },
        },
      },
    });
  });

  it('lets an authored block win over a converted second rule at its path', () => {
    const darkKey = ':where(:root:is([data-mode="dark"])) &';
    expect(
      emittedWithStyle(
        ['hover:bg-indigo-600', 'dark:text-white', 'hover:dark:bg-indigo-500'],
        { [hover]: { ':hover': { [darkKey]: { backgroundColor: 'black' } } } }
      )
    ).toEqual([
      `${hover} .p:hover { ${indigo600} }`,
      `${dark} { color: #fff; }`,
      `${hover} ${dark}:hover { background-color: black; }`,
    ]);
    expect(
      emittedWithStyle(
        ['md:p-4', 'dark:bg-[#000010]', 'md:dark:bg-[#000011]'],
        {
          '@media (min-width: 48rem)': {
            [darkKey]: { backgroundColor: 'black' },
          },
        }
      )
    ).toEqual([
      '@media (min-width: 48rem) .p { padding: 1rem; }',
      `${dark} { background-color: #000010; }`,
      `@media (min-width: 48rem) ${dark} { background-color: black; }`,
    ]);
  });

  it('keeps two authored blocks bound for one second rule in written order', () => {
    const rules = emitted(
      [
        'hover:bg-red-500',
        'first:motion-safe:bg-red-600',
        'hover:md:bg-red-700',
        'first:print:bg-red-800',
      ],
      undefined,
      {
        ':first-child': { color: 'blue' },
        [hover]: { ':hover': { color: 'green' } },
      }
    );
    const blue = rules.indexOf('.p:first-child { color: blue; }');
    const green = rules.indexOf(`${hover} .p:hover { color: green; }`);
    expect(blue).toBeGreaterThan(-1);
    expect(green).toBeGreaterThan(blue);
    expect(green).toBe(rules.length - 1);
  });

  it('lets the later of two interacting utilities win in one rule', () => {
    expect(emitted(['px-4', 'p-2', 'px-8'])).toEqual([
      '.p { padding: 0.5rem; }',
      '.p { padding-inline: 2rem; }',
    ]);
    expect(emitted(['hover:pl-4', 'hover:p-2', 'hover:pl-8'])).toEqual([
      `${hover} .p:hover { padding: 0.5rem; }`,
      `${hover} .p:hover { padding-left: 2rem; }`,
    ]);
    expect(emitted(['bg-indigo-500', 'p-2', 'bg-indigo-600'])).toEqual([
      `.p { ${indigo600} }`,
      '.p { padding: 0.5rem; }',
    ]);
  });

  it('orders group-* and peer-* first, by inner variant, then name', () => {
    expect(
      emitted([
        'dark:p-4',
        'hover:p-3',
        'peer-checked:p-2',
        'group-[.is-open]:p-1',
        'group-hover/card:p-1',
        'group-aria-expanded:p-1',
        'group-hover:p-1',
        'group-focus:p-1',
      ]).map((rule) => rule.replace(/ \{.*$/, ''))
    ).toEqual([
      `${hover} .p:is(:where(.group):hover *)`,
      `${hover} .p:is(:where(.group\\/card):hover *)`,
      '.p:is(:where(.group):focus *)',
      '.p:is(:where(.group)[aria-expanded="true"] *)',
      '.p:is(:where(.group):is(.is-open) *)',
      '.p:is(:where(.peer):checked ~ *)',
      `${hover} .p:hover`,
      `${darkMedia} .p`,
    ]);
  });

  it('keeps declared order between utilities with the same variants', () => {
    expect(emitted(['hover:bg-indigo-500', 'hover:bg-indigo-600'])).toEqual([
      `${hover} .p:hover { ${indigo600} }`,
    ]);
  });

  it('compares variants in Tailwind v4 registration order', () => {
    const ordered = [
      'placeholder',
      'first',
      'checked',
      'valid',
      'invalid',
      'user-valid',
      'user-invalid',
      'read-only',
      'hover',
      'focus',
      'focus-visible',
      'disabled',
      'aria-checked',
      'aria-[sort=ascending]',
      'data-active',
      'data-[state=open]',
      'motion-safe',
      'sm',
      'md',
      '2xl',
      'dark',
      'print',
    ];
    for (let index = 1; index < ordered.length; index += 1) {
      expect(compareVariants(ordered[index - 1], ordered[index])).toBeLessThan(
        0
      );
      expect(
        compareVariants(ordered[index], ordered[index - 1])
      ).toBeGreaterThan(0);
    }
    expect(compareVariants('hover', 'hover')).toBe(0);
    expect(compareVariants('group-hover', 'placeholder')).toBeLessThan(0);
    expect(compareVariants('group-[.a]', 'peer-hover')).toBeLessThan(0);
    expect(compareVariants('group-hover', 'group-hover/card')).toBeLessThan(0);
    expect(compareVariants('group-hover/a', 'group-hover/b')).toBeLessThan(0);
    expect(compareVariants('group-hover/z', 'group-focus')).toBeLessThan(0);
    expect(compareVariants('group-data-x', 'group-[.a]')).toBeLessThan(0);
    expect(compareVariants('group-hover/card', 'group-hover/card')).toBe(0);
    // Bracketed values compare decoded: `a_c` reads `a c`, before `a-b`.
    expect(compareVariants('data-[a_c]', 'data-[a-b]')).toBeLessThan(0);
    expect(compareVariantSets([], ['hover'])).toBeLessThan(0);
    expect(compareVariantSets(['dark', 'hover'], ['hover', 'dark'])).toBe(0);
    expect(compareVariantSets(['dark'], ['hover', 'md'])).toBeGreaterThan(0);
    expect(compareVariantSets(['dark'], ['dark', 'hover'])).toBeLessThan(0);
    expect(
      compareVariantSets(['md', 'dark'], ['hover', 'dark'])
    ).toBeGreaterThan(0);
  });
});
