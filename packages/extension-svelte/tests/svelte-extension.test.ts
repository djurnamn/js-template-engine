import {
  process,
  TemplateError,
  type StylingExtension,
} from '@js-template-engine/core';
import type { ElementNode, Template } from '@js-template-engine/types';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { svelte } from '../src/index';

/** A minimal BEM runtime-mode styling extension: a `bem(...)` call on each span. */
const runtimeBem: StylingExtension = {
  key: 'bem',
  kind: 'styling',
  classKind: 'semantic',
  runtime: {
    importSource: 'use-bem',
    elementSeparator: '__',
    modifierSeparator: '--',
    call: (element) =>
      element.tag === 'span'
        ? {
            block: 'Badge',
            declaresBlock: true,
            elementName: undefined,
            staticModifiers: [],
            conditionalModifiers: [],
            contributedClasses: ['Badge'],
            foldedConditionalClasses: [],
          }
        : undefined,
  },
  contributeClasses: (element) => (element.tag === 'span' ? ['Badge'] : []),
};

function processWithSvelte(
  template: Template,
  options: Parameters<typeof process>[1] = {}
) {
  return process(template, { ...options, extensions: [svelte()] });
}

/** An input with a bound `indeterminate`. */
function boundIndeterminate(expression: string): Template {
  return {
    type: 'component',
    name: 'Mixed',
    children: [
      {
        type: 'element',
        tag: 'input',
        attributes: { indeterminate: { $expression: expression } },
      },
    ],
  } as unknown as Template;
}

function fileContent(
  template: Template,
  options: Parameters<typeof process>[1] = {}
) {
  return processWithSvelte(template, options).files[0].content;
}

/** A passthrough label routing only aria-* to its input. */
const ROUTED_ARIA: Template = {
  type: 'component',
  name: 'Field',
  props: {
    hint: { type: 'string' },
    label: { type: 'string' },
    inputId: { type: 'string' },
    onPress: { type: '() => void' },
    onFocusIn: { type: '() => void' },
  },
  children: [
    {
      type: 'element',
      tag: 'label',
      passthrough: true,
      attributes: { title: { $expression: 'hint' } },
      events: [{ name: 'click', handler: 'onPress' }],
      children: [
        {
          type: 'element',
          tag: 'input',
          passthrough: { attributes: ['aria-*'] },
          attributes: {
            id: { $expression: 'inputId' },
            'aria-label': { $expression: 'label' },
          },
          events: [{ name: 'focus', handler: 'onFocusIn' }],
        },
      ],
    },
  ],
};

/** {@link ROUTED_ARIA} with its input setting `passthrough` to `routing`. */
function routedWith(
  routing: Record<string, unknown>,
  inputAttributes: Record<string, unknown> = {}
): Template {
  const template = structuredClone(ROUTED_ARIA) as Extract<
    Template,
    { type: 'component' }
  >;
  const label = template.children[0] as unknown as {
    children: Array<Record<string, unknown>>;
  };
  const input = label.children[0];
  input.passthrough = routing;
  input.attributes = {
    ...(input.attributes as Record<string, unknown>),
    ...inputAttributes,
  };
  return template;
}

/** {@link ROUTED_ARIA} whose input sets `aria-describedby` only while `hint` is set. */
function routedConditional(): Template {
  const template = routedWith({ attributes: ['aria-*'] });
  const input = (
    (template as Extract<Template, { type: 'component' }>)
      .children[0] as unknown as { children: Array<Record<string, unknown>> }
  ).children[0];
  input.conditionalAttributes = [
    { condition: 'hint', attributes: { 'aria-describedby': 'field-hint' } },
  ];
  return template;
}

