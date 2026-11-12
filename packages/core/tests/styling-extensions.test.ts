import type {
  ElementNode,
  NestedStyleObject,
  Template,
} from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import { staticTagOf } from '../src/dynamic-tag';
import type { NormalizedComponent } from '../src/normalize';
import { process } from '../src/process';
import {
  applyStylingExtensions,
  isStylingExtension,
  type StylingContext,
  type StylingExtension,
} from '../src/styling-extensions';
import { TemplateError } from '../src/TemplateError';

function component(children: NormalizedComponent['children']): NormalizedComponent {
  return {
    name: 'Card',
    props: {},
    imports: [],
    children,
    extensions: {},
  };
}

function contributor(
  key: string,
  classKind: 'semantic' | 'utility',
  contribute: (element: ElementNode, context: StylingContext) => readonly string[]
): StylingExtension {
  return { key, kind: 'styling', classKind, contributeClasses: contribute };
}

function styleContributor(
  key: string,
  contribute: (
    element: ElementNode,
    context: StylingContext
  ) => NestedStyleObject | undefined
): StylingExtension {
  return {
    key,
    kind: 'styling',
    classKind: 'utility',
    contributeClasses: () => [],
    contributeStyles: contribute,
  };
}

describe('isStylingExtension', () => {
  it('accepts a styling extension and rejects other extensions', () => {
    expect(
      isStylingExtension(contributor('bem', 'semantic', () => []))
    ).toBe(true);
    expect(isStylingExtension({ key: 'react' })).toBe(false);
  });
});

