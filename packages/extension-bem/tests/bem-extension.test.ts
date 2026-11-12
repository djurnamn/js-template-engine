import {
  applyStylingExtensions,
  formatBemCall,
  normalizeTemplate,
  process,
  type BemRuntimeCall,
  type StylingContext,
} from '@js-template-engine/core';
import type { ElementNode, Template } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import { bem } from '../src/bem-extension';

/**
 * Formats a runtime call from its structured parts the way a target
 * extension does (without slot-reference rewriting, which is the target
 * layer's concern). The BEM extension produces the parts; this asserts on the
 * call they format to.
 */
function callExpression(call: BemRuntimeCall): string {
  return formatBemCall(
    call.elementName,
    call.staticModifiers,
    call.conditionalModifiers
  );
}

function element(
  overrides: NonNullable<ElementNode['extensions']>['bem'],
  tag = 'div'
): ElementNode {
  return { type: 'element', tag, extensions: { bem: overrides } };
}

function context(
  ancestorElements: ElementNode[] = [],
  warnings: string[] = []
): StylingContext {
  return {
    ancestorElements,
    warn(message) {
      warnings.push(message);
    },
    fail(message): never {
      throw new Error(message);
    },
  };
}

describe('bem', () => {
  it('contributes the block class', () => {
    expect(bem().contributeClasses(element({ block: 'button' }), context()))
      .toEqual(['button']);
  });

  it('joins block and element', () => {
    expect(
      bem().contributeClasses(
        element({ block: 'button', element: 'icon' }),
        context()
      )
    ).toEqual(['button__icon']);
  });

  it('appends one class per modifier in declared order', () => {
    expect(
      bem().contributeClasses(
        element({ block: 'button', modifiers: ['primary', 'large'] }),
        context()
      )
    ).toEqual(['button', 'button--primary', 'button--large']);
  });

  it('attaches modifiers to the block__element base', () => {
    expect(
      bem().contributeClasses(
        element({ block: 'card', element: 'title', modifiers: ['centered'] }),
        context()
      )
    ).toEqual(['card__title', 'card__title--centered']);
  });

  it('uses the configured separators', () => {
    expect(
      bem({ elementSeparator: '-', modifierSeparator: '_' }).contributeClasses(
        element({ block: 'button', element: 'icon', modifiers: ['large'] }),
        context()
      )
    ).toEqual(['button-icon', 'button-icon_large']);
  });

  it('inherits the nearest ancestor declared block', () => {
    const outer = element({ block: 'card' }, 'article');
    const inner = element({ block: 'media' }, 'figure');
    expect(
      bem().contributeClasses(
        element({ element: 'caption' }),
        context([outer, inner])
      )
    ).toEqual(['media__caption']);
  });

  it('inherits through ancestors that declare only an element', () => {
    const root = element({ block: 'card' }, 'article');
    const body = element({ element: 'body' }, 'section');
    expect(
      bem().contributeClasses(element({ element: 'title' }), context([root, body]))
    ).toEqual(['card__title']);
  });

  it('inherits a block for modifier-only overrides', () => {
    expect(
      bem().contributeClasses(
        element({ modifiers: ['active'] }),
        context([element({ block: 'tab' }, 'nav')])
      )
    ).toEqual(['tab', 'tab--active']);
  });

  it('contributes nothing without an override', () => {
    const warnings: string[] = [];
    expect(
      bem().contributeClasses(
        { type: 'element', tag: 'div' },
        context([], warnings)
      )
    ).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('contributes nothing for an empty override without warning', () => {
    const warnings: string[] = [];
    expect(bem().contributeClasses(element({}), context([], warnings))).toEqual(
      []
    );
    expect(warnings).toEqual([]);
  });

  it('warns when element or modifiers have no effective block', () => {
    const warnings: string[] = [];
    expect(
      bem().contributeClasses(element({ element: 'icon' }), context([], warnings))
    ).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('no effective block');
  });

  it('treats empty strings as absent', () => {
    expect(
      bem().contributeClasses(
        element({ block: '', element: 'icon' }),
        context([element({ block: 'button' }, 'span')])
      )
    ).toEqual(['button__icon']);
  });
});

describe('process with bem', () => {
  const template: Template = [
    {
      type: 'element',
      tag: 'article',
      attributes: { class: ['featured'] },
      extensions: { bem: { block: 'card' } },
      children: [
        {
          type: 'element',
          tag: 'h2',
          attributes: { style: { ':hover': { color: 'red' } } },
          extensions: { bem: { element: 'title', modifiers: ['centered'] } },
          children: [{ type: 'text', content: 'Hello' }],
        },
      ],
    },
  ];

  it('renders merged class lists and targets the BEM class', () => {
    const result = process(template, { extensions: [bem()] });
    const html = result.files[0].content;
    expect(html).toContain('<article class="featured card"');
    expect(html).toContain(
      '<h2 class="card__title card__title--centered">'
    );
    expect(html).toContain('.card__title:hover');
    expect(result.warnings).toEqual([]);
  });

  it('reports the node path when no effective block exists', () => {
    const orphan: Template = [element({ element: 'icon' }, 'span')];
    const result = process(orphan, { extensions: [bem()] });
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].nodePath).toBe('children[0]');
  });
});

