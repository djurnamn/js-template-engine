import type {
  ComponentNode,
  ElementNode,
  Template,
  TemplateNode,
} from '@js-template-engine/types';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { process } from '../src/process';
import {
  consumerAttributesDeclaration,
  isRoutedAttribute,
  isTokenListAttribute,
  joinTokenLists,
  mergesTokenList,
  routedAttributesDescription,
  routedElementOf,
  routingRootDescription,
} from '../src/passthrough-routing';
import { renderInstance } from '../src/html/render-instance';
import { TemplateError } from '../src/TemplateError';
import { validateTemplate } from '../src/validate';
import { everyTarget } from './support/targets';

const ROUTING = ['aria-*', 'on*', 'name', 'required', 'tabindex', 'for'];

/** A checkbox: a passthrough label around an input that routes `routing`. */
function checkbox(
  routing: unknown = { attributes: ROUTING },
  extra: Partial<ComponentNode> = {},
  inputExtra: Partial<ElementNode> = {}
): ComponentNode {
  return {
    type: 'component',
    name: 'Checkbox',
    props: { label: { type: 'string' } },
    ...extra,
    children: [
      {
        type: 'element',
        tag: 'label',
        passthrough: true,
        attributes: { class: ['checkbox'] },
        children: [
          {
            type: 'element',
            tag: 'input',
            passthrough: routing as ElementNode['passthrough'],
            attributes: { type: 'checkbox' },
            ...inputExtra,
          },
          { type: 'text', expression: 'label' },
        ],
      },
    ],
  };
}

function errorPath(template: unknown): string | undefined {
  try {
    validateTemplate(template as Template, everyTarget);
  } catch (error) {
    expect(error).toBeInstanceOf(TemplateError);
    return (error as TemplateError).nodePath;
  }
  return undefined;
}

describe('isRoutedAttribute', () => {
  it('matches aria-* in kebab and camelized spelling', () => {
    expect(isRoutedAttribute(['aria-*'], 'aria-describedby')).toBe(true);
    expect(isRoutedAttribute(['aria-*'], 'ariaDescribedby')).toBe(true);
    expect(isRoutedAttribute(['aria-*'], 'arial')).toBe(false);
  });

  it('matches every event handler with on*', () => {
    expect(isRoutedAttribute(['on*'], 'onChange')).toBe(true);
    expect(isRoutedAttribute(['on*'], 'onblur')).toBe(true);
    expect(isRoutedAttribute(['on*'], 'on')).toBe(false);
  });

  it('matches an HTML name case-blind and in a target spelling', () => {
    expect(isRoutedAttribute(['tabindex'], 'tabIndex')).toBe(true);
    expect(isRoutedAttribute(['for'], 'htmlFor')).toBe(false);
    expect(
      isRoutedAttribute(['for'], 'htmlFor', (name) =>
        name === 'for' ? 'htmlFor' : name
      )
    ).toBe(true);
  });

  it("routes everything but class, style and data-* with '*'", () => {
    for (const name of ['id', 'type', 'onClick', 'aria-label', 'title']) {
      expect(isRoutedAttribute(['*'], name)).toBe(true);
    }
    for (const name of ['class', 'className', 'style', 'data-testid']) {
      expect(isRoutedAttribute(['*'], name)).toBe(false);
    }
    expect(isRoutedAttribute(['*', 'data-testid'], 'data-testid')).toBe(true);
  });
});

describe('joinTokenLists', () => {
  it("puts the element's tokens first, then the consumer's, each once", () => {
    expect(joinTokenLists('hint error', 'help  hint')).toBe('hint error help');
    expect(joinTokenLists(undefined, 'help')).toBe('help');
    expect(joinTokenLists('hint', null)).toBe('hint');
    expect(joinTokenLists(false, '')).toBeUndefined();
  });
});

describe('isTokenListAttribute', () => {
  it('names the five id-reference list attributes, case-blind', () => {
    expect(isTokenListAttribute('aria-describedby')).toBe(true);
    expect(isTokenListAttribute('ARIA-Owns')).toBe(true);
    expect(isTokenListAttribute('aria-label')).toBe(false);
    expect(isTokenListAttribute('class')).toBe(false);
  });
});

describe('mergesTokenList', () => {
  it('merges the id-reference lists the list routes', () => {
    for (const name of [
      'aria-describedby',
      'aria-labelledby',
      'aria-controls',
      'aria-owns',
      'aria-details',
    ]) {
      expect(mergesTokenList(['aria-*'], name)).toBe(true);
    }
    expect(mergesTokenList(['aria-describedby'], 'aria-describedby')).toBe(
      true
    );
    expect(mergesTokenList(['*'], 'aria-labelledby')).toBe(true);
    expect(mergesTokenList(['aria-*'], 'aria-label')).toBe(false);
    expect(mergesTokenList(['required'], 'aria-describedby')).toBe(false);
  });
});

