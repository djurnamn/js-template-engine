import type { Template } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import { TemplateError } from '../src/TemplateError';
import {
  validateComponentOverride,
  validateTemplate as validateFor,
  type ValidationOptions,
} from '../src/validate';
import { everyTarget, reactTarget, svelteTarget, vueTarget } from './support/targets';

/**
 * Validates a template for a build of every scripted target (their
 * stand-ins), unless the options name another build.
 */
function validateTemplate(
  template: Template,
  options: ValidationOptions = everyTarget
): void {
  validateFor(template, options);
}

function expectTemplateError(template: unknown, nodePath: string): void {
  let caught: unknown;
  try {
    validateTemplate(template as Template);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(TemplateError);
  expect((caught as TemplateError).nodePath).toBe(nodePath);
}

/** Expects a TemplateError at the path, validating with the options. */
function expectTemplateErrorFor(
  template: unknown,
  options: ValidationOptions,
  nodePath: string
): void {
  let caught: unknown;
  try {
    validateTemplate(template as Template, options);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(TemplateError);
  expect((caught as TemplateError).nodePath).toBe(nodePath);
}

/** Expects one TemplateError reporting each of the given paths, in order. */
function expectTemplateErrors(template: unknown, nodePaths: string[]): void {
  let caught: unknown;
  try {
    validateTemplate(template as Template);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(TemplateError);
  expect(
    (caught as TemplateError).errors?.map((error) => error.nodePath)
  ).toEqual(nodePaths);
}

describe('validateTemplate', () => {
  it('accepts a complete valid template', () => {
    validateTemplate({
      type: 'component',
      name: 'Button',
      children: [
        {
          type: 'element',
          tag: 'button',
          attributes: { class: ['button'], type: 'button' },
          conditionalAttributes: [
            { condition: 'isLarge', attributes: { class: ['button--large'] } },
          ],
          events: [{ name: 'click', handler: 'handleClick' }],
          children: [
            { type: 'text', expression: 'label' },
            {
              type: 'conditional',
              conditions: [
                { statement: 'if', condition: 'a', children: [] },
                { statement: 'else-if', condition: 'b', children: [] },
                { statement: 'else', children: [] },
              ],
            },
            {
              type: 'iteration',
              items: 'props.items',
              item: 'item',
              key: 'item.id',
              children: [{ type: 'slot', fallback: [] }],
            },
          ],
        },
      ],
    });
  });

  it('accepts a component description and rejects one that is not a string', () => {
    validateTemplate({
      type: 'component',
      name: 'Badge',
      description: 'A short label.\n\nSet beside a heading.',
      children: [],
    });
    expectTemplateError(
      { type: 'component', name: 'Badge', description: 42, children: [] },
      'description'
    );
  });

  it('accepts a documented default and rejects one that is not a non-empty string or sits beside a default', () => {
    validateTemplate({
      type: 'component',
      name: 'Callout',
      props: {
        side: { type: "'start' | 'end'", documentedDefault: "'start'" },
        tone: { type: 'string', default: 'neutral' },
      },
      children: [],
    });
    const component = (props: Record<string, unknown>) => ({
      type: 'component',
      name: 'Callout',
      props,
      children: [],
    });
    expectTemplateError(
      component({ side: { type: 'string', default: 'start', documentedDefault: "'start'" } }),
      'props.side'
    );
    expectTemplateError(
      component({ open: { type: 'boolean', documentedDefault: false } }),
      'props.open.documentedDefault'
    );
    expectTemplateError(
      component({ open: { type: 'boolean', documentedDefault: '  ' } }),
      'props.open.documentedDefault'
    );
    expect(() =>
      validateTemplate(
        component({ open: { type: 'boolean', documentedDefault: null } }) as Template
      )
    ).toThrow(/documentedDefault must be a non-empty string.*got null/);
  });

  it('rejects a default that is an expression binding or not a value of a primitive or literal prop type', () => {
    const component = (props: Record<string, unknown>) => ({
      type: 'component',
      name: 'Field',
      props,
      children: [],
    });
    validateTemplate(
      component({
        size: { type: "'sm' | \"md\"", default: 'md' },
        count: { type: 'number | null', default: null },
        step: { type: '1 | 2', default: 2 },
        open: { type: 'boolean', default: false },
        label: { type: 'string | undefined', default: '' },
        rows: { type: 'Row[]', default: [] },
        options: { type: 'Record<string, string>', default: { a: 'b' } },
        value: { type: 'T', default: 'anything' },
      }) as Template
    );
    expect(() =>
      validateTemplate(
        component({
          text: { type: 'string', default: { $expression: 'label' } },
        }) as Template
      )
    ).toThrow(/'text' has an expression binding as its default/);
    expectTemplateError(
      component({ rows: { type: 'Row[]', default: { $expression: 'rows' } } }),
      'props.rows.default'
    );
    expectTemplateError(
      component({ size: { type: "'sm' | 'md'", default: 'lg' } }),
      'props.size.default'
    );
    expectTemplateError(
      component({ open: { type: 'boolean', default: 'false' } }),
      'props.open.default'
    );
    expect(() =>
      validateTemplate(
        component({ count: { type: 'number', default: '3' } }) as Template
      )
    ).toThrow(
      "The prop 'count' has \"3\" as its default, which its type, number, does not admit; give a default of that type"
    );
    expect(() =>
      validateTemplate(
        component({ size: { type: "'sm' | 'md'", default: 'lg' } }) as Template
      )
    ).toThrow(
      "The prop 'size' has \"lg\" as its default, which its type, 'sm' | 'md', does not admit"
    );
    expect(() =>
      validateTemplate(
        component({ size: { type: 'string', default: { a: 1 } } }) as Template
      )
    ).toThrow(
      "The prop 'size' has an object as its default, which its type, string, does not admit"
    );
  });

  it('rejects an imports entry that does not parse, at its path, with the line the parser stopped at', () => {
    const component = (fields: Record<string, unknown>) =>
      ({
        type: 'component',
        name: 'Combobox',
        children: [],
        ...fields,
      }) as Template;
    validateTemplate(
      component({
        imports: [
          "import { useId } from 'react';",
          'export interface Option { value: string }',
          'const Icon = () => <svg aria-hidden="true" />;',
          'const identity = <T,>(value: T): T => value;',
          'function pick<T>(items: T[]): T | undefined { return items[0]; }',
        ],
        extensions: { vue: { imports: ["import { ref } from 'vue';"] } },
      })
    );
    expectTemplateError(
      component({
        imports: [
          'const a = 1;',
          'function remainingOptions(options: string[]) {\n  //',
        ],
      }),
      'imports[1]'
    );
    expect(() =>
      validateTemplate(
        component({ imports: ['function remaining() {\n  //'] })
      )
    ).toThrow(
      "This imports entry does not parse: '}' expected (line 2); every target writes it as it is, so fix the entry"
    );
    expectTemplateError(
      component({ extensions: { react: { imports: ['let x = ;'] } } }),
      'extensions.react.imports[0]'
    );
    expect(() =>
      validateTemplate(
        component({ extensions: { react: { imports: ['let x = ;'] } } })
      )
    ).toThrow(
      'This imports entry does not parse: Expression expected (line 1); the react target writes it as it is, so fix the entry'
    );
  });

  it('checks documented defaults on discriminated branch props and component extension props', () => {
    expectTemplateError(
      {
        type: 'component',
        name: 'Field',
        children: [
          {
            type: 'conditional',
            conditions: [
              {
                statement: 'if',
                condition: 'nonInteractive',
                props: { nonInteractive: { type: 'true', required: true } },
                children: [],
              },
              {
                statement: 'else',
                props: {
                  nonInteractive: { type: 'false', default: false, documentedDefault: 'false' },
                },
                children: [],
              },
            ],
          },
        ],
      },
      'children[0].conditions[1].props.nonInteractive'
    );
    expectTemplateError(
      {
        type: 'component',
        name: 'Field',
        extensions: { react: { props: { size: { type: 'number', documentedDefault: 2 } } } },
        children: [],
      },
      'extensions.react.props.size.documentedDefault'
    );
  });

  it('rejects component nodes below the root', () => {
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'div',
          children: [{ type: 'component', name: 'Nested', children: [] }],
        },
      ],
      '[0].children[0]'
    );
  });

  it('rejects component nodes inside a root node array', () => {
    expectTemplateErrors(
      [
        { type: 'component', name: 'First', children: [] },
        { type: 'component', name: 'Second', children: [] },
      ],
      ['[0]', '[1]']
    );
  });

  it('rejects unknown node types', () => {
    expectTemplateError(
      [{ type: 'element', tag: 'div', children: [{ type: 'portal' }] }],
      '[0].children[0]'
    );
  });

  it('rejects conditionals that do not start with if', () => {
    expectTemplateError(
      [
        {
          type: 'conditional',
          conditions: [{ statement: 'else-if', condition: 'a', children: [] }],
        },
      ],
      '[0].conditions[0]'
    );
  });

  it('rejects else branches before the end', () => {
    expectTemplateError(
      [
        {
          type: 'conditional',
          conditions: [
            { statement: 'if', condition: 'a', children: [] },
            { statement: 'else', children: [] },
            { statement: 'else-if', condition: 'b', children: [] },
          ],
        },
      ],
      '[0].conditions[1]'
    );
  });

  it('rejects empty condition lists', () => {
    expectTemplateError(
      [{ type: 'conditional', conditions: [] }],
      '[0].conditions'
    );
  });

  it('rejects else branches with a condition', () => {
    expectTemplateError(
      [
        {
          type: 'conditional',
          conditions: [
            { statement: 'if', condition: 'a', children: [] },
            { statement: 'else', condition: 'b', children: [] },
          ],
        },
      ],
      '[0].conditions[1]'
    );
  });

  it('rejects if branches without a condition', () => {
    expectTemplateError(
      [{ type: 'conditional', conditions: [{ statement: 'if', children: [] }] }],
      '[0].conditions[0]'
    );
  });

  it('rejects void elements with children', () => {
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'img',
          children: [{ type: 'text', content: 'inside' }],
        },
      ],
      '[0]'
    );
  });

  it('accepts expression bindings on class as sole value and array entries', () => {
    validateTemplate([
      {
        type: 'element',
        tag: 'div',
        attributes: { class: { $expression: 'props.className' } },
      },
      {
        type: 'element',
        tag: 'span',
        attributes: { class: ['badge', { $expression: 'props.extraClasses' }] },
      },
    ]);
  });

  it('accepts expression values on top-level style properties and whole-object styles', () => {
    validateTemplate([
      {
        type: 'element',
        tag: 'span',
        attributes: {
          style: {
            color: 'blue',
            '--badge-size': { $expression: "size + 'rem'" },
          },
        },
      },
      {
        type: 'element',
        tag: 'div',
        attributes: { style: { $expression: 'computeStyleVariables(props)' } },
      },
    ]);
  });

  it('rejects empty class expression entries', () => {
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'div',
          attributes: { class: ['badge', { $expression: '  ' }] },
        },
      ],
      '[0].attributes.class[1]'
    );
  });

  it('accepts a whole-object style expression beside static, nested, and per-property keys', () => {
    validateTemplate([
      {
        type: 'element',
        tag: 'div',
        attributes: {
          style: {
            $expression: 'computeStyleVariables(props)',
            display: 'flex',
            '--gap': { $expression: "gap + 'px'" },
            '@media (max-width: 768px)': { display: 'block' },
          },
        },
      },
    ]);
  });

  it('rejects expression values inside nested selector blocks', () => {
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'div',
          attributes: {
            style: {
              ':hover': { color: { $expression: 'props.hoverColor' } },
            },
          },
        },
      ],
      '[0].attributes.style.:hover.color'
    );
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'div',
          attributes: {
            style: {
              '@media (hover: hover)': {
                ':hover': { color: { $expression: 'props.hoverColor' } },
              },
            },
          },
        },
      ],
      '[0].attributes.style.@media (hover: hover).:hover.color'
    );
  });

  it('accepts $include at the top level and inside nested selector blocks', () => {
    validateTemplate([
      {
        type: 'element',
        tag: 'div',
        attributes: {
          style: {
            $include: "typography('body')",
            ':hover': { $include: ['elevation(1)', 'focus-ring()'] },
            '@media (min-width: 768px)': { $include: 'typography(large)' },
          },
        },
      },
    ]);
  });

  it('rejects an empty $include string', () => {
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'div',
          attributes: { style: { $include: '   ' } },
        },
      ],
      '[0].attributes.style.$include'
    );
  });

  it('rejects an empty entry in a $include array', () => {
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'div',
          attributes: { style: { $include: ['focus-ring()', ''] } },
        },
      ],
      '[0].attributes.style.$include[1]'
    );
  });

  it('accepts @include at-rule keys: true, empty object, and content block', () => {
    validateTemplate([
      {
        type: 'element',
        tag: 'div',
        attributes: {
          style: {
            '@include typography-body': true,
            '@include reset': {},
            '@include hover': { color: 'red', ':hover': { color: 'blue' } },
            ':focus': { '@include focus-ring': true },
          },
        },
      },
    ]);
  });

  it('rejects a non-true, non-object @include value', () => {
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'div',
          attributes: { style: { '@include typography': 'body' } as never },
        },
      ],
      '[0].attributes.style.@include typography'
    );
  });

  it('rejects an $expression inside an @include content block', () => {
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'div',
          attributes: {
            style: {
              '@include box': { color: { $expression: 'props.color' } },
            },
          },
        },
      ],
      '[0].attributes.style.@include box.color'
    );
  });

  it('rejects expression bindings on class inside conditionalAttributes', () => {
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'div',
          conditionalAttributes: [
            {
              condition: 'isActive',
              attributes: { class: [{ $expression: 'props.className' }] },
            },
          ],
        },
      ],
      '[0].conditionalAttributes[0].attributes.class[0]'
    );
  });

  it('rejects expression bindings on style inside conditionalAttributes', () => {
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'div',
          conditionalAttributes: [
            {
              condition: 'isActive',
              attributes: {
                class: 'is-active',
                style: { $expression: 'props.style' },
              },
            },
          ],
        },
      ],
      '[0].conditionalAttributes[0].attributes.style'
    );
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'div',
          conditionalAttributes: [
            {
              condition: 'isActive',
              attributes: {
                class: 'is-active',
                style: { color: { $expression: 'props.color' } },
              },
            },
          ],
        },
      ],
      '[0].conditionalAttributes[0].attributes.style.color'
    );
  });

  it('accepts a $spread expression binding and an array of them', () => {
    validateTemplate([
      {
        type: 'element',
        tag: 'div',
        attributes: {
          $spread: { $expression: 'backdropProps' },
          class: ['overlay'],
        },
      },
      {
        type: 'element',
        tag: 'div',
        attributes: {
          $spread: [{ $expression: 'rootProps' }, { $expression: 'stateProps' }],
        },
      },
    ]);
  });

  it('rejects a static $spread value', () => {
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'div',
          attributes: { $spread: 'notAnExpression' },
        },
      ],
      '[0].attributes.$spread'
    );
  });

  it('rejects a static value inside a $spread array', () => {
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'div',
          attributes: {
            $spread: [{ $expression: 'rootProps' }, 'oops'],
          },
        },
      ],
      '[0].attributes.$spread[1]'
    );
  });

  it('rejects an empty $spread array', () => {
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'div',
          attributes: { $spread: [] },
        },
      ],
      '[0].attributes.$spread'
    );
  });

  it('rejects $spread inside conditionalAttributes', () => {
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'div',
          conditionalAttributes: [
            {
              condition: 'isActive',
              attributes: { $spread: { $expression: 'props.extra' } },
            },
          ],
        },
      ],
      '[0].conditionalAttributes[0].attributes.$spread'
    );
  });

  it('accepts a single key modifier per event definition', () => {
    validateTemplate([
      {
        type: 'element',
        tag: 'input',
        events: [
          { name: 'keyup', handler: 'submitSearch', modifiers: ['enter'] },
          {
            name: 'keydown',
            handler: 'highlightNext',
            modifiers: ['prevent', 'arrow-down'],
          },
        ],
      },
    ]);
  });

  it('rejects multiple key modifiers on one event definition', () => {
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'input',
          events: [
            {
              name: 'keydown',
              handler: 'moveFocus',
              modifiers: ['arrow-up', 'arrow-down'],
            },
          ],
        },
      ],
      '[0].events[0].modifiers'
    );
  });

  it('rejects an event modifier outside the supported set, listing the set', () => {
    const template = [
      {
        type: 'element',
        tag: 'div',
        events: [
          { name: 'keydown', handler: 'go', modifiers: ['prevent', 'home'] },
        ],
      },
    ];
    expectTemplateError(template, '[0].events[0].modifiers[1]');
    expect(() => validateTemplate(template as Template)).toThrowError(
      'Unknown event modifier "home"; the supported modifiers are prevent, stop, once, self, capture, passive, enter, escape, tab, space, backspace, delete, arrow-up, arrow-down, arrow-left, arrow-right'
    );
  });

  it('rejects an unknown modifier in an extension override event', () => {
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'div',
          extensions: {
            react: {
              events: [
                { name: 'click', handler: 'go', modifiers: ['toString'] },
              ],
            },
          },
        },
      ],
      '[0].extensions.react.events[0].modifiers[0]'
    );
  });

  it('rejects a conditionalAttributes style without a class in its entry', () => {
    const template = [
      {
        type: 'element',
        tag: 'div',
        conditionalAttributes: [
          {
            condition: 'on',
            attributes: { style: { 'background-color': 'red' } },
          },
        ],
      },
    ];
    expectTemplateError(template, '[0].conditionalAttributes[0].attributes');
    expect(() => validateTemplate(template as Template)).toThrowError(
      'A conditionalAttributes style needs a class in the same entry'
    );
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'div',
          conditionalAttributes: [
            {
              condition: 'on',
              attributes: { class: [], style: { color: 'red' } },
            },
          ],
        },
      ],
      '[0].conditionalAttributes[0].attributes'
    );
    validateTemplate([
      {
        type: 'element',
        tag: 'div',
        conditionalAttributes: [
          {
            condition: 'on',
            attributes: { class: 'is-on', style: { color: 'red' } },
          },
          { condition: 'off', attributes: { title: 'Off', style: {} } },
        ],
      },
    ]);
  });

  it('rejects a non-array modifiers value', () => {
    const template = [
      {
        type: 'element',
        tag: 'div',
        events: [{ name: 'click', handler: 'go', modifiers: 'prevent' }],
      },
    ];
    expectTemplateError(template, '[0].events[0].modifiers');
    expect(() =>
      validateTemplate(template as unknown as Template)
    ).toThrowError('`modifiers` must be an array');
  });

  it('rejects filling a default slot through slots, pointing to the children', () => {
    const template = [
      {
        type: 'element',
        tag: 'Card',
        slots: { default: [{ type: 'text', content: 'Body' }] },
      },
    ];
    expectTemplateError(template, '[0].slots.default');
    expect(() => validateTemplate(template as Template)).toThrowError(
      "project the default slot through the element's children"
    );
  });

  it('rejects a slot named default, pointing to the default slot', () => {
    const template = [{ type: 'slot', name: 'default' }];
    expectTemplateError(template, '[0].name');
    expect(() => validateTemplate(template as Template)).toThrowError(
      "A slot cannot be named 'default'; omit 'name' for the default slot"
    );
  });

  it('accepts scopeRequired on a slot that exposes values', () => {
    expect(() =>
      validateTemplate([
        {
          type: 'slot',
          name: 'trigger',
          exposes: { triggerProps: 'api.getTriggerProps()' },
          scopeRequired: true,
        },
        { type: 'slot', name: 'icon', scopeRequired: false },
      ])
    ).not.toThrow();
  });

  it('rejects scopeRequired on a slot that exposes nothing', () => {
    const template = [
      { type: 'slot', name: 'trigger', scopeRequired: true },
      { type: 'slot', name: 'actions', exposes: {}, scopeRequired: true },
    ];
    expectTemplateErrors(template, [
      '[0].scopeRequired',
      '[1].scopeRequired',
    ]);
    expect(() => validateTemplate(template as Template)).toThrowError(
      "'scopeRequired' needs a scope to require: give the slot 'exposes', or drop 'scopeRequired'"
    );
  });

  it('reports only its own error for a malformed exposes beside scopeRequired', () => {
    expectTemplateError(
      [{ type: 'slot', exposes: ['api'], scopeRequired: true }],
      '[0].exposes'
    );
  });

  it('rejects a slot repeated with other names, a retyped binding or another scopeRequired', () => {
    const trigger = {
      type: 'slot',
      name: 'trigger',
      exposes: { triggerProps: 'triggerProps' },
      scopeRequired: true,
    };
    const template = [
      trigger,
      { ...trigger, exposes: { closeProps: 'triggerProps' } },
      { ...trigger, scopeRequired: false },
      { type: 'slot', exposes: { api: { value: 'api', type: 'Api' } } },
      { type: 'slot', exposes: { api: { value: 'api', type: 'Other' } } },
    ];
    expectTemplateErrors(template, [
      '[1].exposes',
      '[2].scopeRequired',
      '[4].exposes.api.type',
    ]);
    expect(() => validateTemplate(template as Template)).toThrowError(
      "The slot 'trigger' exposes other bindings here than at [0]; every place a slot renders exposes the same names"
    );
  });

  it('accepts a slot repeated with its names in another order, its own expressions and a type given once', () => {
    expect(() =>
      validateTemplate([
        { type: 'slot', name: 'pair', exposes: { a: 'a', b: 'b' } },
        { type: 'slot', name: 'pair', exposes: { b: 'other.b', a: { value: 'other.a', type: 'string' } } },
        {
          type: 'iteration',
          items: 'items',
          item: 'item',
          children: [{ type: 'slot', name: 'row', exposes: { item: 'item' } }],
        },
        {
          type: 'iteration',
          items: 'rows',
          item: 'row',
          children: [{ type: 'slot', name: 'row', exposes: { item: 'row' } }],
        },
      ] as Template)
    ).not.toThrow();
  });

  it('accepts a slot repeated alike, in conditional branches', () => {
    const trigger = {
      type: 'slot',
      name: 'trigger',
      exposes: { triggerProps: 'triggerProps' },
      scopeRequired: true,
    };
    expect(() =>
      validateTemplate([
        {
          type: 'conditional',
          conditions: [
            { statement: 'if', condition: 'open', children: [trigger] },
            { statement: 'else', children: [{ ...trigger }] },
          ],
        },
      ] as Template)
    ).not.toThrow();
  });

  it('rejects a scopeRequired that is not a boolean', () => {
    expectTemplateError(
      [
        {
          type: 'slot',
          exposes: { api: 'api' },
          scopeRequired: 'yes',
        },
      ],
      '[0].scopeRequired'
    );
  });

  it('rejects empty expressions', () => {
    expectTemplateError(
      [{ type: 'text', expression: '   ' }],
      '[0].expression'
    );
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'img',
          attributes: { src: { $expression: '' } },
        },
      ],
      '[0].attributes.src'
    );
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'button',
          events: [{ name: 'click', handler: '' }],
        },
      ],
      '[0].events[0].handler'
    );
  });

  it('rejects slot nodes inside slot fallbacks', () => {
    expectTemplateError(
      [
        {
          type: 'slot',
          fallback: [
            {
              type: 'element',
              tag: 'div',
              children: [{ type: 'slot' }],
            },
          ],
        },
      ],
      '[0].fallback[0].children[0]'
    );
  });

  it('rejects text nodes with both content and expression', () => {
    expectTemplateError(
      [{ type: 'text', content: 'Hello', expression: 'user.name' }],
      '[0]'
    );
  });

  it('rejects text nodes with neither content nor expression', () => {
    expectTemplateError([{ type: 'text' }], '[0]');
  });

  describe('passthrough surface contract', () => {
    it('accepts a single passthrough root with an intrinsic tag', () => {
      validateTemplate({
        type: 'component',
        name: 'Badge',
        props: { variant: { type: 'string' } },
        children: [
          {
            type: 'element',
            tag: 'span',
            passthrough: true,
            attributes: { class: ['badge'] },
            children: [{ type: 'slot' }],
          },
        ],
      });
    });

    it('accepts a passthrough root alongside leading comments', () => {
      validateTemplate([
        { type: 'comment', content: 'surface root' },
        { type: 'element', tag: 'div', passthrough: true },
      ]);
    });

    it('rejects a second passthrough element', () => {
      expectTemplateError(
        [
          {
            type: 'element',
            tag: 'div',
            passthrough: true,
            children: [{ type: 'element', tag: 'span', passthrough: true }],
          },
        ],
        '[0].children[0]'
      );
    });

    it('rejects a passthrough element that is not the single root', () => {
      expectTemplateError(
        [
          { type: 'element', tag: 'div' },
          { type: 'element', tag: 'span', passthrough: true },
        ],
        '[1]'
      );
    });

    it('rejects a nested passthrough element', () => {
      expectTemplateError(
        [
          {
            type: 'element',
            tag: 'div',
            children: [{ type: 'element', tag: 'span', passthrough: true }],
          },
        ],
        '[0].children[0]'
      );
    });

    it('rejects a passthrough on a component-reference tag', () => {
      expectTemplateError(
        [{ type: 'element', tag: 'UserAvatar', passthrough: true }],
        '[0]'
      );
    });

    it('rejects a reserved prop on a passthrough component', () => {
      expectTemplateError(
        {
          type: 'component',
          name: 'Badge',
          props: { className: { type: 'string' } },
          children: [{ type: 'element', tag: 'span', passthrough: true }],
        },
        'children[0]'
      );
    });

    it('rejects a reserved slot name on a passthrough component', () => {
      expectTemplateError(
        [
          {
            type: 'element',
            tag: 'span',
            passthrough: true,
            children: [{ type: 'slot', name: 'style' }],
          },
        ],
        '[0]'
      );
    });
  });

  describe('dynamic tag', () => {
    it('accepts a dynamic tag on the single root element', () => {
      validateTemplate({
        type: 'component',
        name: 'Box',
        props: { as: { type: "'div' | 'section'", default: 'div' } },
        children: [
          {
            type: 'element',
            tag: { $expression: 'as', default: 'div' },
            attributes: { class: ['box'] },
          },
        ],
      });
    });

    it('accepts a dynamic tag layered onto a passthrough root', () => {
      validateTemplate([
        {
          type: 'element',
          tag: { $expression: 'as', default: 'button' },
          passthrough: true,
        },
      ]);
    });

    it('accepts a string-valued dynamic tag on a nested element and beside other roots', () => {
      validateTemplate([
        {
          type: 'element',
          tag: 'div',
          children: [
            { type: 'element', tag: { $expression: 'as', default: 'span' } },
          ],
        },
      ]);
      validateTemplate([
        { type: 'element', tag: { $expression: 'as', default: 'div' } },
        { type: 'element', tag: 'span' },
      ]);
    });

    it('rejects a component-valued dynamic tag below the root', () => {
      expectTemplateError(
        [
          {
            type: 'element',
            tag: 'div',
            children: [
              {
                type: 'element',
                tag: { $expression: 'as', default: 'span', componentValued: true },
              },
            ],
          },
        ],
        '[0].children[0]'
      );
    });

    it('rejects a component-valued dynamic tag when the root is not the single rendered element', () => {
      expectTemplateError(
        [
          {
            type: 'element',
            tag: { $expression: 'as', default: 'div', componentValued: true },
          },
          { type: 'element', tag: 'span' },
        ],
        '[0]'
      );
    });

    it("rejects a void 'default' with children (rule 5 against the default)", () => {
      expectTemplateError(
        [
          {
            type: 'element',
            tag: { $expression: 'as', default: 'img' },
            children: [{ type: 'text', content: 'x' }],
          },
        ],
        '[0]'
      );
    });

    it("rejects a missing 'default'", () => {
      expectTemplateError(
        [{ type: 'element', tag: { $expression: 'as' } }],
        '[0].tag.default'
      );
    });

    it("rejects an empty 'default'", () => {
      expectTemplateError(
        [{ type: 'element', tag: { $expression: 'as', default: '  ' } }],
        '[0].tag.default'
      );
    });

    it('rejects an empty dynamic-tag expression', () => {
      expectTemplateError(
        [{ type: 'element', tag: { $expression: '', default: 'div' } }],
        '[0].tag.$expression'
      );
    });

    it("rejects a passthrough root whose dynamic 'default' is a component reference", () => {
      expectTemplateError(
        [
          {
            type: 'element',
            tag: { $expression: 'as', default: 'CustomBox' },
            passthrough: true,
          },
        ],
        '[0]'
      );
    });
  });

  describe('generated binding names', () => {
    const component = (fields: Record<string, unknown>): unknown => ({
      type: 'component',
      name: 'Box',
      children: [{ type: 'element', tag: 'div' }],
      ...fields,
    });

    it('rejects a prop named after a binding a target declares itself', () => {
      for (const name of [
        'bem',
        'props',
        'componentStyles',
        'definedProperties',
        'authoredOrConsumer',
        'composeEventHandlers',
        'unlessDefaultPrevented',
        'usedOnceListeners',
        'claimOnceListener',
        'serializeStyleObject',
        'restProperties',
        'RootTag',
        'Tag2',
      ]) {
        expectTemplateError(
          component({ props: { [name]: { type: 'string' } } }),
          `props.${name}`
        );
      }
    });

    it('names the clash in the error', () => {
      expect(() =>
        validateTemplate(
          component({ props: { bem: { type: 'string' } } }) as Template
        )
      ).toThrowError(
        "The prop 'bem' takes the name of the BEM runtime the scripted targets set up, which the generated component declares itself; rename the prop"
      );
    });

    it('reserves a target\'s names only in builds that include the target', () => {
      const useAttrs = component({ props: { useAttrs: { type: 'string' } } });
      expectTemplateError(useAttrs, 'props.useAttrs');
      expect(() =>
        validateTemplate(useAttrs as Template, { extensions: [reactTarget] })
      ).not.toThrow();
      expect(() => validateTemplate(useAttrs as Template, {})).not.toThrow();
      // The engine's own names are reserved in every build.
      expect(() =>
        validateTemplate(
          component({ props: { bem: { type: 'string' } } }) as Template,
          {}
        )
      ).toThrowError("The prop 'bem' takes the name of the BEM runtime");
    });

    it("rejects an override's prop, a branch prop, a slot and a binding", () => {
      expectTemplateError(
        component({
          extensions: { react: { props: { props: { type: 'string' } } } },
        }),
        'extensions.react.props.props'
      );
      expectTemplateError(
        {
          type: 'component',
          name: 'Field',
          children: [
            {
              type: 'conditional',
              conditions: [
                {
                  statement: 'if',
                  condition: 'visual',
                  props: {
                    visual: { type: 'true' },
                    componentStyles: { type: 'string' },
                  },
                  children: [
                    { type: 'element', tag: 'div', passthrough: true },
                  ],
                },
                {
                  statement: 'else',
                  props: { visual: { type: 'false' } },
                  children: [
                    { type: 'element', tag: 'input', passthrough: true },
                  ],
                },
              ],
            },
          ],
        },
        'children[0].conditions[0].props.componentStyles'
      );
      expectTemplateError(
        component({
          children: [
            {
              type: 'element',
              tag: 'div',
              children: [{ type: 'slot', name: 'compose-event-handlers' }],
            },
          ],
        }),
        'children[0].children[0]'
      );
      expectTemplateError(
        [
          {
            type: 'iteration',
            items: 'rows',
            item: 'row',
            index: 'Tag',
            children: [],
          },
        ],
        '[0].index'
      );
    });

    it('reserves on and once only where an event uses passive or once', () => {
      expect(() =>
        validateTemplate(
          component({
            props: { on: { type: 'boolean' }, once: { type: 'boolean' } },
          }) as Template
        )
      ).not.toThrow();
      expectTemplateError(
        component({
          props: { once: { type: 'boolean' } },
          children: [
            {
              type: 'element',
              tag: 'div',
              extensions: {
                svelte: {
                  events: [
                    { name: 'click', handler: 'run', modifiers: ['once'] },
                  ],
                },
              },
            },
          ],
        }),
        'props.once'
      );
    });

    it('rejects rest on a passthrough component and accepts it elsewhere', () => {
      expectTemplateError(
        component({
          props: { rest: { type: 'boolean' } },
          children: [{ type: 'element', tag: 'div', passthrough: true }],
        }),
        'props.rest'
      );
      expect(() =>
        validateTemplate(
          component({ props: { rest: { type: 'boolean' } } }) as Template
        )
      ).not.toThrow();
    });
  });
});