describe('svelte()', () => {
  it('spreads, falls back and composes against the share each name lands in', () => {
    const content = process(ROUTED_ARIA, {
      extensions: [svelte({ mode: 'runes' })],
    }).files[0].content;
    expect(content).toContain("{...consumerAttributes(restProperties, 'root')}");
    expect(content).toContain("{...consumerAttributes(restProperties, 'routed')}");
    expect(content).toContain(
      'onclick={composeEventHandlers(restProperties.onclick, onPress)}'
    );
    expect(content).toContain(
      "title={authoredOrConsumer(hint, restProperties, 'title')}"
    );
    expect(content).toContain(
      "aria-label={authoredOrConsumer(label, restProperties, 'aria-label')}"
    );
    expect(content).toContain('id={inputId}');
    expect(content).toContain('onfocus={onFocusIn}');
    const legacy = fileContent(ROUTED_ARIA);
    expect(legacy).toContain("{...consumerAttributes($$restProps, 'routed')}");
  });

  it("binds element on the routed element with handle: 'routed'", () => {
    const template = routedWith({ attributes: ['aria-*'], handle: 'routed' });
    for (const mode of ['legacy', 'runes'] as const) {
      const content = process(template, {
        extensions: [svelte({ mode })],
      }).files[0].content;
      expect(content.match(/bind:this=\{element\}/g)).toHaveLength(1);
      expect(content).toMatch(/<input[^>]*bind:this=\{element\}/);
      expect(content).toContain("HTMLElementTagNameMap['input'] | undefined");
      expect(content).not.toContain("HTMLElementTagNameMap['label']");
    }
    expect(
      fileContent(routedWith({ attributes: ['aria-*'], handle: 'root' }))
    ).toBe(fileContent(ROUTED_ARIA));
  });

  it("joins a condition-gated routed id list with the consumer's", () => {
    const runes = process(routedConditional(), {
      extensions: [svelte({ mode: 'runes' })],
    }).files[0].content;
    expect(runes).toContain(
      "aria-describedby={authoredAndConsumer(hint ? 'field-hint' : undefined, restProperties, 'aria-describedby')}"
    );
  });

  it("joins a routed id list with the consumer's, static or bound", () => {
    const template = routedWith(
      { attributes: ['aria-*'] },
      {
        'aria-describedby': { $expression: 'hint' },
        'aria-owns': 'field-popup',
      }
    );
    const runes = process(template, {
      extensions: [svelte({ mode: 'runes' })],
    }).files[0].content;
    expect(runes).toContain(
      "aria-describedby={authoredAndConsumer(hint, restProperties, 'aria-describedby')}"
    );
    expect(runes).toContain(
      "aria-owns={authoredAndConsumer('field-popup', restProperties, 'aria-owns')}"
    );
    expect(runes).toContain('function authoredAndConsumer(');
    const legacy = fileContent(template);
    expect(legacy).toContain(
      "aria-describedby={authoredAndConsumer(hint, $$restProps, 'aria-describedby')}"
    );
    expect(legacy).toContain('function authoredAndConsumer(');
  });

  it("joins a passthrough root's id lists with the consumer's", () => {
    const template: Template = {
      type: 'component',
      name: 'HintButton',
      props: { hintId: { type: 'string' }, expanded: { type: 'boolean' } },
      children: [
        {
          type: 'element',
          tag: 'button',
          passthrough: true,
          attributes: {
            'aria-describedby': { $expression: 'hintId' },
            'aria-controls': 'menu',
            title: 'Hint',
          },
          conditionalAttributes: [
            { condition: 'expanded', attributes: { 'aria-details': 'more' } },
          ],
        },
      ],
    };
    const runes = process(template, {
      extensions: [svelte({ mode: 'runes' })],
    }).files[0].content;
    expect(runes).toContain(
      "aria-describedby={authoredAndConsumer(hintId, restProperties, 'aria-describedby')}"
    );
    expect(runes).toContain(
      "aria-controls={authoredAndConsumer('menu', restProperties, 'aria-controls')}"
    );
    expect(runes).toContain(
      "aria-details={authoredAndConsumer(expanded ? 'more' : undefined, restProperties, 'aria-details')}"
    );
    // Only an id list joins; another attribute wins.
    expect(runes).toContain('title="Hint"');
    const legacy = fileContent(template);
    expect(legacy).toContain(
      "aria-describedby={authoredAndConsumer(hintId, $$restProps, 'aria-describedby')}"
    );
    expect(legacy).toContain('function authoredAndConsumer(');
  });

  it('emits the stylesheet without an import under stylesheetLink none', () => {
    const template: Template = [
      {
        type: 'element',
        tag: 'div',
        attributes: { class: ['card'], style: { color: 'red' } },
        children: [{ type: 'text', content: 'Hi' }],
      },
    ];
    for (const mode of ['legacy', 'runes'] as const) {
      const result = process(template, {
        extensions: [svelte({ mode })],
        styling: { placement: 'separate-file', stylesheetLink: 'none' },
      });
      expect(result.files.map((file) => file.path)).toEqual([
        'Component.svelte',
        'Component.css',
      ]);
      expect(result.files[0].content).not.toContain('import');
      expect(result.files[1].content).toContain('.card {');
    }
  });

  it('reads an unset indeterminate on an input as false, an element of another tag as authored', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'input',
        attributes: { indeterminate: { $expression: 'mixed' } },
      },
      {
        type: 'element',
        tag: { $expression: 'as', default: 'input' },
        attributes: { indeterminate: { $expression: 'a || b' } },
      },
      {
        type: 'element',
        tag: 'my-box',
        attributes: { indeterminate: { $expression: 'mixed' } },
      },
    ]);
    expect(content).toContain('<input indeterminate={mixed ?? false}');
    expect(content).toContain('indeterminate={(a || b) ?? false}');
    expect(content).toContain('<my-box indeterminate={mixed}');
  });

  it.each([
    "x === 'mixed'",
    "x !== 'a?b'",
    'count > 0',
    'count <= limit',
    "'key' in record",
    'x instanceof Thing',
    'a?.b === c',
    '!x',
    '!(a || b)',
    'true',
    'false',
    'Boolean(x)',
    'Boolean(a ?? b)',
    'typeof x === "string"',
    "(x === 'mixed')",
    "((x === 'mixed'))",
    '( !x )',
    '(true)',
    '(Boolean(x))',
    '(a) === (b)',
    "(x === ')')",
  ])('leaves ?? false off %s, which cannot be nullish', (expression) => {
    const content = fileContent(boundIndeterminate(expression));
    expect(content).toContain(`indeterminate={${expression}}`);
  });

  it.each([
    'x',
    'a.b',
    '(x)',
    '(x ? a === b : false)',
    '(a) ?? (b)',
    "x ? y === 'a' : false",
    "x && y === 'a'",
    "x || y === 'a'",
    "x ?? y === 'a'",
    'a === b, c',
    'read<Flag>(key)',
    'value as Array<string>',
    '/a<b/.exec(x)',
    "`${a === b}`",
    "x['a === b']",
    "'a === b'",
    'Boolean(x).valueOf()',
    'Boolean(a)(b)',
    'x = y === z',
    '() => x === y',
    'compute(a === b)',
  ])('keeps ?? false on %s, which may be nullish', (expression) => {
    const content = fileContent(boundIndeterminate(expression));
    expect(content).toMatch(/indeterminate=\{.* \?\? false\}/);
  });

  it('names the output file after the component', () => {
    const result = processWithSvelte({
      type: 'component',
      name: 'Button',
      children: [
        { type: 'element', tag: 'button', children: [{ type: 'text', content: 'Save' }] },
      ],
    });
    expect(result.files.map((file) => file.path)).toEqual(['Button.svelte']);
  });

  it('emits a typed script block with export let prop declarations', () => {
    const content = fileContent({
      type: 'component',
      name: 'Button',
      props: {
        label: { type: 'string', required: true },
        variant: { type: "'primary' | 'secondary'", default: 'primary' },
      },
      children: [
        {
          type: 'element',
          tag: 'button',
          children: [{ type: 'text', expression: 'label' }],
        },
      ],
    });
    expect(content).toContain('<script lang="ts">');
    expect(content).toContain('export let label: string;');
    expect(content).toContain(
      "export let variant: 'primary' | 'secondary' = 'primary';"
    );
  });

  it('renders conditionals as if blocks with else clauses', () => {
    const content = fileContent([
      {
        type: 'conditional',
        conditions: [
          {
            statement: 'if',
            condition: 'isVisible',
            children: [
              { type: 'element', tag: 'p', children: [{ type: 'text', content: 'Hi' }] },
            ],
          },
          {
            statement: 'else',
            children: [
              { type: 'element', tag: 'p', children: [{ type: 'text', content: 'Bye' }] },
            ],
          },
        ],
      },
    ]);
    expect(content).toContain('{#if isVisible}');
    expect(content).toContain('{:else}');
    expect(content).toContain('{/if}');
  });

  it('renders iterations as each blocks with a key and warns when the key is missing', () => {
    const keyed = fileContent([
      {
        type: 'element',
        tag: 'ul',
        children: [
          {
            type: 'iteration',
            items: 'props.users',
            item: 'user',
            index: 'i',
            key: 'user.id',
            children: [
              {
                type: 'element',
                tag: 'li',
                children: [{ type: 'text', expression: 'user.name' }],
              },
            ],
          },
        ],
      },
    ]);
    expect(keyed).toContain('{#each props.users as user, i (user.id)}');

    const result = processWithSvelte([
      {
        type: 'element',
        tag: 'ul',
        children: [
          {
            type: 'iteration',
            items: 'props.items',
            item: 'item',
            children: [
              {
                type: 'element',
                tag: 'li',
                children: [{ type: 'text', expression: 'item.label' }],
              },
            ],
          },
        ],
      },
    ]);
    expect(result.files[0].content).toContain('{#each props.items as item}');
    expect(result.warnings).toEqual([
      expect.objectContaining({
        message: expect.stringContaining("no 'key' expression"),
      }),
    ]);
  });

  it('renders named and default slots with fallback content', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'div',
        children: [
          {
            type: 'slot',
            name: 'header',
            fallback: [
              { type: 'element', tag: 'h2', children: [{ type: 'text', content: 'Title' }] },
            ],
          },
          { type: 'slot', fallback: [{ type: 'text', content: 'Body' }] },
        ],
      },
    ]);
    // Siblings break inside a tag, so no whitespace between them renders.
    expect(content).toContain('<slot name="header"><h2>Title</h2></slot\n  ><slot>Body</slot>');
  });

  it('binds expression attributes and renders class directives for conditional classes', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'button',
        attributes: {
          class: ['btn'],
          type: 'button',
          'data-id': { $expression: 'id' },
        },
        conditionalAttributes: [
          { condition: "size === 'large'", attributes: { class: ['btn--lg'] } },
        ],
        children: [{ type: 'text', content: 'Save' }],
      },
    ]);
    expect(content).toContain('class="btn"');
    expect(content).toContain(`class:btn--lg={size === 'large'}`);
    expect(content).toContain('data-id={id}');
  });

  it('keeps braces in static text literal instead of starting an expression', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'p',
        children: [
          { type: 'text', content: 'Use {count} as a placeholder' },
        ],
      },
    ]);
    expect(content).toContain('Use &#123;count} as a placeholder');
  });

  it('renders plain style properties as a style attribute under inline styling', () => {
    const content = fileContent(
      [
        {
          type: 'element',
          tag: 'div',
          attributes: {
            style: { backgroundColor: 'blue', 'font-size': '16px' },
          },
          children: [{ type: 'text', content: 'Styled' }],
        },
      ],
      { styling: { placement: 'inline' } }
    );
    expect(content).toContain('style="background-color: blue; font-size: 16px"');
    expect(content).not.toContain('<style>');
  });

  it('drops a nullish entry from the generated whole-object style serializer', () => {
    // The helper's TEXT is pinned byte-for-byte by the goldens; what this
    // asserts is what it DOES, by running it. A property whose runtime value is
    // nullish is omitted rather than serialized - React
    // and Vue both omit it, and without the filter it reaches the declaration as
    // the string `undefined`, which a custom property stores as a valid value
    // and every `var()` reading it downstream then resolves to that literal.
    const content = fileContent([
      {
        type: 'element',
        tag: 'div',
        attributes: { style: { $expression: 'computeStyle(direction)' } },
      },
    ]);

    const declaration = /function serializeStyleObject\([\s\S]*?\n}/.exec(content);
    expect(declaration).not.toBeNull();
    const serialize = new Function(
      `${declaration![0].replace(/styleObject:[\s\S]*?\): string \{/, 'styleObject) {')}\nreturn serializeStyleObject;`
    )() as (styleObject: unknown) => string;

    expect(serialize({ '--justify': undefined })).toBe('');
    expect(serialize({ '--justify': null, '--align': 'stretch' })).toBe('--align: stretch');
    expect(serialize({ marginTop: 0, opacity: 0 })).toBe('margin-top: 0; opacity: 0');
    // A custom property name is case-sensitive; a capital in it is not a word boundary.
    expect(serialize({ '--kit-component--Badge--size': '1rem' })).toBe('--kit-component--Badge--size: 1rem');
    // A consumer's style is a string in Svelte: it passes through, and an
    // array serializes each entry in order, so a later one wins.
    expect(serialize('color: red;')).toBe('color: red');
    expect(serialize([{ gap: '1rem' }, null, '', 'gap: 2rem'])).toBe('gap: 1rem; gap: 2rem');
  });

  it("lets the consumer's style win over a passthrough root's style directives", () => {
    for (const mode of ['legacy', 'runes'] as const) {
      const content = process(
        {
          type: 'component',
          name: 'Swatch',
          props: { size: { type: 'string' } },
          children: [
            {
              type: 'element',
              tag: 'span',
              passthrough: true,
              attributes: { style: { '--swatch-size': { $expression: 'size' }, fontSize: { $expression: "size + 'px'" } } },
            },
          ],
        },
        { extensions: [svelte({ mode })] }
      ).files[0].content;
      // A directive outranks the style attribute, so it takes the consumer's value.
      expect(content).toContain("style:--swatch-size={consumerStyleValue(style, '--swatch-size') ?? size}");
      expect(content).toContain("style:font-size={consumerStyleValue(style, 'font-size') ?? (size + 'px')}");
      expect(content).toContain('style={style}');
      const declaration = /function consumerStyleValue\([\s\S]*?\n}/.exec(content);
      const read = new Function(
        `${ts.transpile(declaration![0])}\nreturn consumerStyleValue;`
      )() as (style: unknown, property: string) => string | undefined;
      expect(read('--swatch-size: 3rem; font-size: 9px !important;', '--swatch-size')).toBe('3rem');
      expect(read('FONT-SIZE: 9px !important', 'font-size')).toBe('9px');
      expect(read('--Swatch-size: 3rem', '--swatch-size')).toBeUndefined();
      expect(read('color: red; color: blue', 'color')).toBe('blue');
      expect(read({ fontSize: 12, '--swatch-size': null }, 'font-size')).toBe('12');
      expect(read({ '--swatch-size': null }, '--swatch-size')).toBeUndefined();
      expect(read(undefined, 'color')).toBeUndefined();
      expect(read('background: url(a:b); color', 'background')).toBe('url(a:b)');
      // A `;` inside quotes or parentheses does not end the declaration.
      expect(read('--icon: url("data:image/svg+xml;utf8,<svg/>"); color: red', '--icon')).toBe(
        'url("data:image/svg+xml;utf8,<svg/>")'
      );
      expect(read('--label: "a;b"; color: red', '--label')).toBe('"a;b"');
      expect(read("--label: 'a\\';b'; color: red", 'color')).toBe('red');
    }
  });

  it("lets the consumer's style win over a rest node's style directives while the spread's style stays", () => {
    const restNode = (style: Record<string, unknown>, override?: Record<string, unknown>): Template => ({
      type: 'component',
      name: 'Stack',
      rest: { tag: 'div' },
      props: { gap: { type: 'string' } },
      children: [
        {
          type: 'element',
          tag: 'div',
          attributes: { $spread: { $expression: 'rest' }, style: style as never },
          ...(override ? { extensions: { svelte: { attributes: { style: override as never } } } } : {}),
        },
      ],
    });
    for (const mode of ['legacy', 'runes'] as const) {
      const render = (template: Template, placement?: 'inline'): string =>
        process(template, { extensions: [svelte({ mode })], ...(placement ? { styling: { placement } } : {}) })
          .files[0].content;
      const directive = "style:--gap={consumerStyleValue(rest.style, '--gap') ?? gap}";
      // No own style attribute: the spread's carries the consumer's.
      expect(render(restNode({ '--gap': { $expression: 'gap' } }))).toContain(directive);
      // An own attribute reading rest.style keeps it too.
      expect(
        render(restNode({}, { '--gap': { $expression: 'gap' }, $expression: '[{ display: "flex" }, rest.style]' }))
      ).toContain(directive);
      // Under `inline`, an override's static declarations come before its
      // expression carrying the consumer's style.
      expect(
        render(restNode({}, { display: 'flex', $expression: '[{ gap }, rest.style]' }), 'inline')
      ).toContain('style="display: flex; {serializeStyleObject([{ gap }, rest.style])}"');
      // An own inline attribute replaces it, so the directive stays the node's.
      const replaced = render(restNode({ display: 'flex', '--gap': { $expression: 'gap' } }), 'inline');
      expect(replaced).toContain('style:--gap={gap}');
      expect(replaced).not.toContain('consumerStyleValue');
    }
  });

  it('keeps nested-selector styles in the style block under inline styling', () => {
    const content = fileContent(
      [
        {
          type: 'element',
          tag: 'span',
          attributes: { style: { color: 'gray', ':hover': { color: 'black' } } },
          children: [{ type: 'text', content: 'Hover' }],
        },
      ],
      { styling: { placement: 'inline' } }
    );
    expect(content).toContain('data-jte-node="Component-0"');
    expect(content).toContain('[data-jte-node="Component-0"]:hover');
  });

  it('emits a sibling stylesheet imported from the script under separate-file styling', () => {
    const result = processWithSvelte(
      {
        type: 'component',
        name: 'Box',
        style: '.box {\n  color: red;\n}',
        children: [
          {
            type: 'element',
            tag: 'div',
            attributes: { class: ['box'] },
            children: [{ type: 'text', content: 'Hi' }],
          },
        ],
      },
      { styling: { placement: 'separate-file' } }
    );
    expect(result.files.map((file) => file.path)).toEqual([
      'Box.svelte',
      'Box.css',
    ]);
    expect(result.files[0].content).toContain("import './Box.css';");
    expect(result.files[0].content).not.toContain('<style>');
    expect(result.files[1].content).toBe('.box {\n  color: red;\n}\n');
  });

  it('lets node-level svelte overrides win, carrying raw bind: attributes', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'input',
        attributes: { type: 'text' },
        events: [{ name: 'input', handler: 'genericHandler' }],
        extensions: {
          svelte: {
            attributes: { 'bind:value': { $expression: 'name' } },
            events: [{ name: 'input', handler: 'svelteHandler' }],
          },
        },
      },
    ]);
    expect(content).toContain('bind:value={name}');
    expect(content).toContain('on:input={svelteHandler}');
    expect(content).not.toContain('genericHandler');
  });

  it('removes every class, the BEM runtime call included, for a null class override', () => {
    const content = process(
      {
          type: 'component',
          name: 'Badge',
          children: [
            {
              type: 'element',
              tag: 'span',
              attributes: { class: ['own'] },
              extensions: { svelte: { attributes: { class: null } } },
              children: [{ type: 'text', content: 'New' }],
            },
          ],
        },
      { extensions: [svelte(), runtimeBem] }
    ).files[0].content;
    expect(content).toContain('<span>New</span>');
    expect(content).not.toContain('bem(');
  });

  it('removes the condition-gated classes with a null class override, keeping the entries\' other attributes', () => {
    for (const target of [svelte(), svelte({ mode: 'runes' })]) {
      const content = process(
        {
          type: 'component',
          name: 'Badge',
          props: { open: { type: 'boolean' } },
          children: [
            {
              type: 'element',
              tag: 'span',
              attributes: { class: ['own'] },
              conditionalAttributes: [
                {
                  condition: 'open',
                  attributes: {
                    class: ['Badge--open', 'own--open'],
                    'aria-expanded': { $expression: 'open' },
                  },
                },
              ],
              extensions: { svelte: { attributes: { class: null } } },
              children: [{ type: 'text', content: 'New' }],
            },
          ],
        },
        { extensions: [target, runtimeBem] }
      ).files[0].content;
      expect(content).not.toContain('class');
      expect(content).not.toContain('--open');
      expect(content).not.toContain('bem(');
      expect(content).toContain('aria-expanded=');
    }
  });

  it('emits no BEM setup once a null class override removes every runtime call', () => {
    const render = (target: ReturnType<typeof svelte>, keepOne: boolean) =>
      process(
        {
          type: 'component',
          name: 'Badge',
          children: [
            {
              type: 'element',
              tag: 'span',
              extensions: { svelte: { attributes: { class: null } } },
              children: [{ type: 'text', content: 'New' }],
            },
            {
              type: 'element',
              tag: 'span',
              ...(keepOne
                ? {}
                : { extensions: { svelte: { attributes: { class: null } } } }),
              children: [{ type: 'text', content: 'Old' }],
            },
          ],
        },
        { extensions: [target, runtimeBem] }
      ).files[0].content;
    for (const target of [svelte(), svelte({ mode: 'runes' })]) {
      const removed = render(target, false);
      expect(removed).not.toContain('createBem');
      expect(removed).not.toContain('const bem');
      const kept = render(target, true);
      expect(kept).toContain('import { createBem }');
      expect(kept).toContain("const bem = createBem('Badge')");
    }
  });

  it('removes a node attribute the svelte override sets to null', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'input',
        attributes: { type: 'checkbox', title: 'All', name: 'all' },
        extensions: { svelte: { attributes: { title: null } } },
      },
    ]);
    expect(content).toContain('<input type="checkbox" name="all" />');
  });

  it('lets a node-level svelte tag override replace the element with a component reference', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'div',
        attributes: { class: 'wrapper' },
        extensions: { svelte: { tag: 'Modal' } },
        children: [{ type: 'text', content: 'x' }],
      },
    ]);
    expect(content).toContain('<Modal class="wrapper">');
    expect(content).toContain('</Modal>');
    expect(content).not.toContain('<div');
  });

  it('applies a component-level svelte override (style replace)', () => {
    const content = fileContent({
      type: 'component',
      name: 'Alert',
      style: '.alert {\n  border: 1px solid;\n}',
      children: [
        {
          type: 'element',
          tag: 'div',
          attributes: { class: ['alert'] },
          children: [{ type: 'text', content: 'Hi' }],
        },
      ],
      extensions: {
        svelte: { style: '.alert {\n  border: 2px dashed;\n}', styleStrategy: 'replace' },
      },
    });
    expect(content).toContain('border: 2px dashed;');
    expect(content).not.toContain('border: 1px solid;');
  });

  describe('per-mode component overrides', () => {
    const counter = (svelteOverride: Record<string, unknown>): Template => ({
      type: 'component',
      name: 'Counter',
      props: { count: { type: 'number', default: 0 } },
      script: '// shared',
      children: [{ type: 'text', expression: 'doubled' }],
      extensions: { svelte: svelteOverride },
    });
    const render = (template: Template, mode: 'legacy' | 'runes') =>
      process(template, { extensions: [svelte({ mode })] });

    it('applies only the block for the emitted mode, after the shared keys', () => {
      const template = counter({
        script: '// svelte',
        legacy: { script: '$: doubled = count * 2;' },
        runes: { script: 'const doubled = $derived(count * 2);' },
      });
      const legacy = render(template, 'legacy');
      const runes = render(template, 'runes');
      expect(legacy.warnings).toEqual([]);
      expect(runes.warnings).toEqual([]);
      expect(legacy.files[0].content).toContain(
        '// shared\n\n// svelte\n\n$: doubled = count * 2;'
      );
      expect(legacy.files[0].content).not.toContain('$derived');
      expect(runes.files[0].content).toContain(
        '// shared\n\n// svelte\n\nconst doubled = $derived(count * 2);'
      );
      expect(runes.files[0].content).not.toContain('$:');
    });

    it('takes the shared strategies and the other shared keys', () => {
      const template = counter({
        runes: {
          script: 'const doubled = $derived(count * 2);',
          scriptStrategy: 'replace',
          imports: ["import { untrack } from 'svelte';"],
        },
      });
      const runes = render(template, 'runes').files[0].content;
      expect(runes).not.toContain('// shared');
      expect(runes).toContain("import { untrack } from 'svelte';");
      const legacy = render(template, 'legacy').files[0].content;
      expect(legacy).toContain('// shared');
      expect(legacy).not.toContain('untrack');
    });

    it('rejects a malformed mode block in either mode, naming its path', () => {
      const template = counter({ runes: { script: 42 } });
      for (const mode of ['legacy', 'runes'] as const) {
        expect(() => render(template, mode)).toThrow(TemplateError);
        expect(() => render(template, mode)).toThrow(
          "An override's script must be a string; got number 42 (at extensions.svelte.runes.script)"
        );
      }
      expect(() => render(counter({ legacy: 'x' }), 'runes')).toThrow(
        "A component's extension override must be an object; got the string 'x' (at extensions.svelte.legacy)"
      );
    });

    it('accepts the mode blocks as override keys and warns about a key a block does not read', () => {
      const result = render(
        counter({
          legacy: { script: '$: doubled = count * 2;', scoped: true },
        }),
        'legacy'
      );
      expect(result.warnings).toEqual([
        {
          message: expect.stringContaining(
            "The svelte legacy override has no 'scoped' key"
          ),
          nodePath: 'extensions.svelte.legacy.scoped',
        },
      ]);
    });

    it('applies style, props and propsStrategy from a mode block', () => {
      const template: Template = {
        ...counter({
          runes: {
            style: '.counter {\n  color: red;\n}',
            props: { step: { type: 'number', default: 1 } },
            propsStrategy: 'replace',
            script: 'const doubled = $derived(step * 2);',
          },
          legacy: { script: '$: doubled = count * 2;' },
        }),
        style: '.counter {\n  color: blue;\n}',
      };
      const runes = render(template, 'runes').files[0].content;
      expect(runes).toContain('step?: number | undefined;');
      expect(runes).not.toContain('count?:');
      expect(runes).toContain('color: blue;');
      expect(runes).toContain('color: red;');
      const legacy = render(template, 'legacy').files[0].content;
      expect(legacy).toContain('export let count: number = 0;');
      expect(legacy).not.toContain('step');
      expect(legacy).not.toContain('color: red;');
    });

    it('merges a mode block onto a shared replace', () => {
      const runes = render(
        counter({
          script: '// svelte',
          scriptStrategy: 'replace',
          runes: { script: 'const doubled = $derived(count * 2);' },
        }),
        'runes'
      ).files[0].content;
      expect(runes).not.toContain('// shared');
      expect(runes).toContain(
        '// svelte\n\nconst doubled = $derived(count * 2);'
      );
    });

    it('sees a component a mode block imports when checking references', () => {
      const template: Template = {
        type: 'component',
        name: 'Labeled',
        children: [{ type: 'element', tag: 'Icon' }],
        extensions: {
          svelte: {
            runes: { imports: ["import Icon from './Icon.svelte';"] },
          },
        },
      };
      expect(render(template, 'runes').warnings).toEqual([]);
      expect(render(template, 'legacy').warnings).toEqual([
        {
          message: expect.stringContaining('<Icon> is not in scope'),
          nodePath: expect.any(String),
        },
      ]);
    });
  });

  describe('runes mode', () => {
    function runesContent(
      template: Template,
      options: Parameters<typeof process>[1] = {}
    ) {
      return process(template, {
        ...options,
        extensions: [svelte({ mode: 'runes' })],
      }).files[0].content;
    }

    it('emits legacy output byte-identically for the default and explicit legacy modes', () => {
      const template: Template = {
        type: 'component',
        name: 'Button',
        props: { label: { type: 'string', required: true } },
        children: [
          {
            type: 'element',
            tag: 'button',
            events: [{ name: 'click', handler: 'handleClick' }],
            children: [
              { type: 'slot', fallback: [{ type: 'text', expression: 'label' }] },
            ],
          },
        ],
      };
      const defaultMode = processWithSvelte(template).files[0].content;
      const explicitLegacy = process(template, {
        extensions: [svelte({ mode: 'legacy' })],
      }).files[0].content;
      expect(explicitLegacy).toBe(defaultMode);
      expect(defaultMode).toContain('export let label: string;');
      expect(defaultMode).toContain('on:click={handleClick}');
      expect(defaultMode).toContain('<slot>{label}</slot>');
    });

    it('declares props as a typed interface destructured from $props()', () => {
      const content = runesContent({
        type: 'component',
        name: 'Button',
        props: {
          label: { type: 'string', required: true },
          variant: { type: "'primary' | 'secondary'", default: 'primary' },
          pressed: { type: 'boolean' },
        },
        children: [
          {
            type: 'element',
            tag: 'button',
            children: [{ type: 'text', expression: 'label' }],
          },
        ],
      });
      expect(content).toContain(
        [
          'interface Props {',
          '  label: string;',
          "  variant?: 'primary' | 'secondary' | undefined;",
          '  pressed?: boolean | undefined;',
          '}',
        ].join('\n')
      );
      expect(content).toContain(
        "let { label, variant = 'primary', pressed = undefined }: Props = $props();"
      );
      expect(content).not.toContain('export let');
      expect(content).not.toContain('<svelte:options');
    });

    it('renders the passthrough contract with restProperties, a bindable element, and the tag surface', () => {
      const content = runesContent({
        type: 'component',
        name: 'Surface',
        props: { label: { type: 'string', required: true } },
        children: [
          {
            type: 'element',
            tag: 'div',
            passthrough: true,
            attributes: { class: ['surface'] },
            children: [{ type: 'text', expression: 'label' }],
          },
        ],
      });
      expect(content).toContain(
        "import type { SvelteHTMLElements } from 'svelte/elements';"
      );
      expect(content).toContain(
        [
          "type Props = Omit<SvelteHTMLElements['div'], 'label' | 'children'> & {",
          '  label: string;',
          '  class?: string | undefined;',
          '  style?: string | undefined;',
          "  element?: HTMLElementTagNameMap['div'] | undefined;",
          '};',
        ].join('\n')
      );
      expect(content).toContain('class: className = undefined,');
      expect(content).toContain('element = $bindable(undefined),');
      expect(content).toContain('...restProperties');
      expect(content).toContain('{...restProperties}');
      expect(content).not.toContain('$$restProps');
      expect(content).toContain("class=\"surface{className ? ' ' + className : ''}\"");
      expect(content).toContain('style={style}');
      expect(content).toContain('bind:this={element}');
    });

    it('types a dynamic-root passthrough against its default tag, its element by namespace', () => {
      const content = runesContent({
        type: 'component',
        name: 'Clickable',
        props: { as: { type: "'button' | 'a'", default: 'button' } },
        children: [
          {
            type: 'element',
            tag: { $expression: 'as', default: 'button' },
            passthrough: true,
            children: [{ type: 'text', content: 'Go' }],
          },
        ],
      });
      expect(content).toContain(
        "import type { SvelteHTMLElements } from 'svelte/elements';"
      );
      expect(content).toContain("type Props = Omit<SvelteHTMLElements['button'], 'as' | 'children'> & {");
      expect(content).toContain('  element?: HTMLElement | undefined;');
      expect(content).toContain('<svelte:element');
      expect(content).toContain('this={as}');
      expect(content).toContain('{...restProperties}');
    });

    it('renders a default slot as an optional-chained render tag with a Snippet prop', () => {
      const content = runesContent([
        { type: 'element', tag: 'div', children: [{ type: 'slot' }] },
      ]);
      expect(content).toContain("import type { Snippet } from 'svelte';");
      expect(content).toContain('children?: Snippet | undefined;');
      expect(content).toContain('let { children }: Props = $props();');
      expect(content).toContain('{@render children?.()}');
      expect(content).not.toContain('<slot');
      expect(content).not.toContain('<svelte:options');
    });

    it('guards a slot with fallback content behind an if block', () => {
      const content = runesContent([
        {
          type: 'element',
          tag: 'div',
          children: [
            {
              type: 'slot',
              name: 'header',
              fallback: [
                {
                  type: 'element',
                  tag: 'h2',
                  children: [{ type: 'text', content: 'Title' }],
                },
              ],
            },
            { type: 'slot', fallback: [{ type: 'text', content: 'Body' }] },
          ],
        },
      ]);
      expect(content).toContain(
        [
          '  {#if header}',
          '    {@render header()}',
          '  {:else}',
          '    <h2>Title</h2>',
          '  {/if}{#if children}',
          '    {@render children()}',
          '  {:else}',
          '    Body',
          '  {/if}',
        ].join('\n')
      );
      expect(content).toContain('header?: Snippet | undefined;');
      expect(content).toContain('children?: Snippet | undefined;');
    });

    it('bundles a scoped slot’s exposed bindings into one snippet argument', () => {
      const content = runesContent({
        type: 'component',
        name: 'Disclosure',
        script: "const api = { open: false };\nconst state = 'idle';",
        children: [
          {
            type: 'element',
            tag: 'div',
            children: [
              {
                type: 'slot',
                exposes: {
                  api: 'api',
                  state: { value: 'state', type: 'string' },
                },
                fallback: [{ type: 'text', content: 'Nothing projected' }],
              },
            ],
          },
        ],
      });
      expect(content).toContain('children?: Snippet<[{ api: any; state: string }]> | undefined;');
      expect(content).toContain('{@render children({ api, state })}');
      expect(content).toContain("const api = { open: false };");
    });

    it('wraps scoped consumer children in an explicit children snippet', () => {
      const content = runesContent({
        type: 'component',
        name: 'DisclosurePanel',
        extensions: {
          svelte: { imports: ["import Disclosure from './Disclosure.svelte';"] },
        },
        children: [
          {
            type: 'element',
            tag: 'Disclosure',
            slotScope: ['api'],
            children: [
              {
                type: 'element',
                tag: 'Panel',
                attributes: { $spread: { $expression: 'api.panelProps' } },
                children: [{ type: 'text', content: 'Body' }],
              },
            ],
          },
        ],
      });
      expect(content).toContain(
        [
          '<Disclosure>',
          '  {#snippet children({ api })}',
          '    <Panel {...api.panelProps}>Body</Panel>',
          '  {/snippet}',
          '</Disclosure>',
        ].join('\n')
      );
      expect(content).not.toContain('let:api');
      // A snippet-only consumer carries no rune, so the file opts in.
      expect(content).toContain('<svelte:options runes={true} />');
    });

    it('projects named slots into a composed component as snippet declarations', () => {
      const content = runesContent([
        {
          type: 'element',
          tag: 'ModalVisual',
          slots: {
            closeButton: [
              {
                type: 'element',
                tag: 'button',
                children: [{ type: 'text', content: 'Close' }],
              },
            ],
            actions: {
              content: [{ type: 'text', expression: 'rowProps.label' }],
              slotScope: ['rowProps'],
            },
          },
          children: [{ type: 'text', content: 'Body' }],
        },
      ]);
      expect(content).toContain(
        [
          '<ModalVisual>',
          '  Body',
          '  {#snippet closeButton()}',
          '    <button>Close</button>',
          '  {/snippet}',
          '  {#snippet actions({ rowProps })}',
          '    {rowProps.label}',
          '  {/snippet}',
          '</ModalVisual>',
        ].join('\n')
      );
      expect(content).not.toContain('svelte:fragment');
    });

    it('aliases a slot prop forwarded into a same-named projected snippet', () => {
      // The composer's own `icon` slot - with a fallback - projected into a
      // composed child's `icon` slot. The `{#snippet icon()}` declaration is
      // a lexical binding, so an unaliased guard inside its body would test
      // and render the snippet itself: an infinite recursion at runtime.
      const content = runesContent({
        type: 'component',
        name: 'Button',
        children: [
          {
            type: 'element',
            tag: 'button',
            conditionalAttributes: [
              { condition: 'icon', attributes: { class: ['button--with-icon'] } },
            ],
            children: [
              {
                type: 'element',
                tag: 'IconLabel',
                slots: {
                  icon: [
                    {
                      type: 'slot',
                      name: 'icon',
                      fallback: [
                        {
                          type: 'element',
                          tag: 'span',
                          children: [{ type: 'text', content: 'Fallback' }],
                        },
                      ],
                    },
                  ],
                },
                children: [{ type: 'text', content: 'Label' }],
              },
            ],
          },
        ],
      });
      // The prop keeps its public name and destructures under the alias.
      expect(content).toContain('  icon?: Snippet | undefined;');
      expect(content).toContain('let { icon: iconSlot }: Props = $props();');
      // The projected snippet keeps the child's slot name; its body guards on
      // and renders the alias, never the snippet's own binding.
      expect(content).toContain(
        [
          '    {#snippet icon()}',
          '      {#if iconSlot}',
          '        {@render iconSlot()}',
          '      {:else}',
          '        <span>Fallback</span>',
          '      {/if}',
          '    {/snippet}',
        ].join('\n')
      );
      // Slot-presence checks read the alias too.
      expect(content).toContain('class:button--with-icon={iconSlot !== undefined}');
      expect(content).not.toContain('{@render icon(');
      expect(content).not.toContain('{#if icon}');
    });

    it('resolves slot presence to a snippet-prop undefined check', () => {
      const content = runesContent({
        type: 'component',
        name: 'Field',
        props: { pressed: { type: 'boolean' } },
        children: [
          {
            type: 'conditional',
            conditions: [
              {
                statement: 'if',
                condition: 'icon',
                children: [{ type: 'slot', name: 'icon' }],
              },
            ],
          },
          {
            type: 'conditional',
            conditions: [
              {
                statement: 'if',
                condition: 'icon && pressed',
                children: [{ type: 'text', content: 'both' }],
              },
            ],
          },
        ],
      });
      expect(content).toContain('{#if icon !== undefined}');
      expect(content).toContain('{#if (icon !== undefined) && pressed}');
      expect(content).not.toContain('$$slots');
    });

    it('parenthesizes a negated slot presence in conditional attributes', () => {
      const content = runesContent([
        {
          type: 'element',
          tag: 'button',
          conditionalAttributes: [
            { condition: '!icon', attributes: { class: ['text-only'] } },
          ],
          children: [
            { type: 'slot', name: 'icon' },
            { type: 'slot' },
          ],
        },
      ]);
      expect(content).toContain('class:text-only={!(icon !== undefined)}');
    });

    it('renders event modifiers as attributes with generated wrappers and helpers', () => {
      const content = runesContent([
        {
          type: 'element',
          tag: 'form',
          events: [
            { name: 'submit', handler: 'handleSubmit', modifiers: ['prevent'] },
          ],
          children: [
            {
              type: 'element',
              tag: 'button',
              attributes: { type: 'submit' },
              events: [
                {
                  name: 'click',
                  handler: 'trackClick',
                  modifiers: ['stop', 'once'],
                },
              ],
              children: [{ type: 'text', content: 'Send' }],
            },
          ],
        },
      ]);
      expect(content).toContain(
        'onsubmit={(event) => { event.preventDefault(); invokeHandler(handleSubmit, event); }}'
      );
      expect(content).toContain(
        'onclick={once((event) => { event.stopPropagation(); invokeHandler(trackClick, event); })}'
      );
      expect(content).toContain('function once<EventType extends Event>(');
      expect(content).not.toContain('on:');
      // The generated helper is no rune, so the file still opts in.
      expect(content).toContain('<svelte:options runes={true} />');
    });

    it('imports on from svelte/events for a passive attachment', () => {
      const content = runesContent([
        {
          type: 'element',
          tag: 'div',
          events: [
            { name: 'wheel', handler: 'handleWheel', modifiers: ['passive'] },
          ],
          children: [{ type: 'text', content: 'Scrollable' }],
        },
      ]);
      expect(content).toContain("import { on } from 'svelte/events';");
      expect(content).toContain(
        "{@attach (listenerElement) => on(listenerElement, 'wheel', handleWheel, { passive: true })}"
      );
    });

    it('opts a rune-less file into runes mode through svelte:options', () => {
      const content = runesContent([
        {
          type: 'element',
          tag: 'ul',
          children: [
            {
              type: 'iteration',
              items: 'props.users',
              item: 'user',
              key: 'user.id',
              children: [
                {
                  type: 'element',
                  tag: 'li',
                  children: [{ type: 'text', expression: 'user.name' }],
                },
              ],
            },
          ],
        },
      ]);
      expect(content.startsWith('<svelte:options runes={true} />\n')).toBe(true);
    });

    it('omits svelte:options when $props() is emitted', () => {
      const content = runesContent({
        type: 'component',
        name: 'Label',
        props: { text: { type: 'string', required: true } },
        children: [
          {
            type: 'element',
            tag: 'span',
            children: [{ type: 'text', expression: 'text' }],
          },
        ],
      });
      expect(content).toContain('$props()');
      expect(content).not.toContain('<svelte:options');
    });

    it('closes childless non-void elements explicitly and keeps void elements self-closing', () => {
      const content = runesContent([
        {
          type: 'element',
          tag: 'div',
          children: [
            { type: 'element', tag: 'span', attributes: { class: ['indicator'] } },
            { type: 'element', tag: 'img', attributes: { alt: 'Avatar' } },
            { type: 'element', tag: 'Icon' },
          ],
        },
      ]);
      expect(content).toContain(
        ['  <span class="indicator"></span', '  ><img alt="Avatar"', '  /><Icon />'].join('\n')
      );
    });

    it('keeps the BEM runtime setup beside the $props() destructure', () => {
      // A minimal styling extension in runtime mode, standing in for
      // bem({ mode: 'runtime' }) without a cross-extension dependency.
      const runtimeStyling: StylingExtension = {
        key: 'bem',
        kind: 'styling',
        classKind: 'semantic',
        runtime: {
          importSource: 'use-bem',
          elementSeparator: '__',
          modifierSeparator: '--',
          call: (element) =>
            element.tag === 'span'
              ? {
                  block: 'Badge',
                  declaresBlock: true,
                  elementName: undefined,
                  staticModifiers: [],
                  conditionalModifiers: [
                    { modifier: 'solid', condition: 'solid' },
                  ],
                  contributedClasses: ['Badge'],
                  foldedConditionalClasses: ['Badge--solid'],
                }
              : undefined,
        },
        contributeClasses: (element) =>
          element.tag === 'span' ? ['Badge'] : [],
      };
      const content = process(
        {
          type: 'component',
          name: 'Badge',
          props: { solid: { type: 'boolean' } },
          children: [
            {
              type: 'element',
              tag: 'span',
              conditionalAttributes: [
                { condition: 'solid', attributes: { class: ['Badge--solid'] } },
              ],
              children: [{ type: 'text', content: 'New' }],
            },
          ],
        },
        { extensions: [svelte({ mode: 'runes' }), runtimeStyling] }
      ).files[0].content;
      expect(content).toContain("import { createBem } from 'use-bem';");
      expect(content).toContain("const bem = createBem('Badge');");
      expect(content).toContain('class={bem(undefined, { solid: solid })}');
      expect(content).toContain('let { solid = undefined }: Props = $props();');
    });
  });

  describe('slot-presence conditions', () => {
    it('resolves slot references to $$slots across branches and inside a compound condition, leaving non-slot identifiers bare', () => {
      const content = fileContent({
        type: 'component',
        name: 'Field',
        props: { pressed: { type: 'boolean', required: false } },
        children: [
          {
            type: 'conditional',
            conditions: [
              {
                statement: 'if',
                condition: 'icon',
                children: [{ type: 'slot', name: 'icon' }],
              },
              {
                statement: 'else-if',
                condition: 'prefix',
                children: [{ type: 'slot', name: 'prefix' }],
              },
            ],
          },
          {
            type: 'conditional',
            conditions: [
              {
                statement: 'if',
                condition: 'pressed',
                children: [{ type: 'text', content: 'on' }],
              },
            ],
          },
          {
            type: 'conditional',
            conditions: [
              {
                statement: 'if',
                condition: 'icon && pressed',
                children: [{ type: 'text', content: 'both' }],
              },
            ],
          },
        ],
      });
      expect(content).toContain('{#if $$slots.icon}');
      expect(content).toContain('{:else if $$slots.prefix}');
      expect(content).toContain('{#if pressed}');
      expect(content).toContain('{#if $$slots.icon && pressed}');
    });
  });

  describe('component-valued dynamic root tag', () => {
    const componentValuedRoot = (rootExtras: Partial<ElementNode>): Template => ({
      type: 'component',
      name: 'Box',
      props: {
        as: { type: 'any' },
        color: { type: 'string' },
        on: { type: 'boolean' },
      },
      children: [
        {
          type: 'element',
          tag: { $expression: "as ?? 'button'", default: 'button', componentValued: true },
          passthrough: true,
          children: [{ type: 'text', content: 'x' }],
          ...rootExtras,
        },
      ],
    });

    it('emits a typeof branch and rewrites the custom-property style directive on the component arm', () => {
      for (const mode of ['legacy', 'runes'] as const) {
        const content = process(
          componentValuedRoot({ passthrough: undefined, attributes: { style: { '--accent': { $expression: 'color' } } } }),
          { extensions: [svelte({ mode })] }
        ).files[0].content;
        expect(content).toContain("{#if typeof RootTag === 'string'}");
        const [stringArm, componentArm] = content.split('{:else}');
        // The string arm's tag reads as an HTML tag name, so its attributes
        // type-check against the HTML elements' whatever the binding's type.
        expect(stringArm).toContain('this={RootTag as keyof HTMLElementTagNameMap}');
        expect(componentArm).not.toContain(' as ');
        // String arm keeps the element-only `style:` directive.
        expect(stringArm).toContain('style:--accent={color}');
        // Component arm rewrites it to the component CSS-var-prop form.
        expect(componentArm).toContain('--accent={color}');
        expect(componentArm).not.toContain('style:--accent');
        expect(componentArm).toMatch(mode === 'legacy' ? /<svelte:component/ : /<RootTag/);
      }
    });

    it('writes a conditional class into the class attribute on both arms of a component-valued root', () => {
      const template = componentValuedRoot({
        attributes: { class: ['box'] },
        conditionalAttributes: [{ condition: 'on', attributes: { class: ['active'] } }],
      });
      for (const mode of ['legacy', 'runes'] as const) {
        const content = process(template, { extensions: [svelte({ mode })] }).files[0].content;
        expect(content).not.toContain('class:active');
        const [stringArm, componentArm] = content.split('{:else}');
        for (const arm of [stringArm, componentArm]) {
          expect(arm).toContain(`class="box{on ? ' active' : ''}{className ? ' ' + className : ''}"`);
        }
      }
    });

    it('writes no empty class on a component-valued root whose classes are all conditional', () => {
      const template = componentValuedRoot({
        conditionalAttributes: [{ condition: 'on', attributes: { class: ['active'] } }],
      });
      for (const mode of ['legacy', 'runes'] as const) {
        const content = process(template, { extensions: [svelte({ mode })] }).files[0].content;
        expect(content.match(/class=\{\[on \? 'active' : '', className\]\.filter\(Boolean\)\.join\(' '\) \|\| undefined\}/g)).toHaveLength(2);
      }
    });

    it("passes a legacy root's events to the component arm as composed event-attribute props", () => {
      const template = componentValuedRoot({
        events: [
          { name: 'click', handler: 'toggle' },
          { name: 'keydown', handler: 'close', modifiers: ['escape', 'prevent'] },
          { name: 'focus', handler: 'track', modifiers: ['once'] },
        ],
      });
      const content = process(template, { extensions: [svelte()] }).files[0].content;
      const [stringArm, componentArm] = content.split('{:else}');
      // The element arm keeps its native directives.
      expect(stringArm).toContain('on:click={toggle}');
      expect(stringArm).toContain('on:focus|once={track}');
      // The component arm passes props a forwarding-free component still
      // receives, composed with the consumer's handlers in `$$restProps`.
      expect(componentArm).not.toContain('on:');
      expect(componentArm).toContain('onclick={composeEventHandlers($$restProps.onclick, toggle)}');
      expect(componentArm).toContain(
        "onkeydown={composeEventHandlers($$restProps.onkeydown, (event: HTMLElementEventMap['keydown']) => { if (event.key !== 'Escape') return; event.preventDefault(); invokeHandler(close, event); })}"
      );
      expect(componentArm).toContain('onfocus={composeEventHandlers($$restProps.onfocus, once(track))}');
      expect(content).toContain('function composeEventHandlers<EventType>(');
      expect(content).toContain('function once');
    });

    it('keeps class: directives on a dynamic root that is not component-valued', () => {
      const template = componentValuedRoot({
        tag: { $expression: "as ?? 'button'", default: 'button' },
        attributes: { class: ['box'] },
        conditionalAttributes: [{ condition: 'on', attributes: { class: ['active'] } }],
      });
      const content = process(template, { extensions: [svelte()] }).files[0].content;
      expect(content).toContain('class:active={on}');
    });

    it("rejects an author's own class: directive on a component-valued root", () => {
      const template = componentValuedRoot({
        extensions: { svelte: { attributes: { 'class:active': { $expression: 'on' } } } },
      });
      for (const mode of ['legacy', 'runes'] as const) {
        expect(() =>
          process(template, { extensions: [svelte({ mode })] })
        ).toThrowError(/element-only Svelte directive 'class:active'/);
      }
    });

    it('rejects a non-custom style: directive on a component-valued root', () => {
      const template = componentValuedRoot({ attributes: { style: { width: { $expression: 'color' } } } });
      for (const mode of ['legacy', 'runes'] as const) {
        expect(() =>
          process(template, { extensions: [svelte({ mode })] })
        ).toThrowError(/element-only Svelte directive 'style:width'/);
      }
    });

    it("gives a passthrough root's custom-property directive the consumer's value on both arms", () => {
      const template = componentValuedRoot({ attributes: { style: { '--accent': { $expression: 'color' } } } });
      for (const mode of ['legacy', 'runes'] as const) {
        const content = process(template, { extensions: [svelte({ mode })] }).files[0].content;
        const [stringArm, componentArm] = content.split('{:else}');
        expect(stringArm).toContain("style:--accent={consumerStyleValue(style, '--accent') ?? color}");
        expect(componentArm).toContain("--accent={consumerStyleValue(style, '--accent') ?? color}");
        expect(componentArm).not.toMatch(/style:[-\w]/);
      }
    });
  });

  it('places a svelte-ignore comment before an element, and rejects a value that is not a warning code', () => {
    const element = (ignore: string[]): Template => [
      {
        type: 'element',
        tag: 'div',
        events: [{ name: 'click', handler: 'open' }],
        extensions: { svelte: { ignore } },
      },
    ];
    expect(fileContent(element(['a11y_click_events_have_key_events', 'a11y_no_static_element_interactions']))).toContain(
      '<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions --><div on:click={open}'
    );
    expect(fileContent(element([]))).not.toContain('svelte-ignore');
    expect(() => fileContent(element(['a11y --> <script>']))).toThrowError(TemplateError);
  });
});