describe('process with bem: shared classes and selector lists', () => {
  const table = (rowHeaderStyle: Record<string, unknown>): Template => ({
    type: 'component',
    name: 'Table',
    children: [
      {
        type: 'element',
        tag: 'table',
        extensions: { bem: { block: 'table' } },
        children: [
          {
            type: 'element',
            tag: 'th',
            attributes: { scope: 'col', style: { fontWeight: 600 } },
            extensions: { bem: { element: 'header' } },
          },
          {
            type: 'element',
            tag: 'th',
            attributes: { scope: 'row', style: rowHeaderStyle },
            extensions: { bem: { element: 'header' } },
          },
        ],
      },
    ],
  } as Template);
  const cssOf = (template: Template) =>
    process(template, {
      extensions: [bem()],
      styling: { placement: 'separate-file' },
    });

  it('emits a rule two nodes share once, without a warning', () => {
    const result = cssOf(table({ fontWeight: 600 }));
    const css = result.files.find((file) => file.path.endsWith('.css'))!.content;
    expect(css.match(/\.table__header \{/g)).toHaveLength(1);
    expect(result.warnings).toEqual([]);
  });

  it('keeps a repeated rule at its last place, as the cascade reads it', () => {
    const node = (className: string, color: string) => ({
      type: 'element',
      tag: 'span',
      attributes: { class: [className], style: { color } },
    });
    const result = cssOf({
      type: 'component',
      name: 'Order',
      children: [node('x', 'red'), node('y', 'blue'), node('x', 'red')],
    } as Template);
    const css = result.files.find((file) => file.path.endsWith('.css'))!.content;
    expect(css.trim()).toBe(
      '.y {\n  color: blue;\n}\n\n.x {\n  color: red;\n}'
    );
    expect(result.warnings).toEqual([]);
  });

  it('warns naming both nodes when they style a shared class differently', () => {
    const result = cssOf(table({ fontWeight: 400 }));
    expect(result.warnings).toEqual([
      {
        message: expect.stringMatching(
          /^The <th class="table__header" scope="col"> at children\[0\]\.children\[0\] and the <th class="table__header" scope="row"> here both style \.table__header and give it different declarations/
        ),
        nodePath: 'children[0].children[1].attributes.style',
      },
    ]);
    const css = result.files.find((file) => file.path.endsWith('.css'))!.content;
    expect(css.match(/\.table__header \{/g)).toHaveLength(2);
  });

  it('compares rule by rule: a rule one node adds is no conflict, and declaration order does not count', () => {
    const withModifier = cssOf({
      type: 'component',
      name: 'Table',
      children: [
        {
          type: 'element',
          tag: 'table',
          extensions: { bem: { block: 'table' } },
          children: [
            {
              type: 'element',
              tag: 'th',
              attributes: { style: { fontWeight: 600 } },
              extensions: { bem: { element: 'header' } },
            },
            {
              type: 'element',
              tag: 'th',
              attributes: {
                style: {
                  fontWeight: 600,
                  '&.table__header--numeric': { textAlign: 'end' },
                },
              },
              extensions: { bem: { element: 'header', modifiers: ['numeric'] } },
            },
          ],
        },
      ],
    } as Template);
    expect(withModifier.warnings).toEqual([]);
    const css = withModifier.files.find((file) => file.path.endsWith('.css'))!.content;
    expect(css.match(/\.table__header \{/g)).toHaveLength(1);
    expect(css).toContain('.table__header--numeric {');

    const reordered = cssOf(table({ color: 'red', fontWeight: 600 }));
    // An extra declaration on the selector both nodes style is a conflict.
    expect(reordered.warnings).toHaveLength(1);
    const swapped = cssOf({
      type: 'component',
      name: 'Table',
      children: [
        {
          type: 'element',
          tag: 'table',
          extensions: { bem: { block: 'table' } },
          children: [
            {
              type: 'element',
              tag: 'th',
              attributes: { style: { color: 'red', fontWeight: 600 } },
              extensions: { bem: { element: 'header' } },
            },
            {
              type: 'element',
              tag: 'th',
              attributes: { style: { fontWeight: 600, color: 'red' } },
              extensions: { bem: { element: 'header' } },
            },
          ],
        },
      ],
    } as Template);
    expect(swapped.warnings).toEqual([]);
    const swappedCss = swapped.files.find((file) => file.path.endsWith('.css'))!.content;
    expect(swappedCss.match(/\.table__header \{/g)).toHaveLength(1);
  });

  it('keeps declaration order where a shorthand and its longhand overlap', () => {
    const pair = (first: Record<string, unknown>, second: Record<string, unknown>) =>
      cssOf({
        type: 'component',
        name: 'Table',
        children: [
          {
            type: 'element',
            tag: 'table',
            extensions: { bem: { block: 'table' } },
            children: [first, second].map((style) => ({
              type: 'element',
              tag: 'th',
              attributes: { style },
              extensions: { bem: { element: 'header' } },
            })),
          },
        ],
      } as Template);
    const result = pair(
      { margin: 0, marginTop: '4px' },
      { marginTop: '4px', margin: 0 }
    );
    expect(result.warnings).toHaveLength(1);
    const css = result.files.find((file) => file.path.endsWith('.css'))!.content;
    expect(css.match(/\.table__header \{/g)).toHaveLength(2);
  });

  it('never merges a rule inside @layer', () => {
    const layered = { '@layer kit': { color: 'red' } };
    const result = cssOf(table(layered));
    const css = cssOf({
      type: 'component',
      name: 'Table',
      children: [
        {
          type: 'element',
          tag: 'table',
          extensions: { bem: { block: 'table' } },
          children: [
            {
              type: 'element',
              tag: 'th',
              attributes: { style: layered },
              extensions: { bem: { element: 'header' } },
            },
            {
              type: 'element',
              tag: 'th',
              attributes: { style: layered },
              extensions: { bem: { element: 'header' } },
            },
          ],
        },
      ],
    } as Template).files.find((file) => file.path.endsWith('.css'))!.content;
    expect(css.match(/@layer kit \{/g)).toHaveLength(2);
    expect(result.warnings).toEqual([]);
  });

  it('drops an empty selector and resolves a list under a list against each parent', () => {
    const one = (style: Record<string, unknown>) =>
      cssOf({
        type: 'component',
        name: 'Table',
        children: [
          {
            type: 'element',
            tag: 'th',
            attributes: { style },
            extensions: { bem: { block: 'table', element: 'header' } },
          },
        ],
      } as Template).files.find((file) => file.path.endsWith('.css'))?.content.trim() ?? '';
    expect(one({ ',': { width: '100%' }, ', ,': { width: '1px' } })).toBe('');
    expect(one({ '&.table__header--wide,': { width: '100%' } })).toBe(
      '.table__header--wide {\n  width: 100%;\n}'
    );
    expect(one({ '&.table__header--wide,, &:hover': { width: '100%' } })).toBe(
      '.table__header--wide, .table__header:hover {\n  width: 100%;\n}'
    );
    expect(
      one({ '&.table__header--x, &.other': { '&:hover, &:focus': { color: 'red' } } })
    ).toBe(
      '.table__header--x:hover, .table__header--x:focus, .table__header.other:hover, .table__header.other:focus {\n  color: red;\n}'
    );
  });

  it('nests a list member without & as a descendant when another member holds &', () => {
    const control = (language: 'css' | 'scss') =>
      process(
        {
          type: 'component',
          name: 'Pagination',
          children: [
            {
              type: 'element',
              tag: 'a',
              attributes: {
                style: {
                  '&:disabled, a.Pagination__control:not([href])': { opacity: 0.5 },
                  '&:hover, :focus-visible': { color: 'red' },
                },
              },
              extensions: { bem: { block: 'Pagination', element: 'control' } },
            },
          ],
        } as Template,
        {
          extensions: [bem()],
          styling: { placement: 'separate-file', language },
        }
      ).files.find((file) => /\.s?css$/.test(file.path))!.content;
    const css = control('css');
    expect(css).toContain(
      '.Pagination__control:disabled, .Pagination__control a.Pagination__control:not([href]) {'
    );
    expect(css).toContain('.Pagination__control:hover, .Pagination__control:focus-visible {');
    const scss = control('scss');
    expect(scss).toContain('&:disabled, & a.Pagination__control:not([href]) {');
    expect(scss).not.toContain('&a.');
  });

  it('collapses each selector of a self-compound list on its own, dropping another element\'s modifier', () => {
    const style = {
      '&.table__cell--numeric, &.table__header--numeric': { textAlign: 'end' },
    };
    const template: Template = {
      type: 'component',
      name: 'Table',
      children: [
        {
          type: 'element',
          tag: 'table',
          extensions: { bem: { block: 'table' } },
          children: [
            {
              type: 'element',
              tag: 'td',
              attributes: { style },
              extensions: { bem: { element: 'cell' } },
            },
            {
              type: 'element',
              tag: 'th',
              attributes: { style },
              extensions: { bem: { element: 'header' } },
            },
          ],
        },
      ],
    } as Template;
    const css = cssOf(template).files.find((file) =>
      file.path.endsWith('.css')
    )!.content;
    // No BEM node carries a modifier of another element of its block, so
    // each node keeps its own element's selector.
    expect(css.trim()).toBe(
      '.table__cell--numeric {\n  text-align: end;\n}\n\n.table__header--numeric {\n  text-align: end;\n}'
    );
    const scss = process(template, {
      extensions: [bem()],
      styling: { placement: 'separate-file', language: 'scss' },
    }).files.find((file) => file.path.endsWith('.scss'))!.content;
    expect(scss).toContain('.table__cell {\n  &--numeric {');
    expect(scss).toContain('.table__header {\n  &--numeric {');
    expect(scss).not.toContain('&.table__');

    // A node that can carry a class of another element keeps the selector:
    // a literal conditional class, a class expression, or a per-target
    // attributes override setting the class.
    const carrying = (fields: Record<string, unknown>) =>
      cssOf({
        type: 'component',
        name: 'Table',
        children: [
          {
            type: 'element',
            tag: 'table',
            extensions: { bem: { block: 'table' } },
            children: [
              {
                type: 'element',
                tag: 'td',
                attributes: { class: fields.class, style },
                conditionalAttributes: fields.conditionalAttributes,
                extensions: {
                  ...(fields.overrides as object),
                  bem: { element: 'cell' },
                },
              },
            ],
          },
        ],
      } as Template).files.find((file) => file.path.endsWith('.css'))!.content;
    expect(
      carrying({
        conditionalAttributes: [
          { condition: 'numeric', attributes: { class: ['table__header--numeric'] } },
        ],
      })
    ).toContain(
      '.table__cell--numeric, .table__cell.table__header--numeric {'
    );
    expect(carrying({ class: [{ $expression: 'extraClass' }] })).toContain(
      '.table__cell--numeric, .table__cell.table__header--numeric {'
    );
    expect(carrying({ class: { $expression: 'extraClass' } })).toContain(
      '.table__cell--numeric, .table__cell.table__header--numeric {'
    );
    for (const override of [
      { react: { attributes: { className: 'extra' } } },
      { vue: { attributes: { class: 'extra' } } },
    ]) {
      expect(carrying({ overrides: override })).toContain(
        '.table__cell--numeric, .table__cell.table__header--numeric {'
      );
    }
    // A compound outside the block's vocabulary stays as written.
    expect(
      cssOf({
        type: 'component',
        name: 'Table',
        children: [
          {
            type: 'element',
            tag: 'td',
            attributes: { style: { '&.table__cell--x, &.is-open, &.other__y--z': { color: 'red' } } },
            extensions: { bem: { block: 'table', element: 'cell' } },
          },
        ],
      } as Template).files.find((file) => file.path.endsWith('.css'))!.content
    ).toContain('.table__cell--x, .table__cell.is-open, .table__cell.other__y--z {');
  });

  it('warns when a rule one node sharing a class gives would match the other node', () => {
    const shared = (
      rowHeader: Record<string, unknown>,
      columnHeader: Record<string, unknown> = {},
      rowModifiers: string[] = []
    ) =>
      cssOf({
        type: 'component',
        name: 'Table',
        children: [
          {
            type: 'element',
            tag: 'table',
            extensions: { bem: { block: 'table' } },
            children: [
              {
                type: 'element',
                tag: 'th',
                attributes: {
                  scope: 'col',
                  style: { fontWeight: 600 },
                  ...(columnHeader.attributes as object),
                },
                conditionalAttributes: columnHeader.conditionalAttributes,
                extensions: { bem: { element: 'header' } },
              },
              {
                type: 'element',
                tag: 'th',
                attributes: { scope: 'row', style: { fontWeight: 600, ...rowHeader } },
                extensions: { bem: { element: 'header', modifiers: rowModifiers } },
              },
            ],
          },
        ],
      } as Template).warnings;

    for (const key of ['&:first-child', ':hover', '&::before', '@media (min-width: 40em)']) {
      const nested = key.startsWith('@')
        ? { [key]: { '&:hover': { color: 'red' } } }
        : { [key]: { color: 'red' } };
      expect(shared(nested), key).toEqual([
        {
          message: expect.stringMatching(
            /^The <th class="table__header" scope="row"> here styles .*\.table__header:.*, which the <th class="table__header" scope="col"> at children\[0\]\.children\[0\] can also match/
          ),
          nodePath: 'children[0].children[1].attributes.style',
        },
      ]);
    }

    // Silent: a rule keyed on a modifier only this node carries, a class the
    // other node has only conditionally, a combinator, an attribute, and a
    // rule both nodes give alike.
    expect(
      shared({ '&.table__header--row': { '&:first-child': { color: 'red' } } }, {}, ['row'])
    ).toEqual([]);
    expect(
      shared(
        { '&.is-active': { color: 'red' } },
        {
          conditionalAttributes: [
            { condition: 'active', attributes: { class: ['is-active'] } },
          ],
        }
      )
    ).toEqual([]);
    expect(shared({ '& > span': { color: 'red' } })).toEqual([]);
    expect(shared({ '.group &:hover': { color: 'red' } })).toEqual([]);
    expect(shared({ '&[aria-sort]': { color: 'red' } })).toEqual([]);
    for (const key of [
      '&:not(.table__header--numeric)',
      '&:has(> svg)',
      '&:is([aria-sort])',
      '&:is(#total)',
      '&:where(.x .y)',
    ]) {
      expect(shared({ [key]: { color: 'red' } }), key).toEqual([]);
    }

    // The shared selector inside an at-rule on one of two nodes that both
    // style it hides or restyles both there.
    expect(
      shared({ '@media (max-width: 40em)': { display: 'none' } })
    ).toEqual([
      {
        message: expect.stringMatching(
          /^The <th class="table__header" scope="row"> here styles @media \(max-width: 40em\) \.table__header, which the <th class="table__header" scope="col"> at children\[0\]\.children\[0\] can also match/
        ),
        nodePath: 'children[0].children[1].attributes.style',
      },
    ]);
    // Attribute values are escaped in the node description.
    expect(
      shared({ '&:hover': { color: 'red' } }, { attributes: { title: 'say "hi"' } })[0]
        .message
    ).toContain('title="say &quot;hi&quot;"');
    expect(
      shared(
        { '&:hover': { color: 'red' } },
        { attributes: { style: { fontWeight: 600, '&:hover': { color: 'red' } } } }
      )
    ).toEqual([]);
  });
});

describe('bem runtime mode', () => {
  const runtime = bem({ mode: 'runtime' }).runtime!;

  it('is absent in literal mode and present in runtime mode', () => {
    expect(bem().runtime).toBeUndefined();
    expect(bem({ mode: 'runtime' }).runtime).toBeDefined();
  });

  it('exposes the import source and separators', () => {
    const custom = bem({
      mode: 'runtime',
      importSource: '@scope/bem',
      elementSeparator: '-',
      modifierSeparator: '_',
    }).runtime!;
    expect(custom.importSource).toBe('@scope/bem');
    expect(custom.elementSeparator).toBe('-');
    expect(custom.modifierSeparator).toBe('_');
  });

  it('emits a block-only call', () => {
    const call = runtime.call(element({ block: 'Badge' }), context())!;
    expect(callExpression(call)).toBe('bem()');
    expect(call.block).toBe('Badge');
    expect(call.declaresBlock).toBe(true);
    expect(call.contributedClasses).toEqual(['Badge']);
  });

  it('emits an element call', () => {
    const call = runtime.call(
      element({ element: 'icon' }),
      context([element({ block: 'Badge' })])
    )!;
    expect(callExpression(call)).toBe("bem('icon')");
    expect(call.declaresBlock).toBe(false);
    expect(call.contributedClasses).toEqual(['Badge__icon']);
  });

  it('emits one static modifier as a string argument', () => {
    const call = runtime.call(
      element({ block: 'Badge', element: 'icon', modifiers: ['large'] }),
      context()
    )!;
    expect(callExpression(call)).toBe("bem('icon', 'large')");
    expect(call.contributedClasses).toEqual([
      'Badge__icon',
      'Badge__icon--large',
    ]);
  });

  it('emits multiple static modifiers as an array argument', () => {
    const call = runtime.call(
      element({ block: 'Badge', modifiers: ['solid', 'large'] }),
      context()
    )!;
    expect(callExpression(call)).toBe("bem(undefined, ['solid', 'large'])");
  });

  it('folds an in-vocabulary conditional class into a record argument', () => {
    const node: ElementNode = {
      type: 'element',
      tag: 'span',
      extensions: { bem: { block: 'Badge' } },
      conditionalAttributes: [
        { condition: 'isSolid', attributes: { class: ['Badge--solid'] } },
      ],
    };
    const call = runtime.call(node, context())!;
    expect(callExpression(call)).toBe('bem(undefined, { solid: isSolid })');
    expect(call.foldedConditionalClasses).toEqual(['Badge--solid']);
  });

  it('merges static and folded modifiers into one record', () => {
    const node: ElementNode = {
      type: 'element',
      tag: 'span',
      extensions: { bem: { block: 'Badge', element: 'icon', modifiers: ['large'] } },
      conditionalAttributes: [
        { condition: 'isActive', attributes: { class: ['Badge__icon--active'] } },
      ],
    };
    const call = runtime.call(node, context())!;
    expect(callExpression(call)).toBe(
      "bem('icon', { large: true, active: isActive })"
    );
  });

  it('quotes record keys that are not valid identifiers', () => {
    const node: ElementNode = {
      type: 'element',
      tag: 'span',
      extensions: { bem: { block: 'Badge' } },
      conditionalAttributes: [
        { condition: 'on', attributes: { class: ['Badge--is-on'] } },
      ],
    };
    const call = runtime.call(node, context())!;
    expect(callExpression(call)).toBe("bem(undefined, { 'is-on': on })");
  });

  it('joins the conditions of a modifier repeated across conditional entries', () => {
    const node: ElementNode = {
      type: 'element',
      tag: 'span',
      extensions: { bem: { block: 'Badge' } },
      conditionalAttributes: [
        { condition: "tone === 'info'", attributes: { class: ['Badge--soft'] } },
        { condition: "tone === 'warn'", attributes: { class: ['Badge--soft'] } },
      ],
    };
    const call = runtime.call(node, context())!;
    expect(callExpression(call)).toBe(
      "bem(undefined, { soft: (tone === 'info') || (tone === 'warn') })"
    );
    expect(call.foldedConditionalClasses).toEqual(['Badge--soft']);
  });

  it('drops a conditional modifier the node already carries statically', () => {
    const node: ElementNode = {
      type: 'element',
      tag: 'span',
      extensions: { bem: { block: 'Badge', modifiers: ['solid'] } },
      conditionalAttributes: [
        { condition: 'isSolid', attributes: { class: ['Badge--solid'] } },
      ],
    };
    const call = runtime.call(node, context())!;
    expect(callExpression(call)).toBe("bem(undefined, 'solid')");
    expect(call.foldedConditionalClasses).toEqual(['Badge--solid']);
  });

  it('leaves an out-of-vocabulary conditional class unfolded', () => {
    const node: ElementNode = {
      type: 'element',
      tag: 'span',
      extensions: { bem: { block: 'Badge' } },
      conditionalAttributes: [
        { condition: 'isActive', attributes: { class: ['is-active'] } },
      ],
    };
    const call = runtime.call(node, context())!;
    expect(callExpression(call)).toBe('bem()');
    expect(call.foldedConditionalClasses).toEqual([]);
  });

  it('returns undefined for a node without a bem override', () => {
    const node: ElementNode = { type: 'element', tag: 'div' };
    expect(runtime.call(node, context())).toBeUndefined();
  });

  it('returns undefined for an orphan with no effective block', () => {
    expect(runtime.call(element({ element: 'icon' }), context())).toBeUndefined();
  });
});

describe('process with bem runtime mode', () => {
  it('surfaces the runtime binding and per-element calls', () => {
    const template: Template = [
      {
        type: 'element',
        tag: 'span',
        extensions: { bem: { block: 'Badge' } },
        children: [
          {
            type: 'element',
            tag: 'span',
            extensions: { bem: { element: 'label' } },
          },
        ],
      },
    ];
    const { component } = applyStylingExtensions(
      normalizeTemplate(template, 'Badge'),
      [bem({ mode: 'runtime' })]
    );
    expect(component.bemRuntime).toEqual({
      block: 'Badge',
      elementSeparator: '__',
      modifierSeparator: '--',
      importSource: 'use-bem',
    });
    expect(component.bemRuntimeCalls?.size).toBe(2);
  });

  it('keeps the literal classes on the class attribute for HTML and CSS', () => {
    const template: Template = [
      {
        type: 'element',
        tag: 'span',
        extensions: { bem: { block: 'Badge', modifiers: ['solid'] } },
      },
    ];
    const result = process(template, {
      extensions: [bem({ mode: 'runtime' })],
    });
    // HTML mode is unchanged by runtime mode - literal classes are rendered.
    expect(result.files[0].content).toContain(
      'class="Badge Badge--solid"'
    );
  });

  it('fails loudly on a second declared block', () => {
    const template: Template = [
      {
        type: 'element',
        tag: 'span',
        extensions: { bem: { block: 'Badge' } },
        children: [
          {
            type: 'element',
            tag: 'span',
            extensions: { bem: { block: 'Other' } },
          },
        ],
      },
    ];
    expect(() =>
      applyStylingExtensions(normalizeTemplate(template, 'Badge'), [
        bem({ mode: 'runtime' }),
      ])
    ).toThrow(/one block per component/);
  });
});
