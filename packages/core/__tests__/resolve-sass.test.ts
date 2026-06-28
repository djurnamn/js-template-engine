import type { Template } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import { process } from '../src/process';

/**
 * Builds a single-element component whose only node carries the given style,
 * with a component-level `style` preamble defining helper mixins (so the
 * `$include`s resolve under `language: 'css'` with no load path).
 */
function component(style: Record<string, unknown>, preamble: string): Template {
  return {
    type: 'component',
    name: 'Widget',
    style: preamble,
    children: [
      {
        type: 'element',
        tag: 'div',
        attributes: { class: ['Widget'], style: style as never },
        children: [{ type: 'text', content: 'x' }],
      },
    ],
  };
}

const css = (template: Template, outputStrategy: 'in-file' | 'inline' = 'in-file') =>
  process(template, { componentName: 'Widget', styling: { language: 'css', outputStrategy } })
    .files.map((file) => file.content)
    .join('\n');

describe('sass resolution (language: css)', () => {
  it('expands a flat mixin into the node block, merged with authored declarations', () => {
    const out = css(
      component(
        { $include: 'typography', fontWeight: 600 },
        '@mixin typography { font-size: 1rem; line-height: 1.5; }'
      )
    );
    expect(out).toContain('font-size: 1rem;');
    expect(out).toContain('line-height: 1.5;');
    expect(out).toContain('font-weight: 600;');
    expect(out).not.toContain('@include');
  });

  it('resolves `&`-interpolated compound modifier selectors against the node', () => {
    const out = css(
      component(
        { $include: 'modifiers' },
        `@mixin modifiers {
           &:not(#{&}--colored)#{&}--soft { color: red; }
           &--colored#{&}--soft { color: blue; }
         }`
      )
    );
    expect(out).toContain(
      '.Widget:not(.Widget--colored).Widget--soft {'
    );
    expect(out).toContain('.Widget--colored.Widget--soft {');
  });

  it('merges the separate @media blocks each modifier branch emits into one', () => {
    const out = css(
      component(
        { $include: 'hoverable' },
        `@mixin hover-shift {
           @media (hover: hover) { &:hover { opacity: 0.9; } }
         }
         @mixin hoverable {
           &--a { @include hover-shift; }
           &--b { @include hover-shift; }
         }`
      )
    );
    // One combined @media block, not two.
    expect(out.match(/@media \(hover: hover\)/g)?.length).toBe(1);
    expect(out).toContain('.Widget--a:hover {');
    expect(out).toContain('.Widget--b:hover {');
  });

  it('preserves `$expression` properties through resolution (runtime values)', () => {
    const out = css(
      component(
        { $include: 'sized', '--widget-size': { $expression: "size + 'rem'" } },
        '@mixin sized { display: block; }'
      )
    );
    // The static include resolved to a stylesheet rule...
    expect(out).toContain('display: block;');
    // ...while the dynamic property is preserved for the target's runtime
    // style mechanism (here, HTML mode's interpolation) rather than compiled.
    expect(out).toContain("--widget-size: {{ size + 'rem' }}");
  });

  it('resolves a content-bearing `@include` at-rule key (mixin in the preamble, no load path)', () => {
    const out = css(
      component(
        { color: 'blue', '@include hover-it': { textDecoration: 'underline' } },
        '@mixin hover-it { @media (hover: hover) { &:hover { @content; } } }'
      )
    );
    // The mixin's content block resolves and routes to the stylesheet; the
    // raw @include never leaks, and the preamble is consumed (not emitted).
    expect(out).toContain('@media (hover: hover) {');
    expect(out).toContain('.Widget:hover {');
    expect(out).toContain('text-decoration: underline;');
    expect(out).not.toContain('@include');
    expect(out).not.toContain('@mixin');
  });

  it('emits a no-content `@include` statement for both `true` and `{}` (no braces)', () => {
    const preamble = '@mixin pad { padding: 0.5rem; }';
    const fromTrue = css(component({ '@include pad': true }, preamble));
    const fromEmpty = css(component({ '@include pad': {} }, preamble));
    // A content-free mixin only accepts the statement form - `@include pad {}`
    // throws in Dart Sass - so both shorthands resolve to the same flat CSS.
    expect(fromTrue).toContain('padding: 0.5rem;');
    expect(fromEmpty).toContain('padding: 0.5rem;');
    expect(fromTrue).not.toContain('@include');
  });

  it('honors include/declaration order so a later declaration overrides the mixin', () => {
    const preamble = '@mixin base { font-weight: 400; }';
    // Include first, then the authored override: the declaration wins.
    const overrideWins = css(
      component({ '@include base': true, fontWeight: 700 }, preamble)
    );
    expect(overrideWins).toContain('font-weight: 700;');
    expect(overrideWins).not.toContain('font-weight: 400;');
    // Reversed: the mixin's declaration is emitted last, so it wins - proving
    // the order is authored order, not include-always-first.
    const mixinWins = css(
      component({ fontWeight: 700, '@include base': true }, preamble)
    );
    expect(mixinWins).toContain('font-weight: 400;');
    expect(mixinWins).not.toContain('font-weight: 700;');
  });

  it("still resolves the deprecated `$include` key and emits a deprecation warning", () => {
    const result = process(
      component({ $include: 'pad' }, '@mixin pad { padding: 0.5rem; }'),
      { componentName: 'Widget', styling: { language: 'css' } }
    );
    const content = result.files.map((file) => file.content).join('\n');
    expect(content).toContain('padding: 0.5rem;');
    expect(content).not.toContain('@include');
    expect(
      result.warnings.some((warning) => warning.message.includes('$include'))
    ).toBe(true);
  });

  it('inlines a flat resolved style as a `style` attribute under the inline strategy', () => {
    const out = css(
      component(
        { $include: 'pad' },
        '@mixin pad { padding: 0.25rem 0.5rem; }'
      ),
      'inline'
    );
    expect(out).toContain('style="padding: 0.25rem 0.5rem"');
  });
});