describe('svelte() class lists', () => {
  const modes = ['legacy', 'runes'] as const;
  function content(template: Template, mode: 'legacy' | 'runes'): string {
    return process(template, { extensions: [svelte({ mode })] }).files[0].content;
  }

  it('folds conditional classes a directive cannot carry into the class attribute', () => {
    for (const mode of modes) {
      const output = content(
        [
          {
            type: 'element',
            tag: 'button',
            attributes: { class: ['btn'] },
            conditionalAttributes: [
              {
                condition: 'open',
                attributes: {
                  class: ['md:flex', 'hover:bg-x/90', 'data-[state=open]:x', 'has-[>svg]:x'],
                },
              },
            ],
          },
          {
            type: 'element',
            tag: 'span',
            conditionalAttributes: [{ condition: 'open', attributes: { class: ['w-1/2'] } }],
          },
        ],
        mode
      );
      expect(output).toContain(
        `class="btn{open ? ' hover:bg-x/90 data-[state=open]:x has-[>svg]:x' : ''}"`
      );
      expect(output).toContain('class:md:flex={open}');
      expect(output).not.toContain('class:hover');
      expect(output).toContain(`<span class={open ? 'w-1/2' : ''}`);
    }
  });

  it('ORs the conditions of a class repeated across conditional entries', () => {
    for (const mode of modes) {
      const output = content(
        [
          {
            type: 'element',
            tag: 'button',
            attributes: { class: ['btn'] },
            conditionalAttributes: [
              { condition: "v === 'a'", attributes: { class: ['shared', 'btn'] } },
              { condition: "v === 'b'", attributes: { class: ['shared'] } },
            ],
          },
        ],
        mode
      );
      expect(output).toContain("class:shared={(v === 'a') || (v === 'b')}");
      expect(output).not.toContain('class:btn');
    }
  });

  it('evaluates a non-reference class expression once, never as a condition', () => {
    for (const mode of modes) {
      const output = content(
        [
          {
            type: 'element',
            tag: 'span',
            attributes: { class: ['switch', { $expression: "on ? 'x' : 'y'" }] },
            conditionalAttributes: [{ condition: 'big', attributes: { class: ['w-1/2'] } }],
          },
        ],
        mode
      );
      expect(output).toContain(
        "class={['switch', big ? 'w-1/2' : '', on ? 'x' : 'y'].filter(Boolean).join(' ')}"
      );
    }
  });

  it('parenthesizes a ternary condition in every ternary-test position', () => {
    for (const mode of modes) {
      const interpolated = content(
        [
          {
            type: 'element',
            tag: 'span',
            attributes: { class: ['k'] },
            conditionalAttributes: [
              { condition: 'a ? b : c', attributes: { class: ['w-1/2', 'ok'] } },
            ],
          },
        ],
        mode
      );
      expect(interpolated).toContain(`class="k{(a ? b : c) ? ' w-1/2' : ''}"`);
      expect(interpolated).toContain('class:ok={(a ? b : c)}');

      const lone = content(
        [
          {
            type: 'element',
            tag: 'span',
            conditionalAttributes: [{ condition: 'a ? b : c', attributes: { class: ['w-1/2'] } }],
          },
        ],
        mode
      );
      expect(lone).toContain("class={(a ? b : c) ? 'w-1/2' : ''}");

      const array = content(
        [
          {
            type: 'element',
            tag: 'span',
            attributes: { class: ['k', { $expression: "on ? 'x' : 'y'" }] },
            conditionalAttributes: [{ condition: 'a = b', attributes: { class: ['w-1/2'] } }],
          },
        ],
        mode
      );
      expect(array).toContain(
        "class={['k', (a = b) ? 'w-1/2' : '', on ? 'x' : 'y'].filter(Boolean).join(' ')}"
      );
    }
  });

  it('writes class names with & and quotes verbatim', () => {
    const output = content(
      [
        {
          type: 'element',
          tag: 'span',
          attributes: { class: ["[&_svg:not([class*='size-'])]:size-4", 'has-[>svg]:px-3'] },
        },
      ],
      'legacy'
    );
    expect(output).toContain(`class="[&_svg:not([class*='size-'])]:size-4 has-[>svg]:px-3"`);
  });
});

