import { process, type StylingContext } from '@js-template-engine/core';
import type { ElementNode, Template } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import { convertStyleToUtilities } from '../src/conversion/from-styles';
import { tailwind } from '../src/tailwind-extension';

function fail(message: string): never {
  throw new Error(message);
}

function classesFor(style: Record<string, unknown>): string[] {
  return convertStyleToUtilities(style as never, fail).classes;
}

const context: StylingContext = {
  ancestorElements: [],
  warn() {
    throw new Error('the tailwind extension never warns');
  },
  error: fail,
  fail,
};

describe('style-to-utility conversion', () => {
  it('converts a dark selector key back to dark:', () => {
    const withSelector = (
      darkSelector: string,
      style: Record<string, unknown>
    ) =>
      convertStyleToUtilities(style as never, fail, { darkSelector }).classes;
    expect(
      withSelector('[data-mode="dark"]', {
        ':where(:root:is([data-mode="dark"])) &': { padding: '0.5rem' },
        ':hover': {
          ':where(:root:is([data-mode="dark"])) &': { margin: '0.5rem' },
        },
      })
    ).toEqual(['dark:p-2', 'hover:dark:m-2']);
    // A bare attribute key is the element's own state, not dark mode.
    expect(() =>
      withSelector('[data-mode="dark"]', {
        '[data-mode="dark"]': { padding: '0.5rem' },
      })
    ).toThrow('Cannot convert style selector \'[data-mode="dark"]\'');
    expect(
      withSelector(':root.dark &', { ':root.dark &': { padding: '0.5rem' } })
    ).toEqual(['dark:p-2']);
    expect(() =>
      withSelector('.dark', {
        '@media (prefers-color-scheme: dark)': { padding: '0.5rem' },
      })
    ).toThrow(
      "Cannot convert style selector '@media (prefers-color-scheme: dark)'"
    );
  });


  it('converts named utilities across families', () => {
    expect(
      classesFor({
        paddingInline: '1rem',
        marginTop: '0.5rem',
        borderRadius: '0.375rem',
        backgroundColor: 'oklch(54.6% 0.245 262.881)',
        color: '#fff',
        display: 'flex',
        justifyContent: 'space-between',
        fontWeight: '600',
      })
    ).toEqual([
      'px-4',
      'mt-2',
      'rounded-md',
      'bg-blue-600',
      'text-white',
      'flex',
      'justify-between',
      'font-semibold',
    ]);
  });

  it('converts resize and field-sizing back to their utilities', () => {
    expect(
      classesFor({
        resize: 'vertical',
        fieldSizing: 'content',
        ':focus': { resize: 'both' },
      })
    ).toEqual(['resize-y', 'field-sizing-content', 'focus:resize']);
  });

  it('resolves negative scale values', () => {
    expect(classesFor({ marginLeft: '-0.5rem', top: '-1rem', zIndex: '-10' })).toEqual([
      '-ml-2',
      '-top-4',
      '-z-10',
    ]);
  });

  it('recovers opacity modifiers as /opacity colors', () => {
    expect(
      classesFor({
        backgroundColor:
          'color-mix(in oklab, oklch(54.6% 0.245 262.881) 75%, transparent)',
      })
    ).toEqual(['bg-blue-600/75']);
  });

  it('falls back to arbitrary values and properties for total coverage', () => {
    expect(
      classesFor({ padding: '3px', 'mask-type': 'luminance' })
    ).toEqual(['p-[3px]', '[mask-type:luminance]']);
  });

  it('converts a box-shadow to the shadow utility that draws it', () => {
    expect(
      classesFor({
        boxShadow:
          '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      })
    ).toEqual(['shadow-md']);
    expect(classesFor({ boxShadow: '0 0 #0000' })).toEqual(['shadow-none']);
    expect(classesFor({ boxShadow: '0 0 2px red' })).toEqual([
      'shadow-[0_0_2px_red]',
    ]);
    for (const keyword of [
      'inherit',
      'initial',
      'unset',
      'revert',
      'revert-layer',
    ]) {
      expect(classesFor({ boxShadow: keyword })).toEqual([
        `[box-shadow:${keyword}]`,
      ]);
    }
  });

  it('writes a type hint where the fallback would pick another property', () => {
    expect(
      classesFor({
        color: 'var(--ink)',
        fontSize: 'var(--size)',
        borderTopWidth: 'var(--rule)',
        fontWeight: 'var(--weight)',
        boxShadow: 'var(--elevation)',
        fontFamily: 'Inter, sans-serif',
      })
    ).toEqual([
      'text-[var(--ink)]',
      'text-[length:var(--size)]',
      'border-t-[length:var(--rule)]',
      '[font-weight:var(--weight)]',
      'shadow-[var(--elevation)]',
      '[font-family:Inter,_sans-serif]',
    ]);
  });

  it('accepts a math function written without operator spacing', () => {
    expect(
      classesFor({ width: 'calc(100%-2rem)', height: 'calc(100vh - 4rem)' })
    ).toEqual(['w-[calc(100%-2rem)]', 'h-[calc(100vh_-_4rem)]']);
  });

  it('keeps underscores in url() and var() names as written', () => {
    expect(
      classesFor({
        padding: 'var(--c_d)',
        fontSize: 'var(--my_size)',
        backgroundImage: 'url(a_b.png)',
        width: 'calc(var(--side_gap) * 2)',
      })
    ).toEqual([
      'p-[var(--c_d)]',
      'text-[length:var(--my_size)]',
      '[background-image:url(a_b.png)]',
      'w-[calc(var(--side_gap)_*_2)]',
    ]);
  });

  it('rejects a url() holding a space', () => {
    expect(() => classesFor({ backgroundImage: 'url("a b.png")' })).toThrow(
      `Cannot convert CSS declaration 'background-image: url("a b.png")' to a Tailwind utility`
    );
  });

  it('carries !important as the trailing modifier', () => {
    expect(classesFor({ borderWidth: '2px !important' })).toEqual(['border-2!']);
  });

  it('inverts nested blocks to variant prefixes', () => {
    expect(
      classesFor({
        ':hover': { color: 'oklch(39.6% 0.141 25.723)' },
        '@media (min-width: 48rem)': { padding: '2rem' },
        '@media (prefers-color-scheme: dark)': { color: '#fff' },
        '@media (hover: hover)': {
          ':hover': { textDecorationLine: 'underline' },
        },
        '@media (min-width: 64rem)': {
          '@media (hover: hover)': {
            ':hover': { textDecorationLine: 'underline' },
          },
        },
      })
    ).toEqual([
      'hover:text-red-900',
      'md:p-8',
      'dark:text-white',
      'hover:underline',
      'lg:hover:underline',
    ]);
    expect(
      classesFor({
        ':user-invalid': { marginTop: '0' },
        ':user-valid': { marginBottom: '0' },
      })
    ).toEqual(['user-invalid:mt-0', 'user-valid:mb-0']);
  });

  it('keeps per-property expression values as the remaining style', () => {
    expect(
      convertStyleToUtilities(
        { color: '#fff', fontSize: { $expression: 'size' } } as never,
        fail
      )
    ).toEqual({
      classes: ['text-white'],
      remainingStyle: { fontSize: { $expression: 'size' } },
    });
  });

  it('errors on a selector with no Tailwind variant equivalent', () => {
    expect(() => classesFor({ '.parent &': { color: '#fff' } })).toThrow(
      /'.parent &'.*no.*variant equivalent.*outside the supported conversion subset/s
    );
  });

  it('errors on a $include - Sass source is not a utility', () => {
    expect(() => classesFor({ $include: "typography('body')" })).toThrow(
      /Sass include.*cannot be converted/s
    );
  });

  it('errors on a $include nested inside a variant block', () => {
    expect(() =>
      classesFor({ ':hover': { $include: 'focus-ring()' } })
    ).toThrow(/Sass include.*cannot be converted/s);
  });

  it('errors on an @include at-rule key - Sass source is not a utility', () => {
    expect(() => classesFor({ '@include typography': true })).toThrow(
      /Sass include.*cannot be converted/s
    );
  });

  it('errors on an @include key nested inside a variant block', () => {
    expect(() =>
      classesFor({ ':hover': { '@include focus-ring': true } })
    ).toThrow(/Sass include.*cannot be converted/s);
  });
});

describe('tailwind({ convertStyles: true })', () => {
  function element(style: Record<string, unknown>): ElementNode {
    return { type: 'element', tag: 'div', attributes: { style: style as never } };
  }

  it('lifts the authored style into classes and clears the remainder', () => {
    expect(
      tailwind({ convertStyles: true }).convertStyleToClasses?.(
        element({ paddingInline: '1rem', display: 'flex' }),
        context
      )
    ).toEqual({ classes: ['px-4', 'flex'], remainingStyle: undefined });
  });

  it('leaves a whole-object expression style untouched', () => {
    expect(
      tailwind({ convertStyles: true }).convertStyleToClasses?.(
        { type: 'element', tag: 'div', attributes: { style: { $expression: 'styles' } } },
        context
      )
    ).toBeUndefined();
  });

  it('does nothing in the default mode', () => {
    expect(
      tailwind().convertStyleToClasses?.(
        element({ paddingInline: '1rem' }),
        context
      )
    ).toBeUndefined();
  });
});

describe('process with tailwind({ convertStyles: true })', () => {
  it('emits utility classes instead of CSS, with no stylesheet', () => {
    const template: Template = [
      {
        type: 'element',
        tag: 'button',
        attributes: {
          class: ['save'],
          style: { paddingInline: '1rem', borderRadius: '0.375rem' },
        },
        children: [{ type: 'text', content: 'Save' }],
      },
    ];
    const result = process(template, {
      extensions: [tailwind({ convertStyles: true })],
    });
    const html = result.files[0].content;
    expect(html).toContain('<button class="save px-4 rounded-md">');
    expect(html).not.toContain('<style');
    expect(html).not.toContain('padding-inline');
  });

  it('raises a processing error carrying the node path', () => {
    const template: Template = [
      {
        type: 'element',
        tag: 'div',
        attributes: { style: { '.parent &': { color: '#fff' } } },
      },
    ];
    expect(() =>
      process(template, { extensions: [tailwind({ convertStyles: true })] })
    ).toThrow(/no.*variant equivalent.*children\[0\]/s);
  });
});