describe('consumerAttributesDeclaration', () => {
  it('splits a record by the routing list, each key keeping its spelling', () => {
    const javascript = ts.transpileModule(
      `${consumerAttributesDeclaration(ROUTING)}\nreturn consumerAttributes;`,
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } }
    ).outputText;
    const consumerAttributes = new Function(javascript)() as (
      attributes: object,
      share: string
    ) => Record<string, unknown>;
    const attributes = {
      'aria-describedby': 'hint',
      tabIndex: 0,
      onBlur: 'handler',
      class: 'wide',
      'data-x': '1',
      id: 'terms',
    };
    expect(consumerAttributes(attributes, 'routed')).toEqual({
      'aria-describedby': 'hint',
      tabIndex: 0,
      onBlur: 'handler',
    });
    expect(consumerAttributes(attributes, 'root')).toEqual({
      class: 'wide',
      'data-x': '1',
      id: 'terms',
    });
  });
});

describe('consumerAttributesDeclaration without entries', () => {
  it('gives the root every attribute but the omitted names', () => {
    const javascript = ts.transpileModule(
      `${consumerAttributesDeclaration([])}\nreturn consumerAttributes;`,
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } }
    ).outputText;
    const consumerAttributes = new Function(javascript)() as (
      attributes: object,
      share: string,
      omitted?: readonly string[]
    ) => Record<string, unknown>;
    const attributes = { ariaDescribedby: 'help', id: 'terms', class: 'wide' };
    expect(consumerAttributes(attributes, 'root', ['ariaDescribedby'])).toEqual(
      { id: 'terms', class: 'wide' }
    );
    expect(consumerAttributes(attributes, 'routed')).toEqual({});
  });

  it('matches a camel-case key against a hyphenated name when asked', () => {
    const select = (camelCaseKeys: boolean) =>
      new Function(
        ts.transpileModule(
          `${consumerAttributesDeclaration(['aria-describedby', 'tabindex'], (name) => name, camelCaseKeys)}\nreturn consumerAttributes;`,
          { compilerOptions: { target: ts.ScriptTarget.ES2022 } }
        ).outputText
      )() as (attributes: object, share: string) => Record<string, unknown>;
    const attributes = { ariaDescribedby: 'help', tabIndex: 0, id: 'terms' };
    expect(select(true)(attributes, 'routed')).toEqual({
      ariaDescribedby: 'help',
      tabIndex: 0,
    });
    expect(select(false)(attributes, 'routed')).toEqual({ tabIndex: 0 });
  });
});

describe('routedAttributesDescription', () => {
  it('names what the routed element receives', () => {
    expect(routedAttributesDescription(['aria-*', 'on*', 'required'])).toBe(
      "the consumer's aria-* attributes, event handlers and required"
    );
    expect(routedAttributesDescription(['*'])).toBe(
      "the consumer's attributes other than class, style and data-*"
    );
    expect(routedAttributesDescription(['*', 'data-testid'])).toBe(
      "the consumer's attributes other than class, style and data-* (data-testid included)"
    );
  });
});

describe('routingRootDescription', () => {
  it('names what stays on the root and where the rest goes', () => {
    const routed = (entries: string[]) => ({
      node: { type: 'element', tag: 'input' } as ElementNode,
      tag: 'input',
      entries,
      handlesRef: false,
    });
    expect(routingRootDescription(routed(['*']))).toBe(
      "the consumer's class, style and data-* apply here, the rest on the <input>"
    );
    expect(routingRootDescription(routed(['*', 'data-testid']))).toBe(
      "the consumer's class, style and data-* other than data-testid apply here, the rest on the <input>"
    );
    expect(routingRootDescription(routed(['aria-*', 'required']))).toBe(
      "the consumer's other attributes, class and style apply here, the routed ones on the <input>"
    );
  });
});

describe('routedElementOf', () => {
  it('finds the routed element below the passthrough root', () => {
    const template = checkbox();
    const routed = routedElementOf(template.children);
    expect(routed?.tag).toBe('input');
    expect(routed?.entries).toEqual(ROUTING);
  });

  it('finds none without a passthrough root', () => {
    expect(
      routedElementOf([
        {
          type: 'element',
          tag: 'input',
          passthrough: { attributes: ['aria-*'] },
        },
      ])
    ).toBeUndefined();
  });
});