describe('legacy svelte() and a prop name that is not an identifier', () => {
  it("rejects a discriminated branch's prop at its path", () => {
    let caught: unknown;
    try {
      process(
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
                  props: { visual: { type: 'true' } },
                  children: [{ type: 'element', tag: 'div', passthrough: true }],
                },
                {
                  statement: 'else',
                  props: {
                    visual: { type: 'false' },
                    'aria-invalid': { type: 'boolean' },
                  },
                  children: [{ type: 'element', tag: 'input', passthrough: true }],
                },
              ],
            },
          ],
        },
        { extensions: [svelte()] }
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(TemplateError);
    expect((caught as TemplateError).nodePath).toBe(
      'children[0].conditions[1].props.aria-invalid'
    );
  });
});

describe('slot-scope bindings named like a named slot', () => {
  // The slot `row` beside an outer loop, a nested loop whose item is `row`,
  // and a loop inside a scoped named-slot projection whose item is `row`.
  const nestedTemplate: Template = {
    type: 'component',
    name: 'Nested',
    props: { groups: { type: 'any[]' } },
    children: [
      {
        type: 'element',
        tag: 'div',
        attributes: { 'data-has-row': { $expression: 'row !== undefined' } },
        children: [{ type: 'slot', name: 'row' }],
      },
      {
        type: 'iteration',
        items: 'groups',
        item: 'group',
        key: 'group.id',
        children: [
          {
            type: 'iteration',
            items: 'group.rows',
            item: 'row',
            key: 'row.id',
            children: [
              {
                type: 'element',
                tag: 'span',
                attributes: { title: { $expression: 'row.label' } },
              },
            ],
          },
          {
            type: 'element',
            tag: 'em',
            attributes: { 'data-outer': { $expression: 'row !== undefined' } },
          },
        ],
      },
      {
        type: 'element',
        tag: 'Table',
        slots: {
          cell: {
            slotScope: ['cell'],
            content: [
              {
                type: 'iteration',
                items: 'cell.items',
                item: 'row',
                key: 'row.id',
                children: [
                  {
                    type: 'element',
                    tag: 'td',
                    attributes: { title: { $expression: 'row.label' } },
                  },
                ],
              },
            ],
          },
        },
      },
    ],
  };
  it('read the binding inside the scoped content and the slot outside it', () => {
    const template: Template = {
      type: 'component',
      name: 'Grid',
      children: [
        {
          type: 'element',
          tag: 'div',
          attributes: { 'data-custom': { $expression: 'row !== undefined' } },
          children: [{ type: 'slot', name: 'row' }],
        },
        {
          type: 'element',
          tag: 'Table',
          slotScope: ['row'],
          slots: {
            cell: {
              slotScope: ['row'],
              content: [
                {
                  type: 'element',
                  tag: 'td',
                  attributes: { title: { $expression: 'row.label' } },
                },
              ],
            },
          },
          children: [
            {
              type: 'element',
              tag: 'span',
              attributes: { title: { $expression: 'row.label' } },
            },
          ],
        },
      ],
    };
    const legacy = fileContent(template);
    expect(legacy).toContain('data-custom={$$slots.row !== undefined}');
    expect(legacy).toContain(
      ['><Table let:row>', '  <span title={row.label}></span>'].join('\n')
    );
    expect(legacy).toContain(
      [
        '  <svelte:fragment slot="cell" let:row>',
        '    <td title={row.label}></td>',
      ].join('\n')
    );

    // Runes: the snippet parameters shadow the slot's snippet prop, which is
    // read through an alias.
    const runes = process(template, {
      extensions: [svelte({ mode: 'runes' })],
    }).files[0].content;
    expect(runes).toContain('let { row: rowSlot }: Props = $props();');
    expect(runes).toContain('data-custom={rowSlot !== undefined}');
    expect(runes).toContain('{@render rowSlot?.()}');
    expect(runes).toContain(
      [
        '  {#snippet children({ row })}',
        '    <span title={row.label}></span>',
      ].join('\n')
    );
    expect(runes).toContain(
      ['  {#snippet cell({ row })}', '    <td title={row.label}></td>'].join(
        '\n'
      )
    );
  });
  it('scope nested loops and a loop inside a scoped named-slot projection', () => {
    const legacy = fileContent(nestedTemplate);
    expect(legacy).toContain(
      [
        '  {#each group.rows as row (row.id)}',
        '    <span title={row.label}></span>',
      ].join('\n')
    );
    expect(legacy).toContain(
      '<em data-outer={$$slots.row !== undefined}></em>'
    );
    expect(legacy).toContain(
      [
        '    {#each cell.items as row (row.id)}',
        '      <td title={row.label}></td>',
      ].join('\n')
    );

    const runes = process(nestedTemplate, {
      extensions: [svelte({ mode: 'runes' })],
    }).files[0].content;
    expect(runes).toContain(
      'let { groups = undefined, row: rowSlot }: Props = $props();'
    );
    expect(runes).toContain('<span title={row.label}></span>');
    expect(runes).toContain('<em data-outer={rowSlot !== undefined}></em>');
    expect(runes).toContain('<td title={row.label}></td>');
  });

  it('alias the default slot as childrenSlot under a loop item named children', () => {
    const runes = process(
      {
        type: 'component',
        name: 'Kids',
        props: { items: { type: 'any[]' } },
        children: [
          {
            type: 'iteration',
            items: 'items',
            item: 'children',
            key: 'children.id',
            children: [
              {
                type: 'element',
                tag: 'li',
                attributes: { title: { $expression: 'children.label' } },
                children: [{ type: 'slot' }],
              },
            ],
          },
        ],
      },
      { extensions: [svelte({ mode: 'runes' })] }
    ).files[0].content;
    expect(runes).toContain(
      'let { items = undefined, children: childrenSlot }: Props = $props();'
    );
    expect(runes).toContain(
      [
        '{#each items as children (children.id)}',
        '  <li title={children.label}>',
        '    {@render childrenSlot?.()}',
      ].join('\n')
    );
  });
});

