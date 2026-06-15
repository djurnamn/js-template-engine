import { process, type StylingContext } from '@js-template-engine/core';
import type { ElementNode, Template } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import { convertUtilityClasses } from '../src/conversion/convert';
import { tailwind } from '../src/tailwind-extension';

function fail(message: string): never {
  throw new Error(message);
}

function convert(...classes: string[]) {
  return convertUtilityClasses(classes, fail);
}

const context: StylingContext = {
  ancestorElements: [],
  warn() {
    throw new Error('the tailwind extension never warns');
  },
  fail,
};

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

  it('resolves shadows to plain box-shadow values', () => {
    expect(convert('shadow-md')).toEqual({
      boxShadow:
        '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    });
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
    expect(() => convert('ring-2')).toThrow(
      'outside the supported conversion subset'
    );
    expect(() => convert('space-x-4')).toThrow(
      'styles sibling elements through child combinators'
    );
    expect(() => convert('-translate-x-2')).toThrow(
      "composed custom-property machinery"
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
    expect(() => convert('group-hover:bg-red-500')).toThrow(
      "the 'group-hover' variant targets other elements"
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
    expect(() => convert('bogus:p-2')).toThrow("unknown variant 'bogus'");
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
    expect(html).toContain('<span data-jte-node="0">');
    expect(html).toContain('[data-jte-node="0"] {');
  });

  it('raises a processing error carrying the node path', () => {
    const template: Template = [
      {
        type: 'element',
        tag: 'div',
        extensions: { tailwind: { classes: ['ring-2'] } },
      },
    ];
    expect(() =>
      process(template, { extensions: [tailwind({ output: 'styles' })] })
    ).toThrow(/ring.*outside the supported conversion subset.*children\[0\]/s);
  });
});