describe('applyStylingExtensions', () => {
  it('returns the component untouched without styling extensions', () => {
    const base = component([{ type: 'element', tag: 'div' }]);
    const application = applyStylingExtensions(base, [{ key: 'react' }]);
    expect(application.component).toBe(base);
    expect(application.warnings).toEqual([]);
  });

  it('appends contributed classes after static classes in extension order', () => {
    const base = component([
      {
        type: 'element',
        tag: 'button',
        attributes: { class: ['button'] },
      },
    ]);
    const application = applyStylingExtensions(base, [
      contributor('first', 'semantic', () => ['button--primary']),
      contributor('second', 'utility', () => ['px-4', 'button']),
    ]);
    const element = application.component.children[0] as ElementNode;
    expect(element.attributes?.class).toEqual([
      'button',
      'button--primary',
      'px-4',
    ]);
  });

  it('records selector-eligible classes excluding utility contributions', () => {
    const base = component([
      { type: 'element', tag: 'button' },
      { type: 'element', tag: 'span', attributes: { class: 'icon' } },
    ]);
    const application = applyStylingExtensions(base, [
      contributor('utilities', 'utility', () => ['px-4']),
      contributor('names', 'semantic', (element) =>
        element.tag === 'button' ? ['button'] : []
      ),
    ]);
    const [button, span] = application.component.children as ElementNode[];
    expect(application.component.selectorClasses?.get(button)).toEqual([
      'button',
    ]);
    expect(application.component.selectorClasses?.get(span)).toEqual(['icon']);
    expect(button.attributes?.class).toEqual(['px-4', 'button']);
  });

  it('never mutates the input nodes', () => {
    const original: ElementNode = {
      type: 'element',
      tag: 'div',
      attributes: { class: ['card'] },
    };
    applyStylingExtensions(component([original]), [
      contributor('extra', 'semantic', () => ['card--flat']),
    ]);
    expect(original.attributes?.class).toEqual(['card']);
  });

  it('provides ancestor elements outermost first, through container nodes', () => {
    const seen: string[][] = [];
    const base = component([
      {
        type: 'element',
        tag: 'article',
        children: [
          {
            type: 'conditional',
            conditions: [
              {
                statement: 'if',
                condition: 'props.expanded',
                children: [
                  {
                    type: 'element',
                    tag: 'section',
                    children: [
                      {
                        type: 'iteration',
                        items: 'props.rows',
                        item: 'row',
                        children: [{ type: 'element', tag: 'span' }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);
    applyStylingExtensions(base, [
      contributor('observer', 'semantic', (element, context) => {
        seen.push(
          context.ancestorElements.map((ancestor) => staticTagOf(ancestor.tag))
        );
        return [];
      }),
    ]);
    expect(seen).toEqual([[], ['article'], ['article', 'section']]);
  });

  it('attaches the node path to warnings', () => {
    const base = component([
      {
        type: 'element',
        tag: 'div',
        children: [{ type: 'element', tag: 'span' }],
      },
    ]);
    const application = applyStylingExtensions(base, [
      contributor('grumbler', 'semantic', (element, context) => {
        if (element.tag === 'span') {
          context.warn('span has no effective block');
        }
        return [];
      }),
    ]);
    expect(application.warnings).toEqual([
      {
        message: 'span has no effective block',
        nodePath: 'children[0].children[0]',
      },
    ]);
  });
});

describe('applyStylingExtensions with style contributions', () => {
  it('sets contributed styles on elements without authored styles', () => {
    const base = component([{ type: 'element', tag: 'div' }]);
    const application = applyStylingExtensions(base, [
      styleContributor('converter', () => ({ padding: '1rem' })),
    ]);
    const element = application.component.children[0] as ElementNode;
    expect(element.attributes?.style).toEqual({ padding: '1rem' });
  });

  it('merges beneath the authored style, authored properties winning', () => {
    const base = component([
      {
        type: 'element',
        tag: 'div',
        attributes: {
          style: {
            backgroundColor: 'rebeccapurple',
            ':hover': { color: 'red' },
          },
        },
      },
    ]);
    const application = applyStylingExtensions(base, [
      styleContributor('converter', () => ({
        backgroundColor: 'blue',
        padding: '1rem',
        ':hover': { color: 'green', opacity: '0.5' },
      })),
    ]);
    const element = application.component.children[0] as ElementNode;
    expect(element.attributes?.style).toEqual({
      backgroundColor: 'rebeccapurple',
      padding: '1rem',
      ':hover': { color: 'red', opacity: '0.5' },
    });
  });

  it('merges multiple contributing extensions in extension order', () => {
    const base = component([{ type: 'element', tag: 'div' }]);
    const application = applyStylingExtensions(base, [
      styleContributor('first', () => ({ padding: '1rem', margin: '1rem' })),
      styleContributor('second', () => ({ padding: '2rem' })),
    ]);
    const element = application.component.children[0] as ElementNode;
    expect(element.attributes?.style).toEqual({
      padding: '2rem',
      margin: '1rem',
    });
  });

  it('rejects contributions onto a whole-object expression style', () => {
    const base = component([
      {
        type: 'element',
        tag: 'div',
        attributes: { style: { $expression: 'computeStyles(props)' } },
      },
    ]);
    expect(() =>
      applyStylingExtensions(base, [
        styleContributor('converter', () => ({ padding: '1rem' })),
      ])
    ).toThrow(TemplateError);
    expect(() =>
      applyStylingExtensions(base, [
        styleContributor('converter', () => ({ padding: '1rem' })),
      ])
    ).toThrow(/whole-object expression 'style'.*children\[0\]/s);
  });

  it('throws a TemplateError with the node path from context.fail', () => {
    const base = component([
      {
        type: 'element',
        tag: 'div',
        children: [{ type: 'element', tag: 'span' }],
      },
    ]);
    expect(() =>
      applyStylingExtensions(base, [
        styleContributor('converter', (element, context) =>
          element.tag === 'span' ? context.fail('cannot convert') : undefined
        ),
      ])
    ).toThrow('cannot convert (at children[0].children[0])');
  });

  it('throws one error recorded through context.error as it is', () => {
    const base = component([{ type: 'element', tag: 'div' }]);
    expect(() =>
      applyStylingExtensions(base, [
        styleContributor('converter', (_element, context) => {
          context.error?.('cannot convert');
          return undefined;
        }),
      ])
    ).toThrow(new TemplateError('cannot convert', 'children[0]'));
  });

  it('throws every error recorded through context.error together', () => {
    const base = component([
      {
        type: 'element',
        tag: 'div',
        children: [{ type: 'element', tag: 'span' }],
      },
    ]);
    let visited = 0;
    expect(() =>
      applyStylingExtensions(base, [
        styleContributor('converter', (element, context) => {
          visited += 1;
          context.error?.(`cannot convert the ${element.tag}`);
          context.error?.(`cannot convert the ${element.tag} again`);
          return undefined;
        }),
      ])
    ).toThrow(
      [
        '4 styling errors:',
        '  cannot convert the div (at children[0])',
        '  cannot convert the div again (at children[0])',
        '  cannot convert the span (at children[0].children[0])',
        '  cannot convert the span again (at children[0].children[0])',
      ].join('\n')
    );
    expect(visited).toBe(2);
  });

  it('carries each recorded error on the combined error', () => {
    const base = component([
      { type: 'element', tag: 'div' },
      { type: 'element', tag: 'span' },
    ]);
    let thrown: unknown;
    try {
      applyStylingExtensions(base, [
        styleContributor('converter', (element, context) => {
          context.error?.(`cannot convert the ${element.tag}`);
          return undefined;
        }),
      ]);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(TemplateError);
    expect((thrown as TemplateError).errors).toEqual([
      { message: 'cannot convert the div', nodePath: 'children[0]' },
      { message: 'cannot convert the span', nodePath: 'children[1]' },
    ]);
  });

  it('includes recorded errors when context.fail stops the run', () => {
    const base = component([
      { type: 'element', tag: 'div' },
      { type: 'element', tag: 'span' },
    ]);
    expect(() =>
      applyStylingExtensions(base, [
        styleContributor('converter', (element, context) => {
          if (element.tag === 'span') {
            context.fail('cannot go on');
          }
          context.error?.('cannot convert');
          return undefined;
        }),
      ])
    ).toThrow(
      [
        '2 styling errors:',
        '  cannot convert (at children[0])',
        '  cannot go on (at children[1])',
      ].join('\n')
    );
  });
});

describe('component CSS from styling extensions', () => {
  const registering: StylingExtension = {
    key: 'registering',
    kind: 'styling',
    classKind: 'semantic',
    contributeClasses: () => ['card'],
    contributeStyles: (element) =>
      element.tag === 'div' ? { '--level': '1' } : undefined,
    contributeComponentCss: (styles) =>
      styles.length === 0
        ? undefined
        : `@property --level {\n  syntax: "*";\n  inherits: false;\n}\n/* ${styles.length} */`,
  };
  const card: Template = [
    {
      type: 'element',
      tag: 'div',
      children: [{ type: 'element', tag: 'div' }],
    },
  ];

  it('passes the styles it contributed, in document order', () => {
    const seen: NestedStyleObject[][] = [];
    const recording: StylingExtension = {
      ...registering,
      contributeComponentCss: (styles) => {
        seen.push([...styles]);
        return undefined;
      },
    };
    applyStylingExtensions(
      component(card as NormalizedComponent['children']),
      [recording]
    );
    expect(seen).toEqual([[{ '--level': '1' }, { '--level': '1' }]]);
  });

  it('emits the CSS once, after the rules and outside the layer', () => {
    const css = process(card, {
      extensions: [registering],
      styling: { layer: { name: 'kit' } },
    }).files[0].content;
    expect(css.match(/@property --level/g)).toHaveLength(1);
    expect(css).toContain('/* 2 */');
    expect(css.indexOf('@property')).toBeGreaterThan(
      css.lastIndexOf('--level: 1;')
    );
    expect(css.indexOf('@property')).toBeGreaterThan(css.indexOf('\n}\n'));
    expect(css).toMatch(/@layer kit \{[^@]*\}\n\n@property --level/);
  });

  it('leaves the CSS out under the inline strategy', () => {
    const files = process(card, {
      extensions: [registering],
      styling: { placement: 'inline' },
    }).files;
    expect(files.map((file) => file.content).join('\n')).not.toContain(
      '@property'
    );
  });

  it('adds nothing when the extension returns nothing', () => {
    const css = process([{ type: 'element', tag: 'span' }], {
      extensions: [registering],
    }).files[0].content;
    expect(css).not.toContain('@property');
  });
});

describe('process with styling extensions', () => {
  const template: Template = [
    {
      type: 'element',
      tag: 'button',
      attributes: { style: { ':hover': { color: 'red' } } },
      children: [{ type: 'text', content: 'Save' }],
    },
  ];

  it('renders contributed classes and targets semantic classes', () => {
    const result = process(template, {
      extensions: [contributor('names', 'semantic', () => ['button'])],
    });
    expect(result.files[0].content).toContain('<button class="button">');
    expect(result.files[0].content).toContain('.button:hover');
  });

  it('never targets utility classes', () => {
    const result = process(template, {
      extensions: [contributor('utilities', 'utility', () => ['px-4'])],
    });
    expect(result.files[0].content).toContain('class="px-4"');
    expect(result.files[0].content).toContain('[data-jte-node="Component-0"]:hover');
    expect(result.files[0].content).not.toContain('.px-4');
  });

  it('surfaces styling warnings before renderer warnings', () => {
    const result = process(template, {
      extensions: [
        contributor('grumbler', 'semantic', (element, context) => {
          context.warn('no effective block');
          return [];
        }),
      ],
    });
    expect(result.warnings[0]).toEqual({
      message: 'no effective block',
      nodePath: 'children[0]',
    });
  });
});