describe('svelte() option defaultSelected', () => {
  it('writes it as selected in both modes, an authored selected standing', () => {
    const template: Template = [
      {
        type: 'element',
        tag: 'select',
        children: [
          {
            type: 'element',
            tag: 'option',
            attributes: { value: 'a', defaultSelected: { $expression: 'on' } },
            conditionalAttributes: [
              { condition: 'locked', attributes: { defaultSelected: true } },
            ],
          },
          {
            type: 'element',
            tag: 'option',
            attributes: { value: 'b', selected: true, defaultSelected: false },
          },
        ],
      },
    ];
    for (const mode of ['legacy', 'runes'] as const) {
      const content = process(template, { extensions: [svelte({ mode })] })
        .files[0].content;
      expect(content).toContain(
        '<option value="a" selected={on} selected={locked ? true : undefined}'
      );
      expect(content).toContain('<option value="b" selected>');
      expect(content).not.toMatch(/defaultSelected/i);
    }
  });
});

describe('svelte() form control defaults', () => {
  it('adds the reflected attribute beside the default, a bound authored one read first', () => {
    const template: Template = [
      {
        type: 'element',
        tag: 'input',
        attributes: {
          type: 'checkbox',
          checked: { $expression: 'on' },
          defaultChecked: { $expression: 'initial' },
        },
      },
      {
        type: 'element',
        tag: 'input',
        attributes: { defaultValue: 'a', value: 'b' },
      },
      {
        type: 'element',
        tag: 'textarea',
        attributes: { defaultValue: { $expression: 'notes || ""' } },
      },
      {
        type: 'element',
        tag: 'input',
        attributes: { type: 'checkbox', defaultChecked: false },
      },
    ];
    for (const mode of ['legacy', 'runes'] as const) {
      const content = process(template, { extensions: [svelte({ mode })] })
        .files[0].content;
      expect(content).toContain(
        '<input type="checkbox" checked={on ?? initial} defaultChecked={initial}'
      );
      expect(content).toContain('<input value="b" defaultValue="a"');
      // A bound default with nothing authored beside it is written once:
      // runes renders the attribute on the server alone, legacy reads a
      // value its script captures once.
      if (mode === 'runes') {
        expect(content).toMatch(
          /<textarea\s+value=\{\$effect\.tracking\(\) \? undefined : \(notes \|\| ""\)\}\s+defaultValue=\{notes \|\| ""\}/
        );
      } else {
        expect(content).toContain('const initialValue = notes || "";');
        expect(content).toMatch(
          /<textarea\s+value=\{initialValue\}\s+defaultValue=\{notes \|\| ""\}/
        );
      }
      expect(content).toMatch(/<input type="checkbox"\s*\/>/);
    }
  });

  it("marks the option a select's defaultValue matches", () => {
    const option = (value: string) => ({
      type: 'element' as const,
      tag: 'option',
      attributes: { value },
    });
    const template: Template = [
      {
        type: 'element',
        tag: 'select',
        attributes: { defaultValue: 'b' },
        children: [option('a'), option('b')],
      },
      {
        type: 'element',
        tag: 'select',
        attributes: { defaultValue: { $expression: 'plan' } },
        children: [
          option('none'),
          {
            type: 'iteration',
            items: 'plans',
            item: 'entry',
            children: [
              {
                type: 'element',
                tag: 'option',
                attributes: { value: { $expression: 'entry.id' } },
              },
            ],
          },
        ],
      },
      {
        type: 'element',
        tag: 'select',
        attributes: {
          value: { $expression: 'chosen' },
          defaultValue: 'a',
        },
        children: [option('a')],
      },
    ];
    for (const mode of ['legacy', 'runes'] as const) {
      const content = process(template, { extensions: [svelte({ mode })] })
        .files[0].content;
      expect(content).toContain('<option value="b" selected>');
      expect(content).toContain('<option value="a">');
      expect(content).toContain(
        `<option value="none" selected={'none' === plan}>`
      );
      expect(content).toContain('selected={entry.id === plan}');
      expect(content).toContain('<select value={chosen ?? "a"}>');
      expect(content).not.toContain('defaultValue');
    }
  });
});