describe('validateTemplate reports every violation', () => {
  it('lists each unknown event modifier in one error', () => {
    let caught: unknown;
    try {
      validateTemplate({
        type: 'component',
        name: 'TabList',
        props: { go: { type: '() => void' } },
        children: [
          {
            type: 'element',
            tag: 'div',
            events: [
              { name: 'keydown', handler: 'go', modifiers: ['home', 'end'] },
            ],
          },
          {
            type: 'element',
            tag: 'div',
            events: [{ name: 'click', handler: 'go', modifiers: ['twice'] }],
          },
        ],
      } as unknown as Template);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(TemplateError);
    const error = caught as TemplateError;
    expect(error.nodePath).toBe('');
    expect(error.errors?.map((detail) => detail.nodePath)).toEqual([
      'children[0].events[0].modifiers[0]',
      'children[0].events[0].modifiers[1]',
      'children[1].events[0].modifiers[0]',
    ]);
    expect(error.message.split('\n')).toEqual([
      '3 validation errors:',
      ...error.errors!.map(
        (detail) => `  ${detail.message} (at ${detail.nodePath})`
      ),
    ]);
    expect(error.errors?.[0].message).toMatch(/^Unknown event modifier "home"/);
  });

  it('lists each conditional style without a class', () => {
    expectTemplateErrors(
      [
        {
          type: 'element',
          tag: 'div',
          conditionalAttributes: [
            { condition: 'open', attributes: { style: { color: 'red' } } },
            { condition: 'closed', attributes: { style: { color: 'blue' } } },
          ],
        },
      ],
      [
        '[0].conditionalAttributes[0].attributes',
        '[0].conditionalAttributes[1].attributes',
      ]
    );
  });

  it('reports node and cross-node violations together, in template order', () => {
    expectTemplateErrors(
      {
        type: 'component',
        name: 'Mixed',
        props: { bem: { type: 'string' } },
        children: [
          { type: 'text' },
          {
            type: 'element',
            tag: 'input',
            children: [{ type: 'text', content: 'x' }],
          },
        ],
      },
      ['children[0]', 'children[1]', 'props.bem']
    );
  });

  it('throws a single violation as it is', () => {
    expectTemplateError(
      [
        {
          type: 'element',
          tag: 'img',
          children: [{ type: 'comment', content: 'x' }],
        },
      ],
      '[0]'
    );
  });

  it("reports a malformed field beside the node's other violations", () => {
    expectTemplateErrors(
      [
        {
          type: 'element',
          tag: 'div',
          attributes: { title: { $expression: '' } },
          conditionalAttributes: {},
        },
      ],
      ['[0].conditionalAttributes', '[0].attributes.title']
    );
    expectTemplateErrors(
      [
        {
          type: 'conditional',
          conditions: [{ statement: 'elseif', condition: 'x' }],
        },
      ],
      ['[0].conditions[0].statement', '[0].conditions[0].children']
    );
  });

  it('reports a malformed shape with its path instead of crashing', () => {
    expectTemplateError(
      [{ type: 'element', tag: 'div', conditionalAttributes: {} }],
      '[0].conditionalAttributes'
    );
  });

  it('reports a node walk that cannot read a malformed node as that node only', () => {
    expectTemplateErrors(
      [{ type: 'element', tag: 'div', children: [null] }, { type: 'text' }],
      ['[0].children[0]', '[1]']
    );
  });
});

describe('validateTemplate prop definitions and component overrides', () => {
  const component = (fields: Record<string, unknown>): unknown => ({
    type: 'component',
    name: 'Disclosure',
    children: [],
    ...fields,
  });

  it('rejects a null or false prop definition in an override, naming its path', () => {
    expectTemplateErrors(
      component({
        extensions: { vue: { props: { open: null, label: false } } },
      }),
      ['extensions.vue.props.open', 'extensions.vue.props.label']
    );
  });

  it('rejects a prop definition without a string type', () => {
    expectTemplateError(
      component({ props: { open: { required: true } } }),
      'props.open.type'
    );
    expectTemplateError(
      component({ props: { open: 'boolean' } }),
      'props.open'
    );
  });

  it('rejects a malformed override props record and override', () => {
    expectTemplateError(
      component({ extensions: { vue: { props: ['open'] } } }),
      'extensions.vue.props'
    );
    expectTemplateError(
      component({ extensions: { svelte: null } }),
      'extensions.svelte'
    );
  });

  it('rejects malformed shared override fields', () => {
    expectTemplateErrors(
      component({
        extensions: {
          react: {
            imports: "import x from 'x';",
            script: ['const a = 1;'],
            propsStrategy: 'append',
          },
          vue: { imports: ['ok', 3] },
        },
      }),
      [
        'extensions.react.script',
        'extensions.react.imports',
        'extensions.react.propsStrategy',
        'extensions.vue.imports[1]',
      ]
    );
  });

  it('accepts well-formed overrides, and leaves other override keys to processing', () => {
    expect(() =>
      validateTemplate(
        component({
          props: { open: { type: 'boolean' } },
          extensions: {
            vue: {
              props: { open: { type: 'boolean', required: true } },
              propsStrategy: 'replace',
              imports: ["import { ref } from 'vue';"],
              script: 'const local = ref(0);',
              scoped: true,
              omitProps: ['open'],
            },
          },
        }) as Template
      )
    ).not.toThrow();
  });
});

describe('validateTemplate two-way props', () => {
  const toggle = (
    props: Record<string, unknown>,
    extra: Record<string, unknown> = {}
  ): unknown => ({
    type: 'component',
    name: 'Toggle',
    props,
    children: [{ type: 'element', tag: 'button' }],
    ...extra,
  });
  const pressed = (bindable: Record<string, unknown>, extra = {}) => ({
    type: 'boolean',
    bindable: { current: 'isPressed', setter: 'setPressed', ...bindable },
    ...extra,
  });

  it('accepts a well-formed binding with its default and change props', () => {
    expect(() =>
      validateTemplate(
        toggle({
          pressed: pressed({
            defaultProp: 'defaultPressed',
            changeProp: 'onPressedChange',
          }),
          defaultPressed: { type: 'boolean', default: false },
          onPressedChange: { type: '(pressed: boolean) => void' },
        }) as Template
      )
    ).not.toThrow();
  });

  it('rejects a malformed bindable, current or setter', () => {
    expectTemplateError(toggle({ pressed: { type: 'boolean', bindable: 'yes' } }), 'props.pressed.bindable');
    expectTemplateError(toggle({ pressed: pressed({ current: 'is-pressed' }) }), 'props.pressed.bindable.current');
    expectTemplateError(toggle({ pressed: pressed({ setter: 'class' }) }), 'props.pressed.bindable.setter');
    expectTemplateError(toggle({ pressed: pressed({ setter: 'isPressed' }) }), 'props.pressed.bindable.setter');
    expectTemplateError(toggle({ pressed: pressed({ defaultProp: '' }) }), 'props.pressed.bindable.defaultProp');
  });

  it('rejects a binding outside the shared props, on a required prop or on a function', () => {
    expectTemplateError(
      toggle({}, { extensions: { vue: { props: { pressed: pressed({}) } } } }),
      'extensions.vue.props.pressed.bindable'
    );
    expectTemplateError(toggle({ pressed: pressed({}, { required: true }) }), 'props.pressed.required');
    expectTemplateError(
      toggle({ format: { type: '(value: number) => string', bindable: { current: 'formatter', setter: 'setFormat' } } }),
      'props.format.type'
    );
  });

  it('rejects default and change props of the wrong kind', () => {
    expectTemplateError(
      toggle({ pressed: pressed({ defaultProp: 'pressed' }) }),
      'props.pressed.bindable.defaultProp'
    );
    expectTemplateError(
      toggle({
        pressed: pressed({ defaultProp: 'onPressedChange' }),
        onPressedChange: { type: '(pressed: boolean) => void' },
      }),
      'props.pressed.bindable.defaultProp'
    );
    expectTemplateError(
      toggle({
        pressed: pressed({ changeProp: 'format' }),
        format: { type: '(pressed: boolean) => string' },
      }),
      'props.pressed.bindable.changeProp'
    );
    expectTemplateError(
      toggle({
        pressed: pressed({ defaultProp: 'defaultPressed' }, { default: true }),
        defaultPressed: { type: 'boolean' },
      }),
      'props.pressed.default'
    );
    expectTemplateError(
      toggle({
        pressed: pressed({ changeProp: 'onChange' }),
        open: { type: 'boolean', bindable: { current: 'isOpen', setter: 'setOpen', changeProp: 'onChange' } },
        onChange: { type: '(value: boolean) => void' },
      }),
      'props.open.bindable.changeProp'
    );
  });

  it('rejects a generated name that a prop, slot, binding or another binding takes', () => {
    expectTemplateError(toggle({ pressed: pressed({}), ownPressed: { type: 'boolean' } }), 'props.ownPressed');
    expectTemplateError(toggle({ pressed: pressed({}), emit: { type: 'string' } }), 'props.emit');
    expectTemplateError(
      toggle({ pressed: pressed({}) }, { children: [{ type: 'slot', name: 'is-pressed' }] }),
      'children[0]'
    );
    expectTemplateError(
      toggle(
        { pressed: pressed({}) },
        { children: [{ type: 'iteration', items: 'list', item: 'setPressed', children: [] }] }
      ),
      'children[0].item'
    );
    expectTemplateError(
      toggle({ pressed: pressed({}), open: { type: 'boolean', bindable: { current: 'isPressed', setter: 'setOpen' } } }),
      'props.open.bindable.current'
    );
    expectTemplateError(toggle({ pressed: pressed({ current: 'bem' }) }), 'props.pressed.bindable.current');
    // The own copy of a prop read by its alias is named after the alias.
    expectTemplateError(
      toggle({ 'aria-pressed': pressed({}), ownAriaPressed: { type: 'boolean' } }),
      'props.ownAriaPressed'
    );
    // An alias steers clear of the generated names instead.
    expect(() =>
      validateTemplate(
        toggle({ pressed: pressed({ current: 'ariaPressed' }), 'aria-pressed': { type: 'boolean' } }) as Template
      )
    ).not.toThrow();
  });

  it("reports each clash between two two-way props' generated names", () => {
    let caught: unknown;
    try {
      validateTemplate(
        toggle({
          x: { type: 'boolean', bindable: { current: 'isX', setter: 'setX' } },
          X: { type: 'boolean', bindable: { current: 'isBigX', setter: 'setBigX' } },
        }) as Template
      );
    } catch (error) {
      caught = error;
    }
    expect(
      (caught as TemplateError).errors?.map(({ message }) => message.split(' is ')[0])
    ).toEqual(["The name 'ownX'", "The name 'setOwnX'", "The name 'latestX'"]);
  });

  it('reserves the names of the targets named beside the build', () => {
    const template = toggle({ pressed: pressed({}), useAttrs: { type: 'string' } }) as Template;
    expect(() => validateTemplate(template, { extensions: [reactTarget] })).not.toThrow();
    expectTemplateErrorFor(template, { extensions: [reactTarget], reserveNamesOf: [vueTarget] }, 'props.useAttrs');
    // Only their names: a stand-in's override blocks stay unread.
    expect(() =>
      validateTemplate(
        toggle({}, { extensions: { svelte: { runes: { script: 42 } } } }) as Template,
        { reserveNamesOf: [svelteTarget] }
      )
    ).not.toThrow();
  });

  it('rejects a script declaring a generated name', () => {
    expectTemplateError(
      toggle({ pressed: pressed({}) }, { script: 'const [isPressed, setIsPressed] = useState(false);' }),
      'script'
    );
    expectTemplateError(
      toggle({ pressed: pressed({}) }, { extensions: { vue: { script: "const emit = defineEmits<{ close: [] }>();" } } }),
      'extensions.vue.script'
    );
    expectTemplateError(
      toggle({ pressed: pressed({}) }, { extensions: { svelte: { script: '$: isPressed = pressed ?? false;' } } }),
      'extensions.svelte.script'
    );
    // Reading and calling the generated names is what a script does with them.
    expect(() =>
      validateTemplate(
        toggle({ pressed: pressed({}) }, { script: 'function toggle() {\n  setPressed((pressed) => !pressed);\n}' }) as Template
      )
    ).not.toThrow();
    // A renamed destructuring key declares its target, and a function's own
    // declaration shadows the generated name only inside that function.
    for (const script of [
      'const { isPressed: wasPressed = false } = {};',
      'function reset() {\n  let isPressed = false;\n  isPressed = true;\n  return isPressed;\n}',
      'const flip = () => { const setPressed = 1; return setPressed; };',
    ]) {
      expect(() =>
        validateTemplate(toggle({ pressed: pressed({}) }, { script }) as Template)
      ).not.toThrow();
    }
  });

  it('rejects a write to the two-way value in the shared script or a target override', () => {
    for (const script of [
      'function on() { isPressed = true; }',
      'function flip() { isPressed ||= true; }',
      'const bump = () => isPressed += 1;',
      'function next() { isPressed++; }',
      'function previous() { --isPressed; }',
      'const half = (a: number) => { a-- / 2 + isPressed++; };',
      'const after = (b: number) => b + ++isPressed;',
    ]) {
      let caught: unknown;
      try {
        validateTemplate(toggle({ pressed: pressed({}) }, { script }) as Template);
      } catch (error) {
        caught = error;
      }
      expect((caught as TemplateError).message).toContain(
        "'isPressed' is the two-way value; write it through 'setPressed'"
      );
      expect((caught as TemplateError).nodePath).toBe('script');
    }
    expectTemplateError(
      toggle({ pressed: pressed({}) }, { extensions: { react: { script: 'function on() { isPressed = true; }' } } }),
      'extensions.react.script'
    );
    expectTemplateError(
      toggle({ pressed: pressed({}) }, { extensions: { svelte: { runes: { script: 'function on() { isPressed = true; }' } } } }),
      'extensions.svelte.runes.script'
    );
  });

  it('reads a comparison, a member write, a parameter and a type query as no write', () => {
    const script = [
      'const same = isPressed == true || isPressed === false || isPressed <= 1 || isPressed >= 0 || isPressed != null;',
      'function keep(state: { isPressed: boolean }) { state.isPressed = true; }',
      'function local(isPressed: boolean) { isPressed = !isPressed; return isPressed; }',
      'let snapshot: typeof isPressed = isPressed;',
      'const toggle = () => setPressed(!isPressed);',
      'class Box { #isPressed = 1; reset() { this.#isPressed = 0; } }',
      'const sum = (b: number) => b+++isPressed;',
    ].join('\n');
    expect(() => validateTemplate(toggle({ pressed: pressed({}) }, { script }) as Template)).not.toThrow();
  });

  it('rejects a $-prefixed name, a type admitting a function, and the surface locals', () => {
    expectTemplateError(toggle({ pressed: pressed({ current: '$pressed' }) }), 'props.pressed.bindable.current');
    expectTemplateError(
      toggle({ value: { type: 'string | ((value: string) => void)', bindable: { current: 'current', setter: 'setValue' } } }),
      'props.value.type'
    );
    expectTemplateError(
      toggle({ pressed: pressed({ current: 'rest' }) }, { rest: { tag: 'button' } }),
      'props.pressed.bindable.current'
    );
    expectTemplateError(
      toggle(
        { pressed: pressed({ setter: 'style' }) },
        { children: [{ type: 'element', tag: 'button', passthrough: true }] }
      ),
      'props.pressed.bindable.setter'
    );
    // Without a passthrough root or rest, the names are free.
    expect(() => validateTemplate(toggle({ pressed: pressed({ current: 'style' }) }) as Template)).not.toThrow();
  });

  it('scans the override blocks a target of the build declares', () => {
    expectTemplateError(
      toggle({ pressed: pressed({}) }, { extensions: { svelte: { runes: { script: 'let isPressed = $state(false);' } } } }),
      'extensions.svelte.runes.script'
    );
    expectTemplateError(
      toggle({ pressed: pressed({}) }, { extensions: { svelte: { legacy: { script: '$: isPressed = pressed;' } } } }),
      'extensions.svelte.legacy.script'
    );
    expectTemplateError(
      toggle({ pressed: pressed({}) }, { extensions: { react: { script: 'const latestPressed = 1;' } } }),
      'extensions.react.script'
    );
    // Without the target, its blocks are its own business.
    expect(() =>
      validateTemplate(
        toggle({ pressed: pressed({}) }, { extensions: { svelte: { runes: { script: 'let isPressed = $state(false);' } } } }) as Template,
        { extensions: [reactTarget] }
      )
    ).not.toThrow();
  });

  it("checks the shape of a target's override blocks", () => {
    expectTemplateErrors(
      toggle({}, { extensions: { svelte: { runes: { script: 42, styleStrategy: 'append' } } } }),
      ['extensions.svelte.runes.script', 'extensions.svelte.runes.styleStrategy']
    );
    expect(() =>
      validateTemplate(toggle({}, { extensions: { svelte: { runes: { script: 42 } } } }) as Template, {
        extensions: [vueTarget],
      })
    ).not.toThrow();
  });

  it("runs a target's own override checks, after the engine's", () => {
    const probe = {
      key: 'probe',
      validateOverrides: (template: Template, context: { twoWayProps: readonly string[] }) => [
        {
          message: `two-way: ${context.twoWayProps.join(', ')}`,
          nodePath: Array.isArray(template) ? '' : 'extensions.probe',
        },
      ],
    };
    let caught: unknown;
    try {
      validateTemplate(
        toggle({ pressed: pressed({}), 'aria-pressed': pressed({ current: 'ariaValue', setter: 'setAria' }), open: { type: 'boolean', bindable: 'yes' } }) as Template,
        { extensions: [probe] }
      );
    } catch (error) {
      caught = error;
    }
    expect((caught as TemplateError).errors).toEqual([
      expect.objectContaining({ nodePath: 'props.open.bindable' }),
      { message: 'two-way: pressed, aria-pressed', nodePath: 'extensions.probe' },
    ]);
  });
});

describe('validateTemplate two-way default prop types', () => {
  const slider = (valueType: string, defaultType: string): Template =>
    ({
      type: 'component',
      name: 'Slider',
      props: {
        value: {
          type: valueType,
          bindable: {
            current: 'currentValue',
            setter: 'setValue',
            defaultProp: 'defaultValue',
          },
        },
        defaultValue: { type: defaultType },
      },
      children: [{ type: 'element', tag: 'input' }],
    }) as Template;

  it('accepts the same type, its whitespace or union order aside, or with | undefined', () => {
    for (const [valueType, defaultType] of [
      ['number', 'number'],
      ["'sm' | 'md'", "'md'|'sm'"],
      ['Array<string>', 'Array< string >'],
      ['string', 'string | undefined'],
      ['string | undefined', 'string'],
      ['boolean', 'true | false'],
      ['string[]', 'Array<string>'],
      ['(string)', 'string'],
      ["'a b'", '"a b"'],
      ['("sm" | "md")[]', "Array<'md' | 'sm'>"],
    ]) {
      expect(() =>
        validateTemplate(slider(valueType, defaultType))
      ).not.toThrow();
    }
  });

  it("rejects a default prop whose type is not the two-way prop's", () => {
    for (const [valueType, defaultType] of [
      ['number', 'string'],
      ["'sm' | 'md'", 'string'],
      ['string', 'string | null'],
      ['string[]', 'string'],
      ["'a b'", "'ab'"],
      ['boolean', 'true'],
    ]) {
      expectTemplateError(
        slider(valueType, defaultType),
        'props.value.bindable.defaultProp'
      );
    }
    expect(() => validateTemplate(slider("'sm' | 'md'", 'string') as Template)).toThrow(
      "whose type, string, is not the two-way prop's type, 'sm' | 'md'; "
    );
  });
});

describe('validateTemplate node shapes', () => {
  const inComponent = (node: unknown): unknown => ({
    type: 'component',
    name: 'Shape',
    children: [node],
  });

  it('names the path of a missing or malformed required field on every node type', () => {
    const cases: Array<[unknown, string]> = [
      [{ type: 'element' }, 'children[0].tag'],
      [{ type: 'element', tag: 'div', children: {} }, 'children[0].children'],
      [{ type: 'element', tag: 'div', events: [null] }, 'children[0].events'],
      [
        {
          type: 'element',
          tag: 'div',
          conditionalAttributes: [{ condition: 'a' }],
        },
        'children[0].conditionalAttributes[0].attributes',
      ],
      [
        { type: 'element', tag: 'div', events: [{ handler: 'save' }] },
        'children[0].events[0].name',
      ],
      [
        { type: 'element', tag: 'Card', slots: { footer: null } },
        'children[0].slots.footer',
      ],
      [{ type: 'text', content: 3 }, 'children[0].content'],
      [{ type: 'comment' }, 'children[0].content'],
      [{ type: 'fragment' }, 'children[0].children'],
      [{ type: 'slot', fallback: {} }, 'children[0].fallback'],
      [{ type: 'slot', name: 3 }, 'children[0].name'],
      [
        { type: 'iteration', items: 'rows', item: 'row' },
        'children[0].children',
      ],
      [{ type: 'iteration', items: 'rows', children: [] }, 'children[0].item'],
      [{ type: 'conditional', conditions: 'open' }, 'children[0].conditions'],
      [{ type: 'conditional', conditions: [null] }, 'children[0].conditions'],
      [
        {
          type: 'conditional',
          conditions: [{ statement: 'if', condition: 'a' }],
        },
        'children[0].conditions[0].children',
      ],
    ];
    for (const [node, path] of cases) {
      expectTemplateError(inComponent(node), path);
    }
    expectTemplateError({ type: 'component', name: 'Shape' }, 'children');
    expectTemplateError({ type: 'component', children: [] }, 'name');
  });

  it("points a text node's content written as an expression binding at 'expression'", () => {
    let caught: unknown;
    try {
      validateTemplate(
        inComponent({ type: 'text', content: { $expression: 'label' } }) as Template
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(TemplateError);
    expect((caught as TemplateError).nodePath).toBe('children[0].content');
    expect((caught as TemplateError).message).toContain(
      "takes 'expression' in place of 'content': { type: 'text', expression: 'label' }"
    );
    // The author's own expression, quoted so it reads back as written.
    try {
      validateTemplate(
        inComponent({ type: 'text', content: { $expression: "t('save')" } }) as Template
      );
    } catch (error) {
      expect((error as TemplateError).message).toContain(
        `{ type: 'text', expression: "t('save')" }`
      );
    }
    // Any other wrong kind gets no such hint.
    try {
      validateTemplate(inComponent({ type: 'text', content: 3 }) as Template);
    } catch (error) {
      expect((error as TemplateError).message).not.toContain("'expression'");
    }
  });

  it('reports a conditional written as condition and then, instead of crashing', () => {
    expectTemplateErrors(
      inComponent({ type: 'conditional', condition: 'open', then: [] }),
      ['children[0].conditions', 'children[0].condition', 'children[0].then']
    );
  });

  it('reports a key no node type takes, on every node type', () => {
    const cases: Array<[unknown, string]> = [
      [{ type: 'element', tag: 'div', style: {} }, 'children[0].style'],
      [{ type: 'text', content: 'a', tag: 'p' }, 'children[0].tag'],
      [
        { type: 'comment', content: 'a', expression: 'b' },
        'children[0].expression',
      ],
      [{ type: 'fragment', children: [], key: 'id' }, 'children[0].key'],
      [{ type: 'slot', children: [] }, 'children[0].children'],
      [
        {
          type: 'iteration',
          items: 'rows',
          item: 'row',
          as: 'row',
          children: [],
        },
        'children[0].as',
      ],
      [
        {
          type: 'conditional',
          conditions: [
            { statement: 'if', condition: 'a', children: [], when: 'b' },
          ],
        },
        'children[0].conditions[0].when',
      ],
      [
        {
          type: 'element',
          tag: 'div',
          conditionalAttributes: [
            { condition: 'a', attributes: {}, class: ['b'] },
          ],
        },
        'children[0].conditionalAttributes[0].class',
      ],
    ];
    for (const [node, path] of cases) {
      expectTemplateError(inComponent(node), path);
    }
    expectTemplateError(
      { type: 'component', name: 'Shape', children: [], tag: 'div' },
      'tag'
    );
  });

  it("rejects an html block on any node, html being core's own target, and leaves an element's blocks open", () => {
    const element = (extensions: unknown) =>
      inComponent({ type: 'element', tag: 'div', extensions });
    expectTemplateError(element({ html: { unwrap: true } }), 'children[0].extensions.html');
    expect(() => validateTemplate(element({ html: {} }) as Template)).toThrow(
      /'html' is reserved: it names core's own HTML output, not an extension.*\{ type: 'fragment'/
    );
    expectTemplateError(
      inComponent({ type: 'fragment', extensions: { html: { tag: 'div' } }, children: [] }),
      'children[0].extensions.html'
    );
    // An unknown key in an extension's block is that extension's to report.
    expect(() =>
      validateTemplate(element({ svelte: { unwrap: true }, bem: { unwrap: true } }) as Template)
    ).not.toThrow();
  });

  it("checks a fragment's override blocks: a tag naming the wrapper, its attributes and events, no other key", () => {
    const fragment = (extensions: unknown) =>
      inComponent({ type: 'fragment', extensions, children: [{ type: 'slot' }] });
    expect(() =>
      validateTemplate(
        fragment({
          react: { tag: 'FieldContext', attributes: { value: { $expression: 'id' } } },
          vue: {
            tag: 'Teleport',
            attributes: { to: 'body', class: ['layer'] },
            events: [{ name: 'click', handler: 'close' }],
          },
        }) as Template
      )
    ).not.toThrow();
    expectTemplateError(fragment({ vue: { attributes: { to: 'body' } } }), 'children[0].extensions.vue.tag');
    expectTemplateError(fragment({ react: { events: [{ name: 'click', handler: 'x' }] } }), 'children[0].extensions.react.tag');
    expectTemplateError(fragment({ react: {} }), 'children[0].extensions.react.tag');
    expectTemplateError(fragment({ react: { tag: ' ' } }), 'children[0].extensions.react.tag');
    expectTemplateError(fragment({ react: { tag: 3 } }), 'children[0].extensions.react.tag');
    expectTemplateError(fragment({ react: 'Portal' }), 'children[0].extensions.react');
    expectTemplateError(fragment({ svelte: { tag: 'div', unwrap: true } }), 'children[0].extensions.svelte.unwrap');
    expectTemplateError(fragment({ svelte: { tag: 'div', ignore: ['a11y_x'] } }), 'children[0].extensions.svelte.ignore');
    expectTemplateErrors(fragment({ bem: { block: 'menu' } }), [
      'children[0].extensions.bem.block',
      'children[0].extensions.bem.tag',
    ]);
    expectTemplateError(fragment({ react: { tag: 'section', attributes: { title: null } } }), 'children[0].extensions.react.attributes.title');
    expectTemplateError(
      fragment({ react: { tag: 'section', attributes: { $spread: { $expression: 'rest' } } } }),
      'children[0].extensions.react.attributes.$spread'
    );
    expectTemplateError(
      fragment({ react: { tag: 'section', attributes: { title: { $expression: '' } } } }),
      'children[0].extensions.react.attributes.title'
    );
    expectTemplateError(
      fragment({ react: { tag: 'section', events: [{ name: 'click' }] } }),
      'children[0].extensions.react.events[0].handler'
    );
    expect(() => validateTemplate(fragment({ bem: { block: 'menu' } }) as Template)).toThrow(
      /Unknown key 'block' on a fragment's override block, which takes tag, attributes, events; a fragment renders no element of its own/
    );
    expectTemplateError(fragment('section'), 'children[0].extensions');
    expectTemplateError(
      fragment({ vue: { tag: 'li', attributes: { style: { color: 'red' } } } }),
      'children[0].extensions.vue.attributes.style'
    );
    expect(() =>
      validateTemplate(fragment({ vue: { tag: 'li', attributes: { style: { color: 'red' } } } }) as Template)
    ).toThrow(/A fragment's wrapper takes a class in its attributes, not a style/);
    expectTemplateError(fragment({ react: { tag: 'input' } }), 'children[0].extensions.react.tag');
    expect(() =>
      validateTemplate(
        inComponent({ type: 'fragment', extensions: { react: { tag: 'input' } }, children: [] }) as Template
      )
    ).not.toThrow();
  });

  it('rejects null in a node\'s own attributes and its conditional entries, and a component-level html override', () => {
    expectTemplateError(
      inComponent({ type: 'element', tag: 'input', attributes: { title: null } }),
      'children[0].attributes.title'
    );
    expectTemplateError(
      inComponent({
        type: 'element',
        tag: 'input',
        conditionalAttributes: [{ condition: 'x', attributes: { title: null } }],
      }),
      'children[0].conditionalAttributes[0].attributes.title'
    );
    expect(() =>
      validateTemplate(
        inComponent({
          type: 'element',
          tag: 'input',
          attributes: { title: 'All' },
          extensions: { react: { attributes: { title: null } } },
        }) as Template
      )
    ).not.toThrow();
    expectTemplateError(
      { type: 'component', name: 'Shape', children: [], extensions: { html: {} } },
      'extensions.html'
    );
  });

  it('says where a misplaced key goes', () => {
    expect(() =>
      validateTemplate(
        inComponent({
          type: 'element',
          tag: 'div',
          style: { color: 'red' },
        }) as Template
      )
    ).toThrow(/Unknown key 'style' on an element node.*go in 'attributes'/);
    expect(() =>
      validateTemplate(
        inComponent({
          type: 'element',
          tag: 'div',
          componentValued: true,
        }) as Template
      )
    ).toThrow(/'componentValued' belongs in a dynamic tag/);
  });

  it('reports an unknown key on a named slot, a dynamic tag, a prop and a bindable object', () => {
    expectTemplateError(
      inComponent({
        type: 'element',
        tag: 'Card',
        slots: {
          footer: { content: [{ type: 'text', content: 'a' }], scope: [] },
        },
      }),
      'children[0].slots.footer.scope'
    );
    expectTemplateError(
      inComponent({
        type: 'element',
        tag: { $expression: 'as', default: 'div', fallback: 'span' },
      }),
      'children[0].tag.fallback'
    );
    expectTemplateError(
      {
        type: 'component',
        name: 'Shape',
        props: { size: { type: 'string', defualt: 'md' } },
        children: [],
      },
      'props.size.defualt'
    );
    expectTemplateError(
      {
        type: 'component',
        name: 'Shape',
        props: {
          open: {
            type: 'boolean',
            bindable: { current: 'isOpen', setter: 'setOpen', onChange: 'x' },
          },
        },
        children: [],
      },
      'props.open.bindable.onChange'
    );
  });

  it("rejects a named slot's slotScope that is not an array", () => {
    expectTemplateError(
      inComponent({
        type: 'element',
        tag: 'Card',
        slots: {
          footer: {
            content: [{ type: 'text', content: 'a' }],
            slotScope: null,
          },
        },
      }),
      'children[0].slots.footer.slotScope'
    );
  });

  it('ignores a key set to undefined', () => {
    expect(() =>
      validateTemplate(
        inComponent({
          type: 'element',
          tag: 'div',
          style: undefined,
        }) as Template
      )
    ).not.toThrow();
  });

  it("leaves an extension override block's own keys open", () => {
    expect(() =>
      validateTemplate(
        inComponent({
          type: 'element',
          tag: 'div',
          extensions: {
            someExtension: { anything: true },
            react: { unknown: 1 },
          },
        }) as Template
      )
    ).not.toThrow();
  });
});

describe('validateComponentOverride', () => {
  it('accepts a block of the shared override shape', () => {
    expect(() =>
      validateComponentOverride(
        { script: 'let x = 1;', scriptStrategy: 'replace', imports: [] },
        'extensions.svelte.runes'
      )
    ).not.toThrow();
  });

  it('reports every violation under the given path', () => {
    let caught: unknown;
    try {
      validateComponentOverride(
        { script: 42, importsStrategy: 'append' },
        'extensions.svelte.runes'
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(TemplateError);
    expect(
      (caught as TemplateError).errors?.map((error) => error.nodePath)
    ).toEqual([
      'extensions.svelte.runes.script',
      'extensions.svelte.runes.importsStrategy',
    ]);
  });
});

describe('validateTemplate - derived values', () => {
  /** A component computing `derived` from a list of rows and a two-way filter. */
  function table(
    derived: Record<string, unknown>,
    extra: Record<string, unknown> = {}
  ): Record<string, unknown> {
    return {
      type: 'component',
      name: 'Table',
      imports: [
        "import { sortBy } from './sort';",
        'function byName(row: { name: string }): string { return row.name; }',
      ],
      props: {
        rows: { type: 'Array<{ name: string }>', required: true },
        filter: {
          type: 'string',
          bindable: { current: 'filterText', setter: 'setFilter' },
        },
      },
      derived,
      children: [{ type: 'element', tag: 'ul' }],
      ...extra,
    };
  }

  /** The messages of the TemplateError a template throws, if any. */
  function messages(template: unknown): string[] {
    try {
      validateTemplate(template as Template);
    } catch (error) {
      const templateError = error as TemplateError;
      // A message ends with the path it is reported at.
      return (templateError.errors ?? [templateError]).map((detail) =>
        detail.message.replace(/ \(at [^)]*\)$/, '')
      );
    }
    return [];
  }

  it('accepts reads of props, two-way values, earlier derived values, imports and globals', () => {
    expect(
      messages(
        table(
          {
            visible: "rows.filter((row) => row.name.includes(filterText ?? ''))",
            sorted: 'sortBy(visible, byName)',
            count: 'Math.max(0, sorted.length)',
            summary: '{ count, first: sorted[0] }',
          },
          {
            // A script reads derived values and may declare a local of the
            // same name inside a function, which shadows rather than writes.
            script:
              'function describe() {\n  return `${count} rows`;\n}\nfunction reset() {\n  let count = 0;\n  count = 1;\n  return count;\n}',
          }
        )
      )
    ).toEqual([]);
  });

  it('rejects a name that is not an identifier or starts with $, and an empty expression', () => {
    expectTemplateErrors(table({ 'two words': 'rows', $total: 'rows', empty: ' ', count: 3 }), [
      'derived.two words',
      'derived.$total',
      'derived.empty',
      'derived.count',
    ]);
  });

  it('rejects a name a prop, two-way value, slot, binding, script or import takes', () => {
    expectTemplateErrors(
      table(
        {
          rows: "'x'",
          filterText: "'x'",
          setFilter: "'x'",
          ownFilter: "'x'",
          trigger: "'x'",
          props: "'x'",
          computed: "'x'",
          helper: "'x'",
          sortBy: "'x'",
          item: "'x'",
        },
        {
          script: 'function helper() {}',
          children: [
            { type: 'slot', name: 'trigger' },
            { type: 'iteration', items: 'rows', item: 'item', children: [] },
          ],
        }
      ),
      [
        'children[1].item',
        'derived.rows',
        'derived.filterText',
        'derived.setFilter',
        'derived.ownFilter',
        'derived.trigger',
        'derived.props',
        'derived.computed',
        'derived.helper',
        'derived.sortBy',
      ]
    );
  });

  it('rejects rest and passthrough locals where the component declares them', () => {
    expectTemplateError(
      table({ rest: 'rows' }, { rest: { tag: 'ul' } }),
      'derived.rest'
    );
    expectTemplateError(
      table(
        { className: 'rows' },
        { children: [{ type: 'element', tag: 'ul', passthrough: true }] }
      ),
      'derived.className'
    );
  });

  it('rejects a read of a script local, naming it', () => {
    const found = messages(
      table(
        { keys: 'rows.map(keyOf)' },
        { script: 'const keyOf = (row: { name: string }) => row.name;' }
      )
    );
    expect(found).toEqual([
      "The derived value 'keys' reads 'keyOf', which only the component script declares; a derived value reads props, two-way values, declared ids, derived values declared before it and imports, so declare 'keyOf' in imports when it is a pure helper or constant, in ids when it is a generated id (ids: { keyOf: 'prefix' }), or keep 'keys' in the script when 'keyOf' is per instance, such as a value read from a context",
    ]);
    // A script override's local is as unreachable.
    expectTemplateError(
      table(
        { keys: 'rows.map(keyOf)' },
        { extensions: { react: { script: 'function keyOf() {}' } } }
      ),
      'derived.keys'
    );
  });

  it('rejects a read of a two-way setter', () => {
    expect(messages(table({ write: 'setFilter' }))[0]).toContain(
      "reads 'setFilter', the setter of the two-way prop 'filter'"
    );
  });

  it('rejects a read of a later derived value, and names a cycle', () => {
    expect(messages(table({ count: 'visible.length', visible: 'rows' }))).toEqual([
      "The derived value 'count' reads 'visible', which is declared after it; declare 'visible' first",
    ]);
    expect(
      messages(table({ a: 'b + 1', b: 'c + 1', c: 'a + 1', d: 'd' }))
    ).toEqual([
      "The derived value 'a' reads itself through a -> b -> c -> a; a derived value reads only those declared before it, so break the cycle",
      "The derived value 'b' reads itself through b -> c -> a -> b; a derived value reads only those declared before it, so break the cycle",
      "The derived value 'd' reads itself through d -> d; a derived value reads only those declared before it, so break the cycle",
    ]);
  });

  it('rejects a script writing a derived value', () => {
    for (const script of [
      'function reset() { count = 0; }',
      'function bump() { count++; }',
      'function grow() { count += 1; }',
    ]) {
      expect(messages(table({ count: 'rows.length' }, { script }))).toEqual([
        "'count' is a derived value, computed from its expression; no script writes it, so change what it reads instead",
      ]);
    }
    expectTemplateError(
      table(
        { count: 'rows.length' },
        { extensions: { svelte: { runes: { script: 'function reset() { count = 0; }' } } } }
      ),
      'extensions.svelte.runes.script'
    );
  });

  it('rejects a handler or any other template expression writing a derived or two-way value', () => {
    const derivedMessage =
      "'count' is a derived value, computed from its expression; no handler or other expression writes it, so change what it reads instead";
    const twoWayMessage =
      "'filterText' is the two-way value; write it through 'setFilter'";
    const button = (node: Record<string, unknown>) =>
      table({ count: 'rows.length' }, { children: [{ type: 'element', tag: 'button', ...node }] });
    for (const handler of ['() => { count = 0; }', '() => count++', '() => (count += 1)']) {
      expect(messages(button({ events: [{ name: 'click', handler }] }))).toEqual([derivedMessage]);
    }
    expect(
      messages(button({ events: [{ name: 'click', handler: "() => { filterText = ''; }" }] }))
    ).toEqual([twoWayMessage]);
    // Each path names the expression, an override's handler and a bound
    // attribute value included.
    expectTemplateErrors(
      button({
        events: [{ name: 'click', handler: '() => { count = 0; }' }],
        attributes: { onClose: { $expression: '() => (filterText = "")' } },
        extensions: { react: { events: [{ name: 'click', handler: '() => count--' }] } },
        children: [{ type: 'text', expression: '(count = 2)' }],
      }),
      [
        'children[0].attributes.onClose.$expression',
        'children[0].events[0].handler',
        'children[0].extensions.react.events[0].handler',
        'children[0].children[0].expression',
      ]
    );
    // Reading, comparing, calling the setter and a parameter of the same
    // name are no writes.
    expect(
      messages(
        button({
          events: [
            { name: 'click', handler: "() => setFilter(count === 0 ? '' : filterText)" },
            { name: 'focus', handler: '(count: number) => { count = 1; }' },
          ],
        })
      )
    ).toEqual([]);
  });

  it('rejects derived values on a discriminated surface root', () => {
    expectTemplateError(
      {
        type: 'component',
        name: 'Action',
        props: { label: { type: 'string', required: true } },
        derived: { short: 'label.slice(0, 4)' },
        children: [
          {
            type: 'conditional',
            conditions: [
              {
                statement: 'if',
                condition: 'link',
                props: {
                  link: { type: 'true', required: true },
                  href: { type: 'string', required: true },
                },
                children: [{ type: 'element', tag: 'a', passthrough: true }],
              },
              {
                statement: 'else',
                props: { link: { type: 'false' } },
                children: [{ type: 'element', tag: 'button', passthrough: true }],
              },
            ],
          },
        ],
      },
      'derived'
    );
  });

  it('reads and writes inside a template literal placeholder', () => {
    expect(
      messages(table({ summary: '`${matches.length}`', matches: 'rows' }))
    ).toEqual([
      "The derived value 'summary' reads 'matches', which is declared after it; declare 'matches' first",
    ]);
    expect(
      messages(
        table(
          { count: 'rows.length' },
          { script: 'function go() {\n  return `${(count = 1)} ${(filterText = "")}`;\n}' }
        )
      )
    ).toEqual([
      "'filterText' is the two-way value; write it through 'setFilter'",
      "'count' is a derived value, computed from its expression; no script writes it, so change what it reads instead",
    ]);
    // A placeholder's own arrow parameter shadows as anywhere else.
    expect(
      messages(table({ labels: '`${rows.map((count) => count).length}`', count: 'rows.length' }))
    ).toEqual([]);
  });

  it('rejects an expression that writes, holds a sequence or reads a generated two-way name', () => {
    expect(
      messages(
        table({
          a: '(rows = [])',
          b: '(filterText = "")',
          c: 'rows.length, 1',
          d: 'rows.length;',
          e: 'ownFilter',
          f: 'latestFilter.current',
          g: 'emit',
          h: 'rows.map((row, index) => index).length',
          i: '`${a}`',
        })
      )
    ).toEqual([
      "The derived value 'a' writes 'rows'; a derived value only reads what it is computed from",
      "The derived value 'b' writes 'filterText'; a derived value only reads what it is computed from",
      "The derived value 'c' has a top-level ','; a derived value is one expression, so wrap a sequence in a helper declared in imports",
      "The derived value 'd' has a top-level ';'; a derived value is one expression, so drop the semicolon",
      "The derived value 'e' reads 'ownFilter', the component's own copy of 'filter', which one target generates for itself; read the two-way value instead",
      "The derived value 'f' reads 'latestFilter', React's ref holding the latest 'filter', which one target generates for itself; read the two-way value instead",
      "The derived value 'g' reads 'emit', Vue's emit function for the two-way props, which one target generates for itself; read the two-way value instead",
    ]);
  });

  it('rejects a derived map that is not an object', () => {
    expectTemplateError(table([] as unknown as Record<string, unknown>), 'derived');
  });
});

describe('validateTemplate - declared ids', () => {
  /** A combobox-like component declaring `ids`. */
  function combobox(
    ids: Record<string, unknown>,
    extra: Record<string, unknown> = {}
  ): Record<string, unknown> {
    return {
      type: 'component',
      name: 'Combobox',
      props: {
        id: { type: 'string' },
        name: { type: 'string | undefined' },
        size: { type: 'number' },
        options: { type: 'string[]', required: true },
      },
      ids,
      children: [
        {
          type: 'element',
          tag: 'input',
          attributes: { 'aria-controls': { $expression: 'listId' } },
        },
      ],
      ...extra,
    };
  }

  /** The messages of the TemplateError a template throws, if any. */
  function messages(template: unknown): string[] {
    try {
      validateTemplate(template as Template);
    } catch (error) {
      const templateError = error as TemplateError;
      return (templateError.errors ?? [templateError]).map(
        (detail) => detail.message
      );
    }
    return [];
  }

  it('accepts a prefix, the object form with a string prop, and derived reads of an id', () => {
    expect(
      messages(
        combobox(
          {
            listId: 'command',
            inputId: { prefix: 'command-input', prop: 'id' },
            groupName: { prefix: 'group', prop: 'name' },
            labelId: { prefix: 'label' },
          },
          {
            derived: { optionPrefix: '`${listId}-option`' },
            script: 'function focusInput() {\n  document.getElementById(inputId)?.focus();\n}',
          }
        )
      )
    ).toEqual([]);
  });

  it('rejects a non-identifier name, a value that is no prefix, and an unknown key', () => {
    expectTemplateErrors(
      combobox({
        'two words': 'a',
        $id: 'b',
        count: 3,
        labelId: { prefix: 'label', fallback: 'x' },
      }),
      ['ids.two words', 'ids.$id', 'ids.count', 'ids.labelId.fallback']
    );
  });

  it('rejects an empty prefix, a non-literal prefix and a shared prefix', () => {
    const found = messages(
      combobox({
        emptyId: '',
        expressionId: { prefix: { $expression: 'name' } },
        templateId: '${name}-list',
        listId: 'list',
        otherListId: { prefix: 'list' },
      })
    );
    expect(found).toEqual([
      "The id 'emptyId' has an empty prefix; give it the literal start of the id, such as 'empty'",
      "The id 'expressionId' has the prefix an object; a prefix is a literal string of letters, digits, '-' and '_', starting with a letter, the same in every target",
      "The id 'templateId' has the prefix '${name}-list'; a prefix is a literal string of letters, digits, '-' and '_', starting with a letter, the same in every target",
      "The ids 'listId' and 'otherListId' share the prefix 'list'; each id of an instance is its prefix and the instance's one generated id, so give each its own prefix",
    ]);
  });

  it('rejects a prop that is not declared or not a string', () => {
    const found = messages(
      combobox({
        listId: { prefix: 'list', prop: 'listIdentifier' },
        sizeId: { prefix: 'size', prop: 'size' },
        optionsId: { prefix: 'options', prop: 'options' },
      })
    );
    expect(found).toEqual([
      "The id 'listId' names the prop 'listIdentifier', which the component does not declare; declare it in props as a string, such as listIdentifier: { type: 'string' }",
      "The id 'sizeId' names the prop 'size', typed 'number'; the consumer's value replaces the generated id, so the prop is a string",
      "The id 'optionsId' names the prop 'options', typed 'string[]'; the consumer's value replaces the generated id, so the prop is a string",
    ]);
  });

  it('rejects a name a prop, derived value, slot, binding, script or import takes', () => {
    expectTemplateErrors(
      combobox(
        {
          listId: 'list',
          id: 'a',
          total: 'b',
          trigger: 'c',
          helper: 'd',
          shared: 'e',
          useId: 'f',
          bem: 'g',
          generatedId: 'h',
          option: 'i',
          computed: 'j',
          shallowRef: 'k',
          reactOnly: 'l',
        },
        {
          imports: ['const shared = 1;'],
          script: 'function helper() {}',
          extensions: { react: { imports: ['const reactOnly = 1;'] } },
          derived: { total: 'options.length' },
          children: [
            { type: 'slot', name: 'trigger' },
            { type: 'iteration', items: 'options', item: 'option', children: [] },
            { type: 'iteration', items: 'options', item: 'listId', children: [] },
          ],
        }
      ),
      [
        'ids.id',
        'ids.total',
        'ids.trigger',
        'ids.helper',
        'ids.shared',
        'ids.useId',
        'ids.bem',
        'ids.generatedId',
        'ids.computed',
        'ids.shallowRef',
        'ids.reactOnly',
        'children[1].item',
        'children[2].item',
      ]
    );
  });

  it('rejects a declaration of the names the ids generate', () => {
    const found = messages(
      combobox(
        { listId: 'list' },
        { script: 'const generatedId = 1;\nlet nextGeneratedId = 0;' }
      )
    );
    expect(found).toEqual([
      "'generatedId' is a declaration in script, but a component with ids declares 'generatedId' itself; rename it",
      "'nextGeneratedId' is a declaration in script, but a component with ids declares 'nextGeneratedId' itself; rename it",
    ]);
  });

  it("rejects the generated names in an override's imports lines", () => {
    expect(
      messages(
        combobox(
          { listId: 'list' },
          {
            extensions: {
              svelte: { legacy: { imports: ['let nextGeneratedId = 0;'] } },
              vue: { imports: ["import { generatedId } from './ids';"] },
            },
          }
        )
      )
    ).toEqual([
      "'generatedId' is a declaration in extensions.vue.imports, but a component with ids declares 'generatedId' itself; rename it",
      "'nextGeneratedId' is a declaration in extensions.svelte.legacy.imports, but a component with ids declares 'nextGeneratedId' itself; rename it",
    ]);
  });

  it('rejects a two-way prop as the prop an id follows', () => {
    expect(
      messages(
        combobox(
          { listId: { prefix: 'list', prop: 'value' } },
          {
            props: {
              value: {
                type: 'string',
                bindable: { current: 'currentValue', setter: 'setValue' },
              },
            },
          }
        )
      )
    ).toEqual([
      "The id 'listId' names the two-way prop 'value'; its value is the component's own copy when the consumer leaves it out, which the targets start differently, so name a plain string prop (at ids.listId.prop)",
    ]);
  });

  it('rejects a read of the generated id in a script, a derived value or an expression', () => {
    expectTemplateErrors(
      combobox(
        { listId: 'list' },
        {
          script: 'function log() {\n  console.log(generatedId);\n}',
          derived: { raw: '`${generatedId}`' },
          children: [
            {
              type: 'element',
              tag: 'span',
              attributes: { 'data-id': { $expression: 'generatedId' } },
            },
          ],
        }
      ),
      ['script', 'children[0].attributes.data-id.$expression', 'derived.raw']
    );
  });

  it('rejects a write of an id in a script or a handler', () => {
    expectTemplateErrors(
      combobox(
        { listId: 'list' },
        {
          script: 'function reset() {\n  listId = "other";\n}',
          children: [
            {
              type: 'element',
              tag: 'button',
              events: [{ name: 'click', handler: '() => (listId = "x")' }],
            },
          ],
        }
      ),
      ['script', 'children[0].events[0].handler']
    );
  });

  it('rejects ids on a discriminated surface root', () => {
    expectTemplateError(
      {
        type: 'component',
        name: 'Action',
        ids: { labelId: 'action' },
        children: [
          {
            type: 'conditional',
            conditions: [
              {
                statement: 'if',
                condition: 'link',
                props: { link: { type: 'true', required: true } },
                children: [{ type: 'element', tag: 'a', passthrough: true }],
              },
              {
                statement: 'else',
                props: { link: { type: 'false' } },
                children: [
                  { type: 'element', tag: 'button', passthrough: true },
                ],
              },
            ],
          },
        ],
      },
      'ids'
    );
  });
});

describe('discriminated surface root discriminants', () => {
  /** A link-or-button surface root with the given conditions and branch props. */
  function surface(
    condition: string,
    linkProps: Record<string, unknown>,
    buttonProps: Record<string, unknown> | undefined
  ): Template {
    return {
      type: 'component',
      name: 'Button',
      children: [
        {
          type: 'conditional',
          conditions: [
            {
              statement: 'if',
              condition,
              props: linkProps,
              children: [{ type: 'element', tag: 'a', passthrough: true }],
            },
            {
              statement: 'else',
              ...(buttonProps === undefined ? {} : { props: buttonProps }),
              children: [{ type: 'element', tag: 'button', passthrough: true }],
            },
          ],
        },
      ],
    } as Template;
  }

  const required = { href: { type: 'string', required: true } };

  it('accepts a presence discriminant written `!== undefined`', () => {
    expect(() =>
      validateTemplate(
        surface('href !== undefined', required, { href: { type: 'undefined' } })
      )
    ).not.toThrow();
    expect(() =>
      validateTemplate(surface('href !== undefined', required, undefined))
    ).not.toThrow();
  });

  it('rejects a bare condition on a prop not typed as literals, suggesting presence or literal types', () => {
    for (const type of ['string', 'number']) {
      const attempt = () =>
        validateTemplate(
          surface(
            'value',
            { value: { type } },
            { value: { type: 'undefined' } }
          )
        );
      expect(attempt).toThrow(
        `The discriminated surface root's condition 'value' tests a prop typed '${type}', which is not a literal type`
      );
      expect(attempt).toThrow(
        "write 'value !== undefined' to pick this branch by whether the prop is given, or type 'value' as 'true' in this branch and 'false' in the branches after it"
      );
    }
  });

  it('suggests only literal true/false typing for a bare condition on a boolean-member prop', () => {
    const cases: Array<[string, string]> = [
      ['boolean', 'is not a literal type'],
      ['true | false', 'has a falsy literal member'],
      ['true | undefined', 'has a falsy literal member'],
    ];
    for (const [type, reason] of cases) {
      const attempt = () =>
        validateTemplate(
          surface('flag', { flag: { type } }, { flag: { type: 'false' } })
        );
      expect(attempt).toThrow(`tests a prop typed '${type}', which ${reason}`);
      expect(attempt).toThrow(
        "; type 'flag' as 'true' in this branch and 'false' in the branches after it"
      );
      expect(attempt).not.toThrow(/!== undefined/);
    }
  });

  it('suggests dropping the falsy member of a literal union', () => {
    const cases: Array<[string, string, string]> = [
      ["'a' | ''", "drop '' from its type", "''"],
      ['0 | 1', 'drop 0 from its type', '0'],
    ];
    for (const [type, advice, later] of cases) {
      const attempt = () =>
        validateTemplate(
          surface('kind', { kind: { type } }, { kind: { type: later } })
        );
      expect(attempt).toThrow(
        `tests a prop typed '${type}', which has a falsy literal member`
      );
      expect(attempt).toThrow(advice);
      expect(attempt).not.toThrow(/!== undefined|'true'/);
    }
  });

  it('rejects a loose `!= null` presence test with the same suggestion', () => {
    for (const buttonProps of [undefined, { href: { type: 'undefined' } }]) {
      const attempt = () =>
        validateTemplate(surface('href != null', required, buttonProps));
      expect(attempt).toThrow(
        "The discriminated surface root's condition 'href != null' is a loose null test"
      );
      expect(attempt).toThrow(
        "write 'href !== undefined' to pick this branch by whether the prop is given, or type 'href' as 'true'"
      );
    }
  });

  it('suggests only literal true/false typing for `!= null` on a boolean prop', () => {
    const attempt = () =>
      validateTemplate(
        surface(
          'flag != null',
          { flag: { type: 'boolean', required: true } },
          undefined
        )
      );
    expect(attempt).toThrow('is a loose null test');
    expect(attempt).toThrow(
      "write the bare name 'flag' and type 'flag' as 'true' in this branch and 'false' in the branches after it"
    );
    expect(attempt).not.toThrow(/write 'flag !== undefined'/);
  });

  it('reports a more specific error before the loose-null or bare-name one', () => {
    const shared = (condition: string) =>
      ({
        ...surface(condition, {}, undefined),
        props: { href: { type: 'string' } },
      }) as Template;
    for (const condition of ['href != null', 'href']) {
      expect(() => validateTemplate(shared(condition))).toThrow(
        "The discriminant 'href' must be declared in each branch's props, not in the component's shared props"
      );
    }
    expect(() =>
      validateTemplate(surface('href != null', {}, undefined))
    ).toThrow(
      "The discriminant 'href' must be declared in the props of the branch it picks"
    );
    // Following the advice (`href !== undefined`) would fail these next.
    expect(() =>
      validateTemplate(
        surface('href != null', { href: { type: 'string' } }, undefined)
      )
    ).toThrow("The presence discriminant 'href' must be required");
    expect(() =>
      validateTemplate(
        surface('href != null', required, { href: { type: 'string' } })
      )
    ).toThrow('may be declared only in the branch it picks');
  });

  it('reports a discriminant error at the branch whose condition it is', () => {
    const element = (tag: string) => ({
      type: 'element',
      tag,
      passthrough: true,
    });
    const chain = (secondCondition: string) => ({
      type: 'component',
      name: 'Choice',
      children: [
        { type: 'comment', content: 'A link, a label or a button.' },
        {
          type: 'conditional',
          conditions: [
            {
              statement: 'if',
              condition: 'a',
              props: { a: { type: 'true', required: true } },
              children: [element('a')],
            },
            {
              statement: 'else-if',
              condition: secondCondition,
              props: {
                a: { type: 'false' },
                b: { type: 'string', required: true },
              },
              children: [element('span')],
            },
            {
              statement: 'else',
              props: { a: { type: 'false' } },
              children: [element('button')],
            },
          ],
        },
      ],
    });
    for (const condition of ['b', 'b != null', 'b === "x"', 'c']) {
      expectTemplateError(chain(condition), 'children[1].conditions[1]');
    }
  });

  it('accepts literal discriminants other than booleans, parenthesised too', () => {
    expect(() =>
      validateTemplate(
        surface(
          'kind',
          { kind: { type: "'link' | 'anchor'", required: true } },
          { kind: { type: "false | ''" } }
        )
      )
    ).not.toThrow();
    expect(() =>
      validateTemplate(
        surface(
          'visual',
          { visual: { type: '( true )', required: true } },
          { visual: { type: '(false)' } }
        )
      )
    ).not.toThrow();
  });

  it('points a literal picking several branches to one boolean per branch', () => {
    const element = (tag: string) => ({
      type: 'element',
      tag,
      passthrough: true,
    });
    expect(() =>
      validateTemplate({
        type: 'component',
        name: 'Choice',
        children: [
          {
            type: 'conditional',
            conditions: [
              {
                statement: 'if',
                condition: 'kind',
                props: { kind: { type: "'a'", required: true } },
                children: [element('a')],
              },
              {
                statement: 'else-if',
                condition: 'kind',
                props: { kind: { type: "'b'", required: true } },
                children: [element('button')],
              },
              {
                statement: 'else',
                props: { kind: { type: "'c'" } },
                children: [element('span')],
              },
            ],
          },
        ],
      } as Template)
    ).toThrow(/give each branch a boolean discriminant of its own/);
  });

  it('rejects a condition it can type as neither literal nor presence', () => {
    const cases: Array<
      [
        string,
        Record<string, unknown>,
        Record<string, unknown> | undefined,
        RegExp,
      ]
    > = [
      [
        'href === undefined',
        required,
        undefined,
        /the bare name of a prop typed as literals, or '<prop> !== undefined'/,
      ],
      [
        'link',
        { link: { type: 'true', required: true } },
        { link: { type: 'boolean' } },
        /falsy literals/,
      ],
      [
        'link',
        { link: { type: 'true', required: true } },
        undefined,
        /Every branch .* must declare the discriminant 'link'/,
      ],
      [
        'href',
        { href: { type: 'string', required: true } },
        undefined,
        /tests a prop typed 'string', which is not a literal type/,
      ],
      ['href', {}, undefined, /in the props of the branch it picks/],
      [
        'pressed !== undefined',
        { pressed: { type: 'boolean', required: true } },
        undefined,
        /has a boolean member/,
      ],
      [
        'pressed !== undefined',
        { pressed: { type: "'on' | false", required: true } },
        undefined,
        /has a boolean member/,
      ],
      [
        'href !== undefined',
        { href: { type: 'string' } },
        undefined,
        /must be required/,
      ],
      [
        'href !== undefined',
        { href: { type: 'string | null', required: true } },
        undefined,
        /without 'undefined' or 'null'/,
      ],
      [
        'href !== undefined',
        required,
        { href: { type: 'string' } },
        /may be declared only in the branch it picks/,
      ],
      [
        'href !== undefined',
        {},
        undefined,
        /in the props of the branch it picks/,
      ],
    ];
    for (const [condition, linkProps, buttonProps, message] of cases) {
      expect(() =>
        validateTemplate(surface(condition, linkProps, buttonProps))
      ).toThrow(message);
    }
  });
});

describe('conditional passthrough root', () => {
  /** A menu panel whose root conditional has the given branches. */
  function panel(conditions: unknown[]): Template {
    return {
      type: 'component',
      name: 'Panel',
      props: {
        open: { type: 'boolean', default: false },
        count: { type: 'number', default: 0 },
      },
      children: [{ type: 'conditional', conditions }],
    } as Template;
  }

  const shown = { type: 'element', tag: 'div', passthrough: true };

  it('accepts an if around a single passthrough root, with any condition', () => {
    for (const condition of ['open', 'count > 0 && open', '!open']) {
      expect(() =>
        validateTemplate(
          panel([{ statement: 'if', condition, children: [shown] }])
        )
      ).not.toThrow();
    }
  });

  it('accepts an else that renders nothing, and comments beside the element', () => {
    expect(() =>
      validateTemplate(
        panel([
          {
            statement: 'if',
            condition: 'open',
            children: [{ type: 'comment', content: 'panel' }, shown],
          },
          {
            statement: 'else',
            children: [{ type: 'comment', content: 'closed' }],
          },
        ])
      )
    ).not.toThrow();
  });

  it('rejects an else that renders another element, naming the discriminated form', () => {
    expect(() =>
      validateTemplate(
        panel([
          { statement: 'if', condition: 'open', children: [shown] },
          {
            statement: 'else',
            children: [{ type: 'element', tag: 'span' }],
          },
        ])
      )
    ).toThrow(/discriminated surface root/);
  });

  it('rejects an else-if, a sibling and an element in the else', () => {
    const cases: Array<[unknown[], RegExp]> = [
      [
        [
          { statement: 'if', condition: 'open', children: [shown] },
          { statement: 'else-if', condition: 'count', children: [] },
        ],
        /at most one more branch/,
      ],
      [
        [
          {
            statement: 'if',
            condition: 'open',
            children: [shown, { type: 'element', tag: 'input' }],
          },
        ],
        /must render the passthrough element alone/,
      ],
      [
        [
          { statement: 'if', condition: 'open', children: [] },
          { statement: 'else', children: [shown] },
        ],
        /in the 'if' branch/,
      ],
    ];
    for (const [conditions, message] of cases) {
      expect(() => validateTemplate(panel(conditions))).toThrow(message);
    }
  });

  it('rejects branch props', () => {
    expect(() =>
      validateTemplate(
        panel([
          {
            statement: 'if',
            condition: 'open',
            props: { label: { type: 'string' } },
            children: [shown],
          },
        ])
      )
    ).toThrow(/cannot declare props/);
  });

  it('keeps the reserved-name rule and rejects routing below it', () => {
    expect(() =>
      validateTemplate({
        type: 'component',
        name: 'Panel',
        props: { style: { type: 'string' } },
        children: [
          {
            type: 'conditional',
            conditions: [
              { statement: 'if', condition: 'style', children: [shown] },
            ],
          },
        ],
      } as Template)
    ).toThrow(/reserved prop 'style'/);
    expect(() =>
      validateTemplate(
        panel([
          {
            statement: 'if',
            condition: 'open',
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
        ])
      )
    ).toThrow(/not supported under a conditional passthrough root/);
  });
});

describe('validateTemplate relayed two-way props', () => {
  const select = (
    props: Record<string, unknown>,
    extra: Record<string, unknown> = {}
  ): unknown => ({
    type: 'component',
    name: 'Select',
    props,
    children: [{ type: 'element', tag: 'button' }],
    ...extra,
  });
  const value = (bindable: Record<string, unknown>, extra = {}) => ({
    type: 'string',
    bindable: { given: 'givenValue', report: 'reportValue', ...bindable },
    ...extra,
  });

  it('accepts a relay with its change prop, forwarding an ordinary default prop', () => {
    expect(() =>
      validateTemplate(
        select({
          value: value({ changeProp: 'onValueChange' }),
          defaultValue: { type: 'string' },
          onValueChange: { type: '(value: string) => void' },
        }) as Template
      )
    ).not.toThrow();
  });

  it('accepts a relay beside a copy, and a required or function-typed relay', () => {
    expect(() =>
      validateTemplate(
        select({
          value: value({}),
          pressed: { type: 'boolean', bindable: { current: 'isPressed', setter: 'setPressed' } },
          handler: { type: '() => void', required: true, bindable: { given: 'givenHandler', report: 'reportHandler' } },
        }) as Template
      )
    ).not.toThrow();
  });

  it('rejects an object mixing the forms, or naming neither', () => {
    expectTemplateError(
      select({ value: value({ current: 'currentValue' }) }),
      'props.value.bindable'
    );
    expectTemplateError(
      select({ value: value({ setter: 'setValue' }) }),
      'props.value.bindable'
    );
    expectTemplateError(
      select({ value: { type: 'string', bindable: { changeProp: 'onValueChange' } }, onValueChange: { type: '(value: string) => void' } }),
      'props.value.bindable'
    );
  });

  it('rejects a malformed given or report', () => {
    expectTemplateError(select({ value: value({ given: undefined }) }), 'props.value.bindable.given');
    expectTemplateError(select({ value: value({ report: undefined }) }), 'props.value.bindable.report');
    expectTemplateError(select({ value: value({ given: '$value' }) }), 'props.value.bindable.given');
    expectTemplateError(select({ value: value({ report: 'class' }) }), 'props.value.bindable.report');
    expectTemplateError(select({ value: value({ report: 'givenValue' }) }), 'props.value.bindable.report');
  });

  it('rejects a relay with a default prop or a default of its own', () => {
    expectTemplateError(
      select({
        value: value({ defaultProp: 'defaultValue' }),
        defaultValue: { type: 'string' },
      }),
      'props.value.bindable.defaultProp'
    );
    expectTemplateError(select({ value: value({}, { default: '' }) }), 'props.value.default');
  });

  it('checks the change prop as a copy does', () => {
    expectTemplateError(
      select({ value: value({ changeProp: 'label' }), label: { type: 'string' } }),
      'props.value.bindable.changeProp'
    );
    expectTemplateError(
      select({ value: value({ changeProp: 'onValueChange' }) }),
      'props.value.bindable.changeProp'
    );
  });

  it('reserves given and report against the props, scripts and other bindings', () => {
    expectTemplateError(
      select({ value: value({}), givenValue: { type: 'string' } }),
      'props.givenValue'
    );
    expectTemplateError(
      select({ value: value({}) }, { script: 'function reportValue(next: string) {}' }),
      'script'
    );
    expectTemplateError(
      select({
        value: value({}),
        other: { type: 'string', bindable: { current: 'givenValue', setter: 'setOther' } },
      }),
      'props.other.bindable.current'
    );
  });

  it('rejects a write to the given value, naming the report function', () => {
    const written = select(
      { value: value({}) },
      {
        children: [
          {
            type: 'element',
            tag: 'button',
            events: [{ name: 'click', handler: "() => { givenValue = 'x'; }" }],
          },
        ],
      }
    );
    expectTemplateError(written, 'children[0].events[0].handler');
    expect(() => validateTemplate(written as Template)).toThrow(
      "'givenValue' is the two-way value; write it through 'reportValue'"
    );
    expectTemplateError(
      select({ value: value({}) }, { script: "function clear() { givenValue = ''; }" }),
      'script'
    );
  });

  it('does not reserve the copy-only names for a relay', () => {
    expect(() =>
      validateTemplate(
        select({
          value: value({}),
          ownValue: { type: 'string' },
          setOwnValue: { type: 'string' },
          latestValue: { type: 'string' },
        }) as Template
      )
    ).not.toThrow();
  });
});