describe('validateTemplate routing (rule 30)', () => {
  it('accepts a routed element in a conditional, an iteration or a fragment', () => {
    for (const wrap of [
      (node: TemplateNode): TemplateNode => ({
        type: 'conditional',
        conditions: [{ statement: 'if', condition: 'label', children: [node] }],
      }),
      (node: TemplateNode): TemplateNode => ({
        type: 'iteration',
        items: 'options',
        item: 'option',
        children: [node],
      }),
      (node: TemplateNode): TemplateNode => ({
        type: 'fragment',
        children: [node],
      }),
    ]) {
      const template = checkbox();
      const label = template.children[0] as ElementNode;
      label.children = [wrap(label.children![0])];
      expect(errorPath(template)).toBeUndefined();
    }
  });

  it('rejects an empty or missing attribute list', () => {
    expect(errorPath(checkbox({ attributes: [] }))).toBe(
      'children[0].children[0].passthrough.attributes'
    );
    expect(errorPath(checkbox({}))).toBe(
      'children[0].children[0].passthrough.attributes'
    );
  });

  it('rejects a repeated, malformed or reserved entry', () => {
    expect(errorPath(checkbox({ attributes: ['form', 'form'] }))).toBe(
      'children[0].children[0].passthrough.attributes[1]'
    );
    expect(errorPath(checkbox({ attributes: ['data-*'] }))).toBe(
      'children[0].children[0].passthrough.attributes[0]'
    );
    expect(errorPath(checkbox({ attributes: [3] }))).toBe(
      'children[0].children[0].passthrough.attributes[0]'
    );
    for (const name of ['style', 'ref', 'element', 'children', 'key', 'rest']) {
      expect(errorPath(checkbox({ attributes: [name] }))).toBe(
        'children[0].children[0].passthrough.attributes[0]'
      );
    }
  });

  it('skips a declared prop or slot named in the list, as the wildcards do', () => {
    expect(
      errorPath(
        checkbox(
          { attributes: ['name', 'required'] },
          { props: { name: { type: 'string' } } }
        )
      )
    ).toBeUndefined();
    const slotted = checkbox({ attributes: ['hint'] });
    (slotted.children[0] as ElementNode).children!.push({
      type: 'slot',
      name: 'hint',
    });
    expect(errorPath(slotted)).toBeUndefined();
    // The declared prop is the component's: an instance never routes it.
    const template = checkbox(
      { attributes: ['name', 'required'] },
      { props: { label: { type: 'string' }, name: { type: 'string' } } },
      { attributes: { type: 'checkbox', name: { $expression: 'name' } } }
    );
    const { markup } = renderInstance(template, {
      props: { name: 'terms', required: true },
    });
    expect(markup).toContain('<input required type="checkbox" name="terms"');
  });

  it("lets '*', 'aria-*' and 'on*' skip declared names", () => {
    expect(
      errorPath(
        checkbox(
          { attributes: ['*'] },
          {
            props: {
              disabled: { type: 'boolean' },
              onChange: { type: '() => void' },
            },
          }
        )
      )
    ).toBeUndefined();
  });

  it('rejects a routed element with a dynamic tag', () => {
    expect(
      errorPath(
        checkbox(
          undefined,
          {},
          { tag: { $expression: 'tag', default: 'input' } }
        )
      )
    ).toBe('children[0].children[0].tag');
  });

  it('rejects routing below a dynamic root tag or a discriminated surface', () => {
    const dynamic = checkbox();
    (dynamic.children[0] as ElementNode).tag = {
      $expression: 'as',
      default: 'label',
    };
    expect(errorPath(dynamic)).toBe('children[0].children[0].passthrough');
    expect(
      errorPath({
        type: 'component',
        name: 'Field',
        children: [
          {
            type: 'conditional',
            conditions: [
              {
                statement: 'if',
                condition: 'visual',
                props: { visual: { type: 'true', required: true } },
                children: [{ type: 'element', tag: 'div', passthrough: true }],
              },
              {
                statement: 'else',
                props: { visual: { type: 'false' } },
                children: [
                  {
                    type: 'element',
                    tag: 'label',
                    passthrough: true,
                    children: [
                      {
                        type: 'element',
                        tag: 'input',
                        passthrough: { attributes: ['aria-*'] },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      })
    ).toBe('children[0].conditions[1].children[0].children[0].passthrough');
  });

  it("takes 'routed' or 'root' as the handle, and no other value", () => {
    expect(
      errorPath(checkbox({ attributes: ROUTING, handle: 'routed' }))
    ).toBeUndefined();
    expect(
      errorPath(checkbox({ attributes: ROUTING, handle: 'root' }))
    ).toBeUndefined();
    for (const handle of [true, 'input', null]) {
      expect(errorPath(checkbox({ attributes: ROUTING, handle }))).toBe(
        'children[0].children[0].passthrough.handle'
      );
    }
  });

  it('rejects a routed handle inside an iteration', () => {
    const template = checkbox({ attributes: ROUTING, handle: 'routed' });
    const label = template.children[0] as ElementNode;
    label.children = [
      {
        type: 'iteration',
        items: 'options',
        item: 'option',
        children: [label.children![0]],
      },
    ];
    expect(errorPath(template)).toBe(
      'children[0].children[0].children[0].passthrough.handle'
    );
  });

  it('points a routed ref at the handle option', () => {
    expect(() =>
      validateTemplate(checkbox({ attributes: ['ref'] }))
    ).toThrow(/handle: 'routed'/);
  });

  it('reserves the names the routing generates', () => {
    expect(
      errorPath(
        checkbox(undefined, { props: { routedRest: { type: 'string' } } })
      )
    ).toBe('props.routedRest');
    for (const name of ['authoredAndConsumer', 'routedElement']) {
      expect(
        errorPath(checkbox(undefined, { props: { [name]: { type: 'string' } } }))
      ).toBe(`props.${name}`);
    }
  });
});

describe('routing warnings', () => {
  it('warns when a routed id or autofocus repeats in an iteration', () => {
    const template = checkbox({ attributes: ['id', 'aria-*'] });
    const label = template.children[0] as ElementNode;
    label.children = [
      {
        type: 'iteration',
        items: '[1, 2]',
        item: 'option',
        children: [label.children![0]],
      },
    ];
    const extension = {
      key: 'probe',
      kind: 'target',
      render: () => ({ files: [], warnings: [] }),
    };
    const { warnings } = process(template, {
      extensions: [extension as never],
    });
    expect(warnings).toEqual([
      expect.objectContaining({
        nodePath: 'children[0].children[0].children[0].passthrough',
      }),
    ]);
  });
});

describe('renderInstance with a routed element', () => {
  it("splits the consumer's attributes between the root and the routed element", () => {
    const { markup } = renderInstance(checkbox(), {
      props: {
        label: 'Accept',
        id: 'terms',
        'aria-describedby': 'hint',
        required: true,
        tabindex: 0,
        className: 'wide',
        'data-testid': 'terms',
      },
    });
    expect(markup).toContain(
      '<label class="checkbox wide" id="terms" data-testid="terms"'
    );
    expect(markup).toContain(
      '<input aria-describedby="hint" required tabindex="0" type="checkbox"'
    );
  });
});

describe('renderInstance joining a routed id list', () => {
  it("puts the element's ids first, then the consumer's, each once", () => {
    const template = checkbox(undefined, {
      props: { label: { type: 'string' }, hintId: { type: 'string' } },
    }, {
      attributes: {
        type: 'checkbox',
        'aria-describedby': { $expression: 'hintId' },
        'aria-controls': 'menu',
      },
    });
    const { markup } = renderInstance(template, {
      props: {
        hintId: 'hint',
        'aria-describedby': 'help hint',
        'aria-controls': 'other',
      },
    });
    expect(markup).toContain('aria-describedby="hint help"');
    expect(markup).toContain('aria-controls="menu other"');
    // A condition-gated list joins while its condition holds.
    const gated = checkbox(undefined, {
      props: { label: { type: 'string' }, invalid: { type: 'boolean' } },
    }, {
      conditionalAttributes: [
        { condition: 'invalid', attributes: { 'aria-describedby': 'error' } },
      ],
    });
    expect(
      renderInstance(gated, {
        props: { invalid: true, 'aria-describedby': 'help' },
      }).markup
    ).toContain('aria-describedby="error help"');
    expect(
      renderInstance(gated, {
        props: { invalid: false, 'aria-describedby': 'help' },
      }).markup
    ).toContain('aria-describedby="help"');
    // The consumer's ids alone where the element sets none.
    expect(
      renderInstance(template, { props: { 'aria-describedby': 'help' } })
        .markup
    ).toContain('aria-describedby="help"');
  });
});

describe('renderInstance joining a passthrough root id list', () => {
  /** A passthrough button setting id lists, plain or around a routed input. */
  function hintButton(routing?: string[]): ComponentNode {
    return {
      type: 'component',
      name: 'HintButton',
      props: { hintId: { type: 'string' }, expanded: { type: 'boolean' } },
      children: [
        {
          type: 'element',
          tag: 'div',
          passthrough: true,
          attributes: {
            'aria-describedby': { $expression: 'hintId' },
            'aria-controls': 'menu',
            title: 'Hint',
          },
          conditionalAttributes: [
            { condition: 'expanded', attributes: { 'aria-details': 'more' } },
          ],
          children:
            routing === undefined
              ? []
              : [
                  {
                    type: 'element',
                    tag: 'input',
                    passthrough: { attributes: routing },
                  },
                ],
        },
      ],
    };
  }

  it("puts the root's ids first, then the consumer's, each once", () => {
    const consumer = {
      'aria-describedby': 'help hint',
      'aria-controls': 'other',
      'aria-details': 'extra',
      title: 'Consumer',
    };
    const joined = renderInstance(hintButton(), {
      props: { hintId: 'hint', expanded: true, ...consumer },
    }).markup;
    expect(joined).toContain('aria-describedby="hint help"');
    expect(joined).toContain('aria-controls="menu other"');
    expect(joined).toContain('aria-details="more extra"');
    // Another attribute still wins.
    expect(joined).toContain('title="Hint"');
    // An unset value or a false condition leaves the consumer's alone.
    const alone = renderInstance(hintButton(), { props: consumer }).markup;
    expect(alone).toContain('aria-describedby="help hint"');
    expect(alone).toContain('aria-details="extra"');
  });

  it('joins on a routing root only the lists its own share holds', () => {
    const { markup } = renderInstance(hintButton(['aria-describedby']), {
      props: {
        hintId: 'hint',
        'aria-describedby': 'help',
        'aria-controls': 'other',
      },
    });
    // The routed input takes the consumer's aria-describedby; the root keeps
    // its own and joins aria-controls, which stays in its share.
    expect(markup).toContain(
      '<div aria-controls="menu other" aria-describedby="hint"'
    );
    expect(markup).toContain('<input aria-describedby="help"');
  });

  it('leaves out an empty list, as the generated helper does', () => {
    const root = renderInstance(hintButton(), { props: { hintId: '' } }).markup;
    expect(root).not.toContain('aria-describedby');
    expect(root).toContain('aria-controls="menu"');
    // Duplicate tokens collapse on the root without a consumer value too.
    const routed = checkbox(
      undefined,
      { props: { label: { type: 'string' }, hintId: { type: 'string' } } },
      {
        attributes: {
          type: 'checkbox',
          'aria-describedby': { $expression: 'hintId' },
        },
      }
    );
    expect(
      renderInstance(routed, { props: { hintId: '' } }).markup
    ).not.toContain('aria-describedby');
    expect(
      renderInstance(routed, { props: { hintId: 'hint  hint' } }).markup
    ).toContain('aria-describedby="hint"');
  });

  it('names no join for a declared prop or an authored undefined', () => {
    const template = hintButton();
    template.props = {
      ...template.props,
      'aria-controls': { type: 'string' },
    };
    const root = template.children[0] as ElementNode;
    root.attributes = {
      ...root.attributes,
      'aria-owns': undefined,
    };
    const content = process(template).files[0].content;
    expect(content).toContain(
      "the consumer's aria-describedby and aria-details added after the element's own -->"
    );
  });

  it('names the joined lists in the HTML mode root comment', () => {
    expect(process(hintButton()).files[0].content).toContain(
      "<!-- passthrough: the consumer's other attributes, class and style apply here, the consumer's aria-describedby, aria-controls and aria-details added after the element's own -->"
    );
    expect(
      process(hintButton(['aria-describedby'])).files[0].content
    ).toContain(
      "the routed ones on the <input>, the consumer's aria-controls and aria-details added after the element's own -->"
    );
  });
});

describe('HTML mode with a routed element', () => {
  it('names the id lists the routed element joins', () => {
    const { files } = process(
      checkbox(undefined, {}, {
        attributes: { type: 'checkbox', 'aria-describedby': 'hint' },
      })
    );
    expect(files[0].content).toContain(
      ", the consumer's aria-describedby added after the element's own --><input"
    );
  });

  it('comments the routed element with what it receives', () => {
    const { files } = process(checkbox({ attributes: ['aria-*', 'form'] }));
    expect(files[0].content).toContain(
      "<!-- passthrough: the consumer's aria-* attributes and form apply here --><input"
    );
  });

  it("names only class, style and data-* on the root of a '*' routing", () => {
    const { files } = process(checkbox({ attributes: ['*'] }));
    expect(files[0].content).toContain(
      "<!-- passthrough: the consumer's class, style and data-* apply here, the rest on the <input> --><label"
    );
  });
});