describe('svelte() numeric conditional attributes', () => {
  it('writes a numeric string as a number where Svelte types the attribute as one', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'td',
        attributes: { colspan: '2' },
        conditionalAttributes: [
          {
            condition: 'wide',
            attributes: { rowspan: '2', tabindex: '-1', headers: '7' },
          },
        ],
      },
      {
        type: 'element',
        tag: 'Stepper',
        conditionalAttributes: [
          { condition: 'wide', attributes: { tabindex: '0' } },
        ],
      },
    ]);
    // A static numeric string type-checks as written.
    expect(content).toContain('colspan="2"');
    expect(content).toContain('rowspan={wide ? 2 : undefined}');
    expect(content).toContain('tabindex={wide ? -1 : undefined}');
    expect(content).toContain("headers={wide ? '7' : undefined}");
    // A component's props are its own.
    expect(content).toContain("<Stepper tabindex={wide ? '0' : undefined} />");
  });
});

describe('svelte() two-way props', () => {
  const toggle: Template = {
    type: 'component',
    name: 'Toggle',
    props: {
      pressed: {
        type: 'boolean',
        default: false,
        bindable: { current: 'isPressed', setter: 'setPressed', changeProp: 'onPressedChange' },
      },
      onPressedChange: { type: '(pressed: boolean) => void' },
    },
    children: [
      { type: 'element', tag: 'button', attributes: { 'aria-pressed': { $expression: 'isPressed' } } },
    ],
  };

  it('reads the prop through $: in legacy mode, seeded from its own default', () => {
    const content = fileContent(toggle);
    expect(content).toContain('export let pressed: boolean | undefined = undefined;');
    expect(content).toContain('$: isPressed = pressed !== undefined ? pressed : false;');
    expect(content).toContain('  pressed = value;\n  onPressedChange?.(value);\n}');
  });

  it('declares $bindable() without a fallback and reads it through $derived in runes mode', () => {
    const content = process(toggle, { extensions: [svelte({ mode: 'runes' })] }).files[0].content;
    expect(content).toContain('let { pressed = $bindable(), onPressedChange = undefined }: Props = $props();');
    expect(content).toContain('const isPressed = $derived(pressed !== undefined ? pressed : false);');
  });
});

