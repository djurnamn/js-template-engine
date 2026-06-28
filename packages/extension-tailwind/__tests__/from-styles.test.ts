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
  fail,
};

describe('style-to-utility conversion', () => {
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