describe('the rest class warning', () => {
  /** A rest root with its own class, whose svelte override reads the consumer's class when `reads`. */
  const restRoot = (reads: boolean): Template => ({
    type: 'component',
    name: 'Stack',
    rest: { tag: 'div' },
    children: [
      {
        type: 'element',
        tag: 'div',
        attributes: { $spread: { $expression: 'rest' }, class: ['stack'] },
        extensions: reads
          ? { svelte: { attributes: { class: ['stack', { $expression: 'rest.class' }] } } }
          : {},
      },
    ],
  });
  const restWarnings = (template: Template): string[] =>
    processWithSvelte(template).warnings.filter((warning) => warning.message.includes('spreads rest')).map((warning) => warning.message);

  it("warns about a rest root's own class, and not once its class override reads rest.class", () => {
    expect(restWarnings(restRoot(false))).toHaveLength(1);
    expect(restWarnings(restRoot(true))).toEqual([]);
  });
});

describe('conditional passthrough root', () => {
  const panel: Template = {
    type: 'component',
    name: 'Panel',
    props: { open: { type: 'boolean', default: false } },
    children: [
      {
        type: 'conditional',
        conditions: [
          {
            statement: 'if',
            condition: 'open',
            children: [{ type: 'element', tag: 'div', passthrough: true }],
          },
        ],
      },
    ],
  };

  it('types the element null once it has unmounted, in both modes', () => {
    expect(fileContent(panel)).toContain(
      "export let element: HTMLElementTagNameMap['div'] | null | undefined = undefined;"
    );
    const runes = process(panel, {
      extensions: [svelte({ mode: 'runes' })],
    }).files[0].content;
    expect(runes).toContain(
      "element?: HTMLElementTagNameMap['div'] | null | undefined;"
    );
    expect(runes).toContain('{#if open}');
  });
});

describe('legacy wrappers on a dynamic tag', () => {
  const action: Template = {
    type: 'component',
    name: 'Action',
    props: {
      as: { type: 'any' },
      onPress: { type: '(event: MouseEvent) => void' },
      onConfirm: { type: '(event: KeyboardEvent) => void' },
    },
    children: [
      {
        type: 'element',
        tag: { $expression: "as ?? 'button'", default: 'button', componentValued: true },
        passthrough: true,
        events: [
          { name: 'click', handler: 'onPress', modifiers: ['prevent'] },
          { name: 'keydown', handler: 'onConfirm', modifiers: ['enter'] },
        ],
      },
    ],
  };

  // Neither arm gives the wrapper's `event` a contextual type in legacy
  // mode: the string arm's tag is a union of tag names, and the component
  // arm composes with the untyped `$$restProps`.
  it("annotates a component-valued root's wrappers on both arms", () => {
    const legacy = fileContent(action);
    expect(legacy).toContain(
      "on:keydown={(event: HTMLElementEventMap['keydown']) => { if (event.key !== 'Enter') return; invokeHandler(onConfirm, event); }}"
    );
    expect(legacy).toContain('on:click|preventDefault={onPress}');
    expect(legacy).toContain(
      "onclick={composeEventHandlers($$restProps.onclick, (event: HTMLElementEventMap['click']) => { event.preventDefault(); invokeHandler(onPress, event); })}"
    );
    expect(legacy).toContain(
      "onkeydown={composeEventHandlers($$restProps.onkeydown, (event: HTMLElementEventMap['keydown']) => { if (event.key !== 'Enter') return; invokeHandler(onConfirm, event); })}"
    );
  });

  it('annotates a dynamic element whose tag is a union of tag names, and a static tag never', () => {
    const dynamic = fileContent({
      ...action,
      props: { as: { type: "'button' | 'a'" }, onConfirm: action.props!.onConfirm },
      children: [
        {
          ...(action.children[0] as ElementNode),
          tag: { $expression: "as ?? 'button'", default: 'button' },
          events: [{ name: 'keydown', handler: 'onConfirm', modifiers: ['enter'] }],
        },
      ],
    });
    expect(dynamic).toContain(
      "on:keydown={(event: HTMLElementEventMap['keydown']) => { if (event.key !== 'Enter') return; invokeHandler(onConfirm, event); }}"
    );
    const stat = fileContent({
      ...action,
      children: [{ ...(action.children[0] as ElementNode), tag: 'button' }],
    });
    expect(stat).toContain(
      "on:keydown={(event) => { if (event.key !== 'Enter') return; invokeHandler(onConfirm, event); }}"
    );
  });

  it('leaves runes wrappers to the typed spread', () => {
    const runes = process(action, { extensions: [svelte({ mode: 'runes' })] })
      .files[0].content;
    expect(runes).not.toContain('HTMLElementEventMap');
    expect(runes).toContain(
      'onclick={composeEventHandlers(restProperties.onclick, (event) => { event.preventDefault(); invokeHandler(onPress, event); })}'
    );
  });
});

describe('svelte derived values', () => {
  const template: Template = {
    type: 'component',
    name: 'Total',
    props: { values: { type: 'number[]', required: true } },
    derived: {
      total: 'values.reduce((sum, value) => sum + value, 0)',
      summary: '{ total, count: values.length }',
    },
    children: [{ type: 'element', tag: 'output', children: [{ type: 'text', expression: 'total' }] }],
  };

  it('declares each with $: in legacy mode', () => {
    expect(fileContent(template)).toContain(
      [
        '$: total = values.reduce((sum, value) => sum + value, 0);',
        '$: summary = { total, count: values.length };',
      ].join('\n')
    );
  });

  it('declares each with $derived in runes mode', () => {
    expect(
      process(template, { extensions: [svelte({ mode: 'runes' })] }).files[0].content
    ).toContain(
      [
        'const total = $derived(values.reduce((sum, value) => sum + value, 0));',
        'const summary = $derived({ total, count: values.length });',
      ].join('\n')
    );
  });
});

describe('svelte declared ids', () => {
  const template: Template = {
    type: 'component',
    name: 'Field',
    imports: ['const SIZES = [1, 2];'],
    props: { id: { type: 'string' } },
    ids: { inputId: { prefix: 'field', prop: 'id' }, hintId: 'field-hint' },
    derived: { describedBy: 'hintId' },
    children: [
      {
        type: 'element',
        tag: 'input',
        attributes: { id: { $expression: 'inputId' }, 'aria-describedby': { $expression: 'describedBy' } },
      },
    ],
  };

  it('numbers instances from the page-wide counter in legacy mode, ahead of the derived values', () => {
    const content = fileContent(template);
    expect(content).toContain(
      [
        '<script context="module" lang="ts">',
        'const SIZES = [1, 2];',
        'function nextGeneratedId(): number {',
        "  const key = Symbol.for('js-template-engine.generatedId');",
        '  const page = globalThis as unknown as Record<symbol, number | undefined>;',
        '  const next = (page[key] ?? 0) + 1;',
        '  page[key] = next;',
        '  return next;',
        '}',
        '</script>',
      ].join('\n')
    );
    // The `let` gives the instance script's top level the id; `$:` keeps it
    // in step with the prop.
    expect(content).toContain(
      [
        'const generatedId = nextGeneratedId();',
        'let inputId = id ?? `field-${generatedId}`;',
        '$: inputId = id ?? `field-${generatedId}`;',
        'const hintId = `field-hint-${generatedId}`;',
        '',
        '$: describedBy = hintId;',
      ].join('\n')
    );
  });

  it('takes $props.id() once in runes mode, with no counter', () => {
    const content = process(template, { extensions: [svelte({ mode: 'runes' })] }).files[0].content;
    expect(content).toContain(
      [
        'const generatedId = $props.id();',
        'const inputId = $derived(id ?? `field-${generatedId}`);',
        'const hintId = `field-hint-${generatedId}`;',
      ].join('\n')
    );
    expect(content).not.toContain('generatedIdCount');
  });
});

describe('markup the Svelte compiler would read differently', () => {
  it('escapes a brace in a static attribute value, which would open an expression', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'input',
        attributes: { placeholder: 'Use {name} here', title: 'plain' },
      },
    ]);
    expect(content).toContain('placeholder="Use &#123;name} here"');
    expect(content).toContain('title="plain"');
  });

  it('escapes a comment ending sequence so the comment runs to its end', () => {
    const content = fileContent([
      { type: 'comment', content: 'ends with --> and opens <!-- again' },
      { type: 'element', tag: 'div' },
    ]);
    expect(content).toContain('<!-- ends with --&gt; and opens &lt;!-- again -->');
    expect(content).not.toContain('--> and');
  });

  it('writes a second line break ahead of pre and textarea content that begins with one', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'pre',
        children: [{ type: 'text', content: '\n  keep  spaces' }],
      },
      {
        type: 'element',
        tag: 'textarea',
        children: [{ type: 'text', content: '\nDraft' }],
      },
      {
        type: 'element',
        tag: 'pre',
        children: [{ type: 'text', content: 'no break' }],
      },
    ]);
    expect(content).toContain('<pre>\n\n  keep  spaces</pre');
    expect(content).toContain('<textarea>\n\nDraft</textarea');
    expect(content).toContain('<pre>no break</pre>');
  });
});

describe('svelte() cascade layer order in a style block', () => {
  const layered: Template = {
    type: 'component',
    name: 'Panel',
    children: [
      {
        type: 'element',
        tag: 'section',
        attributes: {
          class: ['panel'],
          style: { color: 'white', '&:hover': { color: 'silver' } },
        },
      },
    ],
  };

  it('loads the generated module from the block, written beside the component file', () => {
    // A module the block loads that emits rules inside one of the layers
    // would otherwise compile ahead of an order stated in the block (#374).
    for (const placement of ['in-file', 'inline'] as const) {
      const result = processWithSvelte(layered, {
        styling: {
          language: 'scss',
          placement,
          layer: {
            name: 'kit.components',
            order: ['kit.reset', 'kit.base', 'kit.components'],
          },
        },
      });
      expect(result.files.map((file) => file.path)).toEqual([
        'Panel.svelte',
        '_layer-order.scss',
      ]);
      expect(result.files[1].content).toBe(
        '@layer kit.reset, kit.base, kit.components;\n'
      );
      expect(result.files[0].content).toContain(
        "<style lang=\"scss\">\n@use './layer-order' as *;\n\n@layer kit.components {"
      );
    }
  });

  it('loads the generated module from a separate stylesheet', () => {
    const result = processWithSvelte(layered, {
      styling: {
        language: 'scss',
        placement: 'separate-file',
        layer: { name: 'kit.components', order: ['kit.base', 'kit.components'] },
      },
    });
    expect(result.files.map((file) => file.path)).toEqual([
      'Panel.svelte',
      'Panel.scss',
      '_layer-order.scss',
    ]);
    expect(result.files[1].content.startsWith("@use './layer-order' as *;\n")).toBe(
      true
    );
  });
});

describe('svelte() relayed two-way props', () => {
  const select: Template = {
    type: 'component',
    name: 'Select',
    props: {
      value: {
        type: 'string | number',
        bindable: { given: 'givenValue', report: 'reportValue', changeProp: 'onValueChange' },
      },
      onValueChange: { type: '(value: string | number) => void' },
    },
    children: [
      {
        type: 'element',
        tag: 'Driver',
        attributes: { value: { $expression: 'givenValue' }, onValueChange: { $expression: 'reportValue' } },
      },
    ],
  };
  const guard =
    '!valueEcho.controlled && (value === undefined || (valueEcho.recorded && Object.is(value, valueEcho.last)))';
  const report = [
    'function reportValue(next: string | number) {',
    '  value = next;',
    '  valueEcho.recorded = true;',
    '  valueEcho.last = next;',
    '  onValueChange?.(next);',
    '}',
  ].join('\n');

  it('guards the given value through an inlined echo and reports in legacy mode', () => {
    const content = fileContent(select);
    expect(content).toContain('export let value: string | number | undefined = undefined;');
    expect(content).toContain(
      [
        'const valueEcho = { recorded: false, last: undefined as string | number | undefined, controlled: false };',
        'let givenValue: string | number | undefined;',
        `$: if (${guard}) {`,
        '  givenValue = undefined;',
        '} else {',
        '  valueEcho.controlled = true;',
        '  givenValue = value;',
        '}',
        report,
      ].join('\n')
    );
    expect(content).not.toContain('import');
  });

  it('declares $bindable() and guards through $derived.by in runes mode', () => {
    const content = process(select, { extensions: [svelte({ mode: 'runes' })] }).files[0].content;
    expect(content).toContain('let { value = $bindable(), onValueChange = undefined }: Props = $props();');
    expect(content).toContain(
      [
        'const givenValue = $derived.by(() => {',
        `  if (${guard}) {`,
        '    return undefined;',
        '  }',
        '  valueEcho.controlled = true;',
        '  return value;',
        '});',
        report,
      ].join('\n')
    );
  });

  it('parenthesizes a function type in the echo', () => {
    const content = fileContent({
      ...select,
      props: {
        handler: { type: '() => void', bindable: { given: 'givenHandler', report: 'reportHandler' } },
      },
      children: [{ type: 'element', tag: 'Driver', attributes: { handler: { $expression: 'givenHandler' } } }],
    } as Template);
    expect(content).toContain('last: undefined as (() => void) | undefined');
    expect(content).toContain('let givenHandler: (() => void) | undefined;');
  });
});
