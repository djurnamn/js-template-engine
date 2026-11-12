import {
  process,
  TemplateError,
  type StylingExtension,
} from '@js-template-engine/core';
import type { Template, TemplateNode } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import { react } from '../src/index';

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

function processWithReact(
  template: Template,
  options: Parameters<typeof process>[1] = {}
) {
  return process(template, { ...options, extensions: [react()] });
}

function fileContent(template: Template, options: Parameters<typeof process>[1] = {}) {
  return processWithReact(template, options).files[0].content;
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

describe('react()', () => {
  it('skips a declared prop named in the routing list', () => {
    const content = fileContent({
      type: 'component',
      name: 'Checkbox',
      props: { name: { type: 'string' } },
      children: [
        {
          type: 'element',
          tag: 'label',
          passthrough: true,
          children: [
            {
              type: 'element',
              tag: 'input',
              passthrough: { attributes: ['name', 'formnovalidate'] },
              attributes: { name: { $expression: 'name' } },
            },
          ],
        },
      ],
    });
    // The prop is destructured, never in either share, and keeps its type.
    expect(content).toContain('name={name}');
    expect(content).toContain("Exclude<{ [Key in keyof ComponentPropsWithoutRef<'input'>]-?: Lowercase<Key & string> extends 'name' | 'formnovalidate' ? Key : never }[keyof ComponentPropsWithoutRef<'input'>], 'name' | 'children' | 'key' | 'className' | 'style'>");
  });

  it('falls back and composes against the share each name lands in', () => {
    const content = fileContent(ROUTED_ARIA);
    // The root keeps unrouted names: its handler composes with rest's.
    expect(content).toContain('onClick={composeEventHandlers(rest.onClick, onPress)}');
    expect(content).toContain("title={authoredOrConsumer(hint, rest, 'title')}");
    // The routed element falls back to routedRest for a routed name only.
    expect(content).toContain(
      "aria-label={authoredOrConsumer(label, routedRest, 'aria-label')}"
    );
    expect(content).toContain('id={inputId}');
    expect(content).toContain('onFocus={onFocusIn}');
    expect(content).toContain('<input\n        {...routedRest}');
  });

  it("moves the ref to the routed element with handle: 'routed'", () => {
    const routed = structuredClone(ROUTED_ARIA) as Extract<Template, { type: 'component' }>;
    const label = routed.children[0] as unknown as { children: Array<Record<string, unknown>> };
    label.children[0].passthrough = { attributes: ['aria-*'], handle: 'routed' };
    label.children[0].extensions = {
      react: { attributes: { ref: { $expression: 'inputRef' } } },
    };
    (routed.children[0] as unknown as Record<string, unknown>).extensions = {
      react: { attributes: { ref: { $expression: 'labelRef' } } },
    };
    const content = fileContent(routed);
    // The consumer's ref composes with the input's own; the label keeps its
    // own ref alone.
    expect(content).toContain('ref={composeRefs(inputRef, ref)}');
    expect(content).toContain('ref={labelRef}');
    expect(content).not.toContain('ref={ref}');
    // The ref is typed after the input, and the label's is left out.
    expect(content).toContain(
      "Omit<ComponentPropsWithRef<'label'>, 'hint' | 'label' | 'inputId' | 'onPress' | 'onFocusIn' | 'ref' | 'children' | FieldRoutedKeys>, Pick<ComponentPropsWithoutRef<'input'>, FieldRoutedKeys>, Pick<ComponentPropsWithRef<'input'>, 'ref'>"
    );
  });

  it("keeps the ref on the root with handle: 'root'", () => {
    const routed = structuredClone(ROUTED_ARIA) as Extract<Template, { type: 'component' }>;
    const label = routed.children[0] as unknown as { children: Array<Record<string, unknown>> };
    label.children[0].passthrough = { attributes: ['aria-*'], handle: 'root' };
    expect(fileContent(routed)).toBe(fileContent(ROUTED_ARIA));
  });

  it("joins a condition-gated routed id list with the consumer's", () => {
    const routed = structuredClone(ROUTED_ARIA) as Extract<Template, { type: 'component' }>;
    const label = routed.children[0] as unknown as { children: Array<Record<string, unknown>> };
    label.children[0].conditionalAttributes = [
      { condition: 'hint', attributes: { 'aria-describedby': 'field-hint' } },
    ];
    expect(fileContent(routed)).toContain(
      "aria-describedby={authoredAndConsumer(hint ? 'field-hint' : undefined, routedRest, 'aria-describedby')}"
    );
  });

  it("joins a routed id list with the consumer's, static or bound", () => {
    const content = fileContent({
      type: 'component',
      name: 'Field',
      props: { hintId: { type: 'string' } },
      children: [
        {
          type: 'element',
          tag: 'div',
          passthrough: true,
          attributes: { 'aria-describedby': 'outside' },
          children: [
            {
              type: 'element',
              tag: 'input',
              passthrough: { attributes: ['aria-*'] },
              attributes: {
                'aria-describedby': { $expression: 'hintId' },
                'aria-labelledby': 'field-label',
                'aria-label': 'Field',
              },
            },
          ],
        },
      ],
    });
    expect(content).toContain(
      "aria-describedby={authoredAndConsumer(hintId, routedRest, 'aria-describedby')}"
    );
    expect(content).toContain(
      "aria-labelledby={authoredAndConsumer('field-label', routedRest, 'aria-labelledby')}"
    );
    // Only an id list joins; another attribute, and the root's own, win.
    expect(content).toContain('aria-label="Field"');
    expect(content).toContain('aria-describedby="outside"');
    expect(content).toContain('function authoredAndConsumer(');
  });

  it("joins a passthrough root's id lists with the consumer's", () => {
    const content = fileContent({
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
    });
    expect(content).toContain(
      "aria-describedby={authoredAndConsumer(hintId, rest, 'aria-describedby')}"
    );
    expect(content).toContain(
      "aria-controls={authoredAndConsumer('menu', rest, 'aria-controls')}"
    );
    expect(content).toContain(
      "aria-details={authoredAndConsumer(expanded ? 'more' : undefined, rest, 'aria-details')}"
    );
    // Only an id list joins; another attribute wins.
    expect(content).toContain('title="Hint"');
    expect(content).toContain('function authoredAndConsumer(');
  });

  it("joins a routing root's id list only when its own share holds it", () => {
    const content = fileContent({
      type: 'component',
      name: 'Field',
      children: [
        {
          type: 'element',
          tag: 'div',
          passthrough: true,
          attributes: { 'aria-describedby': 'outside', 'aria-owns': 'popup' },
          children: [
            {
              type: 'element',
              tag: 'input',
              passthrough: { attributes: ['aria-describedby'] },
            },
          ],
        },
      ],
    });
    // aria-describedby is routed away, so the root's stands; aria-owns stays
    // in the root's share and joins it.
    expect(content).toContain('aria-describedby="outside"');
    expect(content).toContain(
      "aria-owns={authoredAndConsumer('popup', rest, 'aria-owns')}"
    );
  });

  it('supports the scss styling language only with separate-file', () => {
    const template: Template = [
      {
        type: 'element',
        tag: 'div',
        attributes: { class: ['card'], style: { ':hover': { color: 'red' } } },
        children: [{ type: 'text', content: 'Hi' }],
      },
    ];
    for (const placement of ['in-file', 'inline'] as const) {
      expect(() =>
        processWithReact(template, {
          styling: { language: 'scss', placement },
        })
      ).toThrowError(TemplateError);
    }
    const result = processWithReact(template, {
      styling: { language: 'scss', placement: 'separate-file' },
    });
    expect(result.files.map((file) => file.path)).toContain('Component.scss');
    expect(result.files[0].content).toContain("import './Component.scss';");
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
    const result = processWithReact(template, {
      styling: { placement: 'separate-file', stylesheetLink: 'none' },
    });
    expect(result.files.map((file) => file.path)).toEqual([
      'Component.tsx',
      'Component.css',
    ]);
    expect(result.files[0].content).not.toContain('import');
    expect(result.files[1].content).toContain('.card {');
  });

  it('names the output file after the component', () => {
    const result = processWithReact({
      type: 'component',
      name: 'Button',
      children: [
        { type: 'element', tag: 'button', children: [{ type: 'text', content: 'Save' }] },
      ],
    });
    expect(result.files.map((file) => file.path)).toEqual(['Button.tsx']);
  });

  it('emits a stylesheet file and import under separate-file styling', () => {
    const result = processWithReact(
      {
        type: 'component',
        name: 'Button',
        style: '.button {\n  cursor: pointer;\n}',
        children: [
          {
            type: 'element',
            tag: 'button',
            attributes: { class: ['button'] },
            children: [{ type: 'text', content: 'Save' }],
          },
        ],
      },
      { styling: { placement: 'separate-file' } }
    );
    expect(result.files.map((file) => file.path)).toEqual([
      'Button.tsx',
      'Button.css',
    ]);
    expect(result.files[0].content).toContain("import './Button.css';");
    expect(result.files[0].content).not.toContain('<style>');
    expect(result.files[1].content).toBe('.button {\n  cursor: pointer;\n}\n');
  });

  it('renders plain style properties as a style object under inline styling', () => {
    const content = fileContent(
      [
        {
          type: 'element',
          tag: 'div',
          attributes: { style: { backgroundColor: 'blue', 'font-size': '16px' } },
          children: [{ type: 'text', content: 'Styled' }],
        },
      ],
      { styling: { placement: 'inline' } }
    );
    expect(content).toContain(
      "style={{ backgroundColor: 'blue', fontSize: '16px' }}"
    );
    expect(content).not.toContain('const componentStyles');
  });

  it('merges a whole-object expression with static props under inline styling', () => {
    const content = fileContent(
      [
        {
          type: 'element',
          tag: 'div',
          attributes: {
            style: {
              $expression: 'computeStyles(props)',
              backgroundColor: 'blue',
            },
          },
          children: [{ type: 'text', content: 'Styled' }],
        },
      ],
      { styling: { placement: 'inline' } }
    );
    // Whole-object spread is the base layer; the static property overrides it.
    expect(content).toContain(
      "style={{ ...computeStyles(props), backgroundColor: 'blue' }}"
    );
    expect(content).not.toContain('const componentStyles');
  });

  it('keeps nested-selector styles in a style element under inline styling', () => {
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
    expect(content).toContain('<style>{componentStyles}</style>');
    expect(content).toContain('[data-jte-node="Component-0"]:hover');
  });

  it('maps renamed JSX attributes and passes others through', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'label',
        attributes: {
          for: 'email',
          tabindex: 0,
          'data-test': 'label',
          'aria-hidden': true,
        },
        children: [{ type: 'text', content: 'Email' }],
      },
    ]);
    expect(content).toContain('htmlFor="email"');
    expect(content).toContain('tabIndex={0}');
    expect(content).toContain('data-test="label"');
    expect(content).toContain('aria-hidden');
  });

  it('renders condition-gated plain attributes as ternaries to undefined', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'button',
        attributes: { type: 'button' },
        conditionalAttributes: [
          { condition: 'isBusy', attributes: { disabled: true } },
        ],
        children: [{ type: 'text', content: 'Save' }],
      },
    ]);
    expect(content).toContain('disabled={isBusy ? true : undefined}');
  });

  it('lets node-level react overrides win over generic concepts', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'button',
        attributes: { type: 'button' },
        events: [{ name: 'click', handler: 'genericHandler' }],
        extensions: {
          react: {
            attributes: { type: 'submit' },
            events: [{ name: 'click', handler: 'reactHandler' }],
          },
        },
        children: [{ type: 'text', content: 'Send' }],
      },
    ]);
    expect(content).toContain('type="submit"');
    expect(content).toContain('onClick={reactHandler}');
    expect(content).not.toContain('genericHandler');
  });

  it('removes a node attribute the react override sets to null', () => {
    const template: Template = {
      type: 'component',
      name: 'MixedCheckbox',
      props: { mixed: { type: 'boolean', required: true } },
      children: [
        {
          type: 'element',
          tag: 'input',
          attributes: {
            type: 'checkbox',
            indeterminate: { $expression: 'mixed' },
          },
          extensions: {
            react: {
              attributes: {
                indeterminate: null,
                ref: {
                  $expression:
                    '(element: HTMLInputElement | null) => { if (element) element.indeterminate = mixed; }',
                },
              },
            },
          },
        },
      ],
    };
    const result = processWithReact(template);
    expect(result.files[0].content).not.toContain('indeterminate={');
    expect(result.files[0].content).toContain(
      'ref={(element: HTMLInputElement | null) => { if (element) element.indeterminate = mixed; }}'
    );
    expect(result.warnings).toEqual([]);
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
              extensions: { react: { attributes: { class: null } } },
              children: [{ type: 'text', content: 'New' }],
            },
          ],
        },
      { extensions: [react(), runtimeBem] }
    ).files[0].content;
    expect(content).toContain('<span>New</span>');
    expect(content).not.toContain('bem(');
  });

  it('removes the condition-gated classes with a null class override, keeping the entries\' other attributes', () => {
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
            extensions: { react: { attributes: { class: null } } },
            children: [{ type: 'text', content: 'New' }],
          },
        ],
      },
      { extensions: [react(), runtimeBem] }
    ).files[0].content;
    expect(content).not.toContain('className');
    expect(content).not.toContain('--open');
    expect(content).not.toContain('bem(');
    expect(content).toContain('aria-expanded=');
  });

  it('emits no BEM setup once a null class override removes every runtime call', () => {
    const render = (keepOne: boolean) =>
      process(
        {
          type: 'component',
          name: 'Badge',
          children: [
            {
              type: 'element',
              tag: 'span',
              extensions: { react: { attributes: { className: null } } },
              children: [{ type: 'text', content: 'New' }],
            },
            {
              type: 'element',
              tag: 'span',
              ...(keepOne
                ? {}
                : { extensions: { react: { attributes: { className: null } } } }),
              children: [{ type: 'text', content: 'Old' }],
            },
          ],
        },
        { extensions: [react(), runtimeBem] }
      ).files[0].content;
    const removed = render(false);
    expect(removed).not.toContain('useBem');
    expect(removed).not.toContain('const bem');
    const kept = render(true);
    expect(kept).toContain('import { useBem }');
    expect(kept).toContain("const bem = useBem('Badge')");
  });

  it('reads a className override as the node class', () => {
    const node = (className: string | null): Template => [
      {
        type: 'element',
        tag: 'span',
        attributes: { class: ['own'] },
        extensions: { react: { attributes: { className } } },
      },
    ];
    expect(fileContent(node('replaced'))).toContain('<span className="replaced" />');
    expect(fileContent(node(null))).toContain('<span />');
  });

  it('warns about a static indeterminate string, not a bound value, a static boolean or a conditional entry', () => {
    const warningPaths = (node: TemplateNode) =>
      processWithReact([node]).warnings.map((warning) => warning.nodePath);
    for (const indeterminate of [false, true, { $expression: 'mixed' }]) {
      expect(
        warningPaths({
          type: 'element',
          tag: 'input',
          attributes: { type: 'checkbox', indeterminate },
        })
      ).toEqual([]);
    }
    expect(
      warningPaths({
        type: 'element',
        tag: 'input',
        attributes: { type: 'checkbox', indeterminate: 'mixed' },
      })
    ).toEqual(['[0].attributes.indeterminate']);
    expect(
      warningPaths({
        type: 'element',
        tag: 'input',
        attributes: { type: 'checkbox' },
        conditionalAttributes: [
          { condition: 'mixed', attributes: { indeterminate: true } },
          { condition: 'odd', attributes: { indeterminate: 'mixed' } },
        ],
      })
    ).toEqual(['[0].conditionalAttributes[1].attributes.indeterminate']);
  });

  it("sets a conditional entry's indeterminate through the ref, joined with its condition", () => {
    const entry = (indeterminate: unknown, condition = 'open') => ({
      condition,
      attributes: { indeterminate } as never,
    });
    const input = (own: unknown, entries: ReturnType<typeof entry>[]) =>
      fileContent([
        {
          type: 'element',
          tag: 'input',
          attributes: { type: 'checkbox', ...(own === undefined ? {} : { indeterminate: own }) } as never,
          conditionalAttributes: entries,
        },
      ]);
    expect(input(undefined, [entry({ $expression: 'mixed' })])).toContain(
      '<input type="checkbox" ref={indeterminateRef(open && mixed)} />'
    );
    expect(input(undefined, [entry(true, 'a || b')])).toContain(
      'ref={indeterminateRef(a || b)}'
    );
    expect(
      input({ $expression: 'mixed' }, [entry(true), entry({ $expression: 'x || y' }, 'last')])
    ).toContain('ref={indeterminateRef(last ? (x || y) : (open ? true : mixed))}');
    expect(input(undefined, [entry({ $expression: 'mixed' })])).not.toContain(
      'indeterminate={'
    );
  });

  it('sets indeterminate on a dynamic tag that defaults to an input', () => {
    const result = processWithReact({
      type: 'component',
      name: 'MixedCheckbox',
      props: { mixed: { type: 'boolean' }, as: { type: "'input' | 'button'", default: 'input' } },
      children: [
        {
          type: 'element',
          tag: { $expression: 'as', default: 'input' },
          attributes: { indeterminate: { $expression: 'mixed' } },
        },
      ],
    });
    expect(result.warnings).toEqual([]);
    expect(result.files[0].content).toContain(
      '<RootTag ref={indeterminateRef(mixed)} />'
    );
  });

  it('sets a bound indeterminate on an input through the generated ref helper', () => {
    const result = processWithReact({
      type: 'component',
      name: 'MixedCheckbox',
      props: { mixed: { type: 'boolean' } },
      children: [
        {
          type: 'element',
          tag: 'input',
          attributes: {
            type: 'checkbox',
            indeterminate: { $expression: 'mixed' },
          },
        },
      ],
    });
    const content = result.files[0].content;
    expect(result.warnings).toEqual([]);
    expect(content).toContain(
      '<input type="checkbox" ref={indeterminateRef(mixed)} />'
    );
    expect(content).toContain(
      'function indeterminateRef(indeterminate: unknown): RefCallback<Element> {'
    );
    expect(content).toContain("import type { RefCallback } from 'react';");
    expect(content).not.toContain('composeRefs');
  });

  it("reserves the indeterminate ref helper's names where an input sets one through the ref", () => {
    const template = (child: TemplateNode): Template => ({
      type: 'component',
      name: 'MixedCheckbox',
      props: { indeterminateRef: { type: 'string' } },
      children: [child],
    });
    const input = (indeterminate: unknown): TemplateNode => ({
      type: 'element',
      tag: 'input',
      attributes: { type: 'checkbox', indeterminate } as never,
    });
    const reserved = "React's indeterminate ref helper";
    expect(() => processWithReact(template(input({ $expression: 'true' })))).toThrow(reserved);
    expect(() => processWithReact(template(input(false)))).not.toThrow();
    // A conditional entry's counts; another element's does not.
    expect(() =>
      processWithReact(
        template({
          type: 'element',
          tag: 'input',
          conditionalAttributes: [{ condition: 'open', attributes: { indeterminate: true } }],
        })
      )
    ).toThrow(reserved);
    expect(() =>
      processWithReact(
        template({
          type: 'element',
          tag: 'div',
          attributes: { indeterminate: { $expression: 'true' } },
        })
      )
    ).not.toThrow();
  });

  it('sets indeterminate under an input tag override and composes it with a ref of its own', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'div',
        attributes: {
          indeterminate: { $expression: 'mixed' },
          ref: { $expression: 'inputRef' },
        },
        extensions: { react: { tag: 'input' } },
      },
    ]);
    expect(content).toContain(
      '<input ref={composeRefs(indeterminateRef(mixed), inputRef)} />'
    );
    expect(content).toContain('function composeRefs<T>');
    expect(content).toContain('function indeterminateRef(');
  });

  it('lets a node-level react tag override replace the element with a component reference', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'div',
        attributes: { class: 'wrapper' },
        extensions: { react: { tag: 'Portal' } },
        children: [{ type: 'text', content: 'x' }],
      },
    ]);
    expect(content).toContain('<Portal className="wrapper">');
    expect(content).toContain('</Portal>');
    expect(content).not.toContain('<div');
  });

  it('warns and renders no key for keyless iterations', () => {
    const result = processWithReact([
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
    expect(result.files[0].content).not.toContain('key=');
    expect(result.warnings).toEqual([
      expect.objectContaining({
        message: expect.stringContaining("no 'key' expression"),
      }),
    ]);
  });

  it('parenthesizes an items expression that is not a member chain before .map', () => {
    const iterate = (items: string) =>
      processWithReact([
        {
          type: 'iteration',
          items,
          item: 'item',
          key: 'item',
          children: [
            { type: 'element', tag: 'li', children: [{ type: 'text', expression: 'item' }] },
          ],
        },
      ]).files[0].content;
    expect(iterate('list.items ?? items')).toContain('(list.items ?? items).map(');
    expect(iterate('open ? items : []')).toContain('(open ? items : []).map(');
    expect(iterate('props.items')).toContain('return props.items.map(');
    expect(iterate('list?.rows[0].cells')).toContain('return list?.rows[0].cells.map(');
    expect(iterate("getItems('a b')")).toContain("return getItems('a b').map(");
  });

  it('wraps multi-child keyed iterations in a keyed Fragment', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'dl',
        children: [
          {
            type: 'iteration',
            items: 'props.entries',
            item: 'entry',
            key: 'entry.id',
            children: [
              {
                type: 'element',
                tag: 'dt',
                children: [{ type: 'text', expression: 'entry.term' }],
              },
              {
                type: 'element',
                tag: 'dd',
                children: [{ type: 'text', expression: 'entry.detail' }],
              },
            ],
          },
        ],
      },
    ]);
    expect(content).toContain("import { Fragment } from 'react';");
    expect(content).toContain('<Fragment key={entry.id}>');
  });

  it('renders a component-level extension override merge', () => {
    const content = fileContent({
      type: 'component',
      name: 'Alert',
      imports: ["import { palette } from './palette';"],
      script: "const role = 'alert';",
      children: [
        { type: 'element', tag: 'div', children: [{ type: 'text', content: 'Hi' }] },
      ],
      extensions: {
        react: {
          imports: ["import { useCallback } from 'react';"],
          script: 'const handleDismiss = useCallback(() => {}, []);',
        },
      },
    });
    expect(content).toContain("import { palette } from './palette';");
    expect(content).toContain("import { useCallback } from 'react';");
    expect(content).toContain("const role = 'alert';");
    expect(content).toContain('const handleDismiss = useCallback(() => {}, []);');
  });

  describe('slot-presence conditions', () => {
    it('resolves slot references to their prop across branches and inside a compound condition, leaving non-slot identifiers bare', () => {
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
              {
                statement: 'else',
                children: [{ type: 'text', content: 'none' }],
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
      expect(content).toContain('props.icon ?');
      expect(content).toContain(') : props.prefix ?');
      expect(content).toContain('{pressed &&');
      expect(content).toContain('{props.icon && pressed &&');
    });
  });

  it('composes a passthrough root handler through a helper that yields undefined when neither side has one', () => {
    const composed = fileContent({
      type: 'component',
      name: 'Field',
      props: { onCommit: { type: '(value: string) => void' } },
      children: [
        {
          type: 'element',
          tag: 'input',
          passthrough: true,
          events: [{ name: 'input', handler: 'onCommit ? (event) => onCommit(event.currentTarget.value) : undefined' }],
        },
      ],
    });
    expect(composed).toContain(
      'onInput={composeEventHandlers(rest.onInput, onCommit ? (event) => onCommit(event.currentTarget.value) : undefined)}'
    );
    expect(composed).toContain('function composeEventHandlers<EventType>(');
    expect(composed.indexOf('function composeEventHandlers<EventType>(')).toBeLessThan(composed.indexOf('export function Field('));

    const plain = fileContent({
      type: 'component',
      name: 'Plain',
      props: { onInput: { type: '(event: Event) => void' } },
      children: [
        { type: 'element', tag: 'input', passthrough: true, events: [{ name: 'input', handler: 'onInput' }] },
      ],
    });
    expect(plain).toContain('onInput={onInput}');
    expect(plain).not.toContain('composeEventHandlers');
  });

  describe('dynamic tags below the root', () => {
    it('binds one in a scoped slot render prop, which takes a block body', () => {
      const content = fileContent({
        type: 'component',
        name: 'Rows',
        imports: ["import { Table } from './Table';"],
        children: [
          {
            type: 'element',
            tag: 'Table',
            slots: {
              cell: {
                slotScope: ['row'],
                content: [
                  {
                    type: 'element',
                    tag: { $expression: "row.header ? 'th' : 'td'", default: 'td' },
                    children: [{ type: 'text', expression: 'row.label' }],
                  },
                ],
              },
            },
          },
        ],
      });
      expect(content).toContain(
        [
          '      cell={({ row }) => {',
          "        const Tag = row.header ? 'th' : 'td';",
          '        return (',
          '          <Tag>{row.label}</Tag>',
          '        );',
          '      }}',
        ].join('\n')
      );
    });

    it('binds one in a default scoped slot function child', () => {
      const content = fileContent({
        type: 'component',
        name: 'Picker',
        imports: ["import { Listbox } from './Listbox';"],
        children: [
          {
            type: 'element',
            tag: 'Listbox',
            slotScope: ['option'],
            children: [
              {
                type: 'element',
                tag: { $expression: "option.group ? 'strong' : 'span'", default: 'span' },
                children: [{ type: 'text', expression: 'option.label' }],
              },
            ],
          },
        ],
      });
      expect(content).toContain(
        [
          '      {({ option }) => {',
          "        const Tag = option.group ? 'strong' : 'span';",
          '        return (',
          '          <Tag>{option.label}</Tag>',
          '        );',
          '      }}',
        ].join('\n')
      );
    });

    it('keeps RootTag for a dynamic root and names the nested one Tag', () => {
      const content = fileContent({
        type: 'component',
        name: 'Card',
        props: { as: { type: "'article' | 'section'" }, level: { type: '2 | 3' } },
        children: [
          {
            type: 'element',
            tag: { $expression: "as ?? 'article'", default: 'article' },
            children: [
              {
                type: 'element',
                tag: { $expression: '`h${level ?? 2}` as const', default: 'h2' },
                children: [{ type: 'text', content: 'Title' }],
              },
            ],
          },
        ],
      });
      expect(content).toContain("const RootTag = as ?? 'article';");
      expect(content).toContain('const Tag = `h${level ?? 2}` as const;');
      expect(content).toContain('<RootTag>');
      expect(content).toContain('<Tag>Title</Tag>');
    });

    it('binds one inside its discriminated branch, after the branch destructures', () => {
      const content = fileContent({
        type: 'component',
        name: 'Field',
        props: { level: { type: '2 | 3' } },
        children: [
          {
            type: 'conditional',
            conditions: [
              {
                statement: 'if',
                condition: 'visual',
                props: { visual: { type: 'true', required: true } },
                children: [
                  {
                    type: 'element',
                    tag: 'div',
                    passthrough: true,
                    children: [
                      {
                        type: 'element',
                        tag: { $expression: '`h${level ?? 2}` as const', default: 'h2' },
                      },
                    ],
                  },
                ],
              },
              {
                statement: 'else',
                props: { visual: { type: 'false' } },
                children: [{ type: 'element', tag: 'input', passthrough: true }],
              },
            ],
          },
        ],
      });
      const branch = content.slice(content.indexOf('if (props.visual) {'));
      expect(branch.indexOf('= props;')).toBeLessThan(branch.indexOf('const Tag = `h${level ?? 2}` as const;'));
      expect(branch.indexOf('const Tag =')).toBeLessThan(branch.indexOf('return'));
    });
  });
});

describe('react() class lists', () => {
  it('gates a class repeated across conditional entries on all of them', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'button',
        attributes: { class: ['btn'] },
        conditionalAttributes: [
          { condition: "v === 'a'", attributes: { class: ['shared', 'a', 'btn'] } },
          { condition: "v === 'b'", attributes: { class: ['shared', 'b'] } },
        ],
      },
    ]);
    expect(content).toContain(
      "className={'btn' + ((v === 'a') || (v === 'b') ? ' shared' : '') + (v === 'a' ? ' a' : '') + (v === 'b' ? ' b' : '')}"
    );
  });

  it('evaluates a non-reference class expression once, never as a condition', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'span',
        attributes: {
          class: ['switch', { $expression: "on ? 'x' : 'y'" }, { $expression: 'extra' }],
        },
        conditionalAttributes: [{ condition: 'big', attributes: { class: ['switch--big'] } }],
      },
    ]);
    expect(content).toContain(
      "className={['switch', big ? 'switch--big' : '', on ? 'x' : 'y', extra].filter(Boolean).join(' ')}"
    );
  });

  it('keeps the guard for plain-reference class expressions', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'span',
        attributes: { class: ['chip', { $expression: 'props.tone' }] },
      },
    ]);
    expect(content).toContain("className={'chip' + (props.tone ? ' ' + props.tone : '')}");
  });

  it('parenthesizes a ternary condition in every ternary-test position', () => {
    const concatenated = fileContent([
      {
        type: 'element',
        tag: 'span',
        attributes: { class: ['k'] },
        conditionalAttributes: [{ condition: 'a ? b : c', attributes: { class: ['ok'] } }],
      },
    ]);
    expect(concatenated).toContain("className={'k' + ((a ? b : c) ? ' ok' : '')}");

    const lone = fileContent([
      {
        type: 'element',
        tag: 'span',
        conditionalAttributes: [{ condition: 'a ? b : c', attributes: { class: ['ok'] } }],
      },
    ]);
    expect(lone).toContain("className={(a ? b : c) ? 'ok' : ''}");

    const array = fileContent([
      {
        type: 'element',
        tag: 'span',
        attributes: { class: ['k', { $expression: "on ? 'x' : 'y'" }] },
        conditionalAttributes: [{ condition: 'a, b', attributes: { class: ['ok'] } }],
      },
    ]);
    expect(array).toContain(
      "className={['k', (a, b) ? 'ok' : '', on ? 'x' : 'y'].filter(Boolean).join(' ')}"
    );
  });

  it('writes class names with & and quotes verbatim', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'span',
        attributes: { class: ["[&_svg:not([class*='size-'])]:size-4"] },
        conditionalAttributes: [
          { condition: 'on', attributes: { class: ['after:content-["*"]'] } },
        ],
      },
      { type: 'element', tag: 'b', attributes: { class: ['before:content-["*"]'] } },
    ]);
    expect(content).toContain(
      `className={"[&_svg:not([class*='size-'])]:size-4" + (on ? ' after:content-["*"]' : '')}`
    );
    expect(content).toContain(`className='before:content-["*"]'`);
  });
});

describe('slots that require their scope', () => {
  const dialog = (fallback?: TemplateNode[]): Template => ({
    type: 'component',
    name: 'Dialog',
    children: [
      {
        type: 'element',
        tag: 'div',
        children: [
          {
            type: 'slot',
            name: 'trigger',
            exposes: { triggerProps: 'triggerProps' },
            scopeRequired: true,
            ...(fallback ? { fallback } : {}),
          },
        ],
      },
    ],
  });

  it('renders only a render function, else nothing', () => {
    const content = fileContent(dialog());
    expect(content).toContain(
      'trigger?: ((scope: { triggerProps: any }) => ReactNode) | undefined;'
    );
    expect(content).toContain(
      [
        "{typeof props.trigger === 'function'",
        '        ? props.trigger({ triggerProps })',
        "        : null}",
      ].join('\n')
    );
  });

  it('renders the fallback when no render function is given', () => {
    const content = fileContent(
      dialog([{ type: 'text', content: 'Open' }])
    );
    expect(content).toContain(
      [
        "{typeof props.trigger === 'function'",
        '        ? props.trigger({ triggerProps })',
        "        : 'Open'}",
      ].join('\n')
    );
    expect(content).not.toContain('props.trigger ??');
  });
});

describe('a slot rendered in several places', () => {
  it('passes each place its own expressions', () => {
    const content = fileContent({
      type: 'component',
      name: 'Table',
      props: { items: { type: 'string[]' }, rows: { type: 'string[]' } },
      children: [
        {
          type: 'iteration',
          items: 'items',
          item: 'item',
          key: 'item',
          children: [{ type: 'slot', name: 'row', exposes: { item: 'item' } }],
        },
        {
          type: 'iteration',
          items: 'rows',
          item: 'row',
          key: 'row',
          children: [
            { type: 'slot', name: 'row', exposes: { item: { value: 'row', type: 'string' } } },
          ],
        },
      ],
    });
    expect(content).toContain('row?: ReactNode | ((scope: { item: string }) => ReactNode);');
    expect(content).toContain('props.row({ item })');
    expect(content).toContain('props.row({ item: row })');
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
    const content = fileContent(template);
    expect(content).toContain('data-custom={props.row !== undefined}');
    expect(content).toContain('cell={({ row }) => <td title={row.label} />}');
    expect(content).toContain('{({ row }) => <span title={row.label} />}');
  });
  it('scope nested loops and a loop inside a scoped named-slot projection', () => {
    const content = fileContent(nestedTemplate);
    expect(content).toContain(
      '{group.rows.map((row) => <span key={row.id} title={row.label} />)}'
    );
    expect(content).toContain('<em data-outer={props.row !== undefined} />');
    expect(content).toContain(
      '{cell.items.map((row) => <td key={row.id} title={row.label} />)}'
    );
  });
});

describe('react() option defaultSelected', () => {
  const option = (
    value: string,
    defaultSelected?: boolean | { $expression: string }
  ) => ({
    type: 'element' as const,
    tag: 'option',
    attributes: {
      value,
      ...(defaultSelected === undefined ? {} : { defaultSelected }),
    },
    children: [{ type: 'text' as const, content: value }],
  });

  it("moves its select's preset options to the select's defaultValue", () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'select',
        children: [
          option('a', true),
          {
            type: 'element',
            tag: 'optgroup',
            children: [
              option('b', { $expression: 'isB' }),
              option('c', { $expression: 'mode === "c"' }),
            ],
          },
        ],
      },
    ]);
    expect(content).toContain(
      `<select defaultValue={(mode === "c") ? 'c' : (isB ? 'b' : 'a')}>`
    );
    expect(content).not.toContain('defaultSelected');
    expect(content).not.toContain('selected=');
  });

  it('writes a static preset as a static defaultValue', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'select',
        children: [option('a'), option('b', true)],
      },
    ]);
    expect(content).toContain('<select defaultValue="b">');
  });

  it('writes selected where the select cannot carry it', () => {
    const inLoop = fileContent([
      {
        type: 'element',
        tag: 'select',
        children: [
          option('a', true),
          {
            type: 'iteration',
            items: 'items',
            item: 'item',
            children: [option('b', { $expression: 'item.on' })],
          },
        ],
      },
    ]);
    expect(inLoop).toContain('<select>');
    expect(inLoop).toContain('selected={item.on}');
    expect(inLoop).toMatch(/<option value="a" selected>/);

    const multiple = fileContent([
      {
        type: 'element',
        tag: 'select',
        attributes: { multiple: true },
        children: [option('a', { $expression: 'on' })],
      },
    ]);
    expect(multiple).toContain('<option value="a" selected={on}>');

    const alone = fileContent([option('a', { $expression: 'on' })]);
    expect(alone).toContain('<option value="a" selected={on}>');
  });
});

describe('react() numeric attributes', () => {
  it('writes a numeric string as a number where React types the prop as one', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'td',
        attributes: {
          colspan: '2',
          tabindex: '-1',
          'aria-level': '3',
          title: '42',
          width: '10',
        },
        conditionalAttributes: [
          { condition: 'wide', attributes: { rowspan: '2', headers: '7' } },
        ],
      },
    ]);
    for (const part of [
      'colSpan={2}',
      'tabIndex={-1}',
      'aria-level={3}',
      'title="42"',
      'width="10"',
    ]) {
      expect(content).toContain(part);
    }
    expect(content).toContain('rowSpan={wide ? 2 : undefined}');
    expect(content).toContain("headers={wide ? '7' : undefined}");
  });

  it('leaves a non-numeric string and a component reference as written', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'input',
        attributes: { maxlength: '{{ limit }}' },
      },
      {
        type: 'element',
        tag: 'Stepper',
        attributes: { tabindex: '0' },
      },
    ]);
    expect(content).toContain('maxLength="{{ limit }}"');
    expect(content).toContain('<Stepper tabIndex="0" />');
  });
});

describe("react() a rest node's style", () => {
  const restNode = (override: Record<string, unknown> | undefined): Template => ({
    type: 'component',
    name: 'Stack',
    rest: { tag: 'div' },
    props: { gap: { type: 'string' } },
    children: [
      {
        type: 'element',
        tag: 'div',
        attributes: { $spread: { $expression: 'rest' }, style: { gap: { $expression: 'gap' } } },
        ...(override ? { extensions: { react: { attributes: { style: override as never } } } } : {}),
      },
    ],
  });

  it("keeps the consumer's style last once the style reads it", () => {
    expect(fileContent(restNode({ $expression: '{ ...styles, ...rest.style }', gap: { $expression: 'gap' } }))).toContain(
      'style={{ ...styles, gap: gap, ...rest.style }}'
    );
    // A literal with properties of its own keeps them, without the spread.
    expect(
      fileContent(restNode({ $expression: "{ color: 'red', ...rest.style }", gap: { $expression: 'gap' } }))
    ).toContain("style={{ ...{ color: 'red' }, gap: gap, ...rest.style }}");
    // The consumer's style alone moves to the end rather than appearing twice.
    expect(fileContent(restNode({ $expression: 'rest.style', gap: { $expression: 'gap' } }))).toContain(
      'style={{ gap: gap, ...rest.style }}'
    );
    // A style that does not read it is the node's own.
    expect(fileContent(restNode(undefined))).toContain('<div {...rest} style={{ gap: gap }}');
  });
});

describe('react() refs beside the consumer ref', () => {
  it('composes a ref on a node spreading rest with the ref rest carries', () => {
    const content = fileContent({
      type: 'component',
      name: 'Field',
      rest: { tag: 'input' },
      children: [
        {
          type: 'element',
          tag: 'input',
          attributes: {
            $spread: { $expression: 'rest' },
            ref: { $expression: 'inputRef' },
          },
        },
      ],
    });
    expect(content).toContain(
      '<input {...rest} ref={composeRefs(inputRef, rest.ref)} />'
    );
    expect(content).toContain(
      "import type { ComponentPropsWithRef, Ref, RefCallback } from 'react';"
    );
    expect(content).toContain('function composeRefs<T>(');
  });

  it('composes a ref on a passthrough root with the forwarded ref, once', () => {
    const content = fileContent({
      type: 'component',
      name: 'Panel',
      children: [
        {
          type: 'element',
          tag: 'div',
          passthrough: true,
          attributes: { ref: { $expression: 'panelRef' } },
        },
      ],
    });
    expect(content).toContain('ref={composeRefs(panelRef, ref)}');
    expect(content.match(/\sref=\{/g)).toHaveLength(1);
  });

  it('leaves a ref alone where nothing carries a consumer ref', () => {
    const content = fileContent({
      type: 'component',
      name: 'Field',
      rest: { tag: 'input' },
      children: [
        {
          type: 'element',
          tag: 'div',
          children: [
            {
              type: 'element',
              tag: 'input',
              attributes: { ref: { $expression: 'inputRef' } },
            },
            {
              type: 'element',
              tag: 'span',
              attributes: { $spread: { $expression: 'rest' } },
            },
          ],
        },
      ],
    });
    expect(content).toContain('<input ref={inputRef} />');
    expect(content).not.toContain('composeRefs');
  });
});

describe('react() two-way props', () => {
  const toggle = (extra: Partial<Template & object> = {}): Template =>
    ({
      type: 'component',
      name: 'Toggle',
      props: {
        pressed: {
          type: 'boolean',
          bindable: {
            current: 'isPressed',
            setter: 'setPressed',
            defaultProp: 'defaultPressed',
            changeProp: 'onPressedChange',
          },
        },
        defaultPressed: { type: 'boolean', default: false },
        onPressedChange: { type: '(pressed: boolean) => void' },
      },
      children: [
        {
          type: 'element',
          tag: 'button',
          attributes: { 'aria-pressed': { $expression: 'isPressed' } },
          events: [{ name: 'click', handler: '() => setPressed((pressed) => !pressed)' }],
        },
      ],
      ...extra,
    }) as Template;

  it("keeps its own copy in useState, reads a given value over it and writes 'use client'", () => {
    const content = fileContent(toggle());
    expect(content.startsWith("'use client';\n\nimport { useRef, useState } from 'react';")).toBe(true);
    expect(content).toContain(
      [
        '  const { pressed, defaultPressed = false, onPressedChange } = props;',
        '',
        '  const [ownPressed, setOwnPressed] = useState<boolean>(defaultPressed);',
        '  const isPressed = pressed !== undefined ? pressed : ownPressed;',
        '  const latestPressed = useRef<{ value: boolean } | null>(null);',
        '  function setPressed(next: boolean | ((current: boolean) => boolean)) {',
        '    const current = latestPressed.current !== null ? latestPressed.current.value : isPressed;',
        "    const value = typeof next === 'function' ? (next as (current: boolean) => boolean)(current) : next;",
        '    if (Object.is(value, current)) return;',
        '    latestPressed.current = { value };',
        '    queueMicrotask(() => (latestPressed.current = null));',
        '    if (pressed === undefined) setOwnPressed(value);',
        '    onPressedChange?.(value);',
        '  }',
      ].join('\n')
    );
  });

  it("does not import useState twice beside an author's import of it", () => {
    const content = fileContent(
      toggle({ imports: ["import { useId, useState } from 'react';"] })
    );
    expect(content.match(/useState[,\s}]/g)).toHaveLength(1);
    expect(content).toContain("import { useRef, useId, useState } from 'react';");
  });

  describe('the react import', () => {
    const component = (imports: string[], children = 'x'): Template => ({
      type: 'component',
      name: 'Card',
      imports,
      children: [{ type: 'slot' }, { type: 'text', content: children }],
    });

    it("merges the author's named react imports into the generated one, keeping type-only members", () => {
      const content = fileContent(
        component([
          "import { createContext, type FC } from 'react';",
          "import { palette } from './palette';",
          "import type { Ref } from 'react';",
        ])
      );
      expect(content).toContain(
        "import { type ReactNode, createContext, type FC, type Ref } from 'react';\nimport { palette } from './palette';"
      );
      expect(content.match(/from 'react'/g)).toHaveLength(1);
    });

    it('writes import type when every member is a type, and names a member once', () => {
      const content = fileContent(component(["import type { ReactNode, Ref } from 'react';"]));
      expect(content).toContain("import type { ReactNode, Ref } from 'react';");
      expect(content.match(/from 'react'/g)).toHaveLength(1);
    });

    it('leaves a default, namespace or commented react import, or a lone authored one, as written', () => {
      const content = fileContent(
        component(["import React, { useId } from 'react';", "import * as R from 'react';"])
      );
      expect(content).toContain("import type { ReactNode } from 'react';\nimport React, { useId } from 'react';\nimport * as R from 'react';");
      const lone: Template = {
        type: 'component',
        name: 'Plain',
        imports: ["import { useId } from 'react';"],
        children: [{ type: 'text', content: 'x' }],
      };
      expect(fileContent(lone)).toContain("import { useId } from 'react';");
    });

    it('leaves an import with a comment inside its braces as written', () => {
      const content = fileContent(component(["import { useId /* stable ids */ } from 'react';"]));
      expect(content).toContain(
        "import type { ReactNode } from 'react';\nimport { useId /* stable ids */ } from 'react';"
      );
      const lineComment = fileContent(component(["import {\n  useId, // stable ids\n} from 'react';"]));
      expect(lineComment).toContain('// stable ids');
      expect(lineComment.match(/from 'react'/g)).toHaveLength(2);
    });

    it('names a member two authored imports share once', () => {
      const content = fileContent(
        component(["import { useId } from 'react';", "import { useId, useMemo } from 'react';"])
      );
      expect(content).toContain("import { type ReactNode, useId, useMemo } from 'react';");
      expect(content.match(/from 'react'/g)).toHaveLength(1);
    });

    it('leaves an import binding a generated name to another export or modifier as written', () => {
      const aliased = fileContent(component(["import { useId, forwardRef as ReactNode } from 'react';"]));
      expect(aliased).toContain(
        "import type { ReactNode } from 'react';\nimport { useId, forwardRef as ReactNode } from 'react';"
      );
      const valueForm = fileContent(component(["import { useId, ReactNode } from 'react';"]));
      expect(valueForm).toContain(
        "import type { ReactNode } from 'react';\nimport { useId, ReactNode } from 'react';"
      );
    });

    it('puts each member on its own line past 80 columns', () => {
      const content = fileContent(
        component(["import { createContext, useContext, useEffect, useId, useMemo } from 'react';"])
      );
      expect(content).toContain(
        "import {\n  type ReactNode,\n  createContext,\n  useContext,\n  useEffect,\n  useId,\n  useMemo,\n} from 'react';"
      );
    });
  });

  it('declares the generated values ahead of the author script, which may call the setter', () => {
    const content = fileContent(toggle({ script: 'function clear() {\n  setPressed(false);\n}' }));
    expect(content.indexOf('function setPressed')).toBeLessThan(content.indexOf('function clear'));
  });

  it('is a processing error when a target override drops a prop the binding names', () => {
    expect(() =>
      processWithReact(
        toggle({
          extensions: {
            react: {
              propsStrategy: 'replace',
              props: {
                pressed: {
                  type: 'boolean',
                  bindable: { current: 'isPressed', setter: 'setPressed', defaultProp: 'defaultPressed' },
                },
              },
            },
          },
        })
      )
    ).toThrow(TemplateError);
  });
});

describe('the rest class warning', () => {
  /** A rest root with its own class, whose react override reads the consumer's class when `reads`. */
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
          ? { react: { attributes: { class: ['stack', { $expression: 'rest.className' }] } } }
          : {},
      },
    ],
  });
  const restWarnings = (template: Template): string[] =>
    processWithReact(template).warnings.filter((warning) => warning.message.includes('spreads rest')).map((warning) => warning.message);

  it("warns about a rest root's own class, and not once its class override reads rest.className", () => {
    expect(restWarnings(restRoot(false))).toHaveLength(1);
    expect(restWarnings(restRoot(true))).toEqual([]);
  });
});

describe('react() event names', () => {
  const eventWarnings = (template: Template): string[] =>
    processWithReact(template)
      .warnings.filter((warning) => warning.message.includes('has no event prop'))
      .map((warning) => `${warning.nodePath}: ${warning.message.split(':')[0]}`);

  it('warns for an unknown event on an intrinsic element, naming the target', () => {
    expect(
      eventWarnings([
        { type: 'element', tag: 'div', events: [{ name: 'doubleclick', handler: 'open' }] },
      ])
    ).toEqual(["[0].events[0]: React has no event prop for the 'doubleclick' event on <div>"]);
  });

  it('checks a dynamic tag against its default, and an intrinsic tag override', () => {
    expect(
      eventWarnings([
        {
          type: 'element',
          tag: { $expression: "as ?? 'span'", default: 'span' },
          events: [{ name: 'swipe', handler: 'open' }],
        },
        {
          type: 'element',
          tag: 'Portal',
          extensions: { react: { tag: 'section' } },
          events: [{ name: 'swipe', handler: 'open' }],
        },
      ])
    ).toEqual([
      "[0].events[0]: React has no event prop for the 'swipe' event on <span>",
      "[1].events[0]: React has no event prop for the 'swipe' event on <section>",
    ]);
  });

  it('leaves the events of a component, a component-valued root and a custom element unchecked', () => {
    expect(
      eventWarnings([
        { type: 'element', tag: 'Menu', events: [{ name: 'select-item', handler: 'choose' }] },
        { type: 'element', tag: 'date-picker', events: [{ name: 'pick', handler: 'choose' }] },
      ])
    ).toEqual([]);
    expect(
      eventWarnings({
        type: 'component',
        name: 'Action',
        props: { as: { type: 'any' } },
        children: [
          {
            type: 'element',
            tag: { $expression: "as ?? 'button'", default: 'button', componentValued: true },
            passthrough: true,
            events: [{ name: 'press', handler: 'choose' }],
          },
        ],
      })
    ).toEqual([]);
  });

  it("renders a dialog's close and cancel and a video's resize without a warning", () => {
    const result = processWithReact([
      {
        type: 'element',
        tag: 'dialog',
        events: [
          { name: 'close', handler: 'done' },
          { name: 'cancel', handler: 'done' },
        ],
      },
      { type: 'element', tag: 'video', events: [{ name: 'resize', handler: 'fit' }] },
    ]);
    expect(result.files[0].content).toContain('onClose={done} onCancel={done}');
    expect(result.files[0].content).toContain('onResize={fit}');
    expect(result.warnings).toEqual([]);
  });

  it('renders focusout as onBlur and focusin as onFocus without a warning', () => {
    const result = processWithReact([
      {
        type: 'element',
        tag: 'div',
        events: [
          { name: 'focusin', handler: 'open' },
          { name: 'focusout', handler: 'close' },
        ],
      },
    ]);
    expect(result.files[0].content).toContain('onFocus={open} onBlur={close}');
    expect(result.warnings).toEqual([]);
  });
});

describe('conditional passthrough root', () => {
  /** A panel whose root renders its passthrough div only when `condition` holds. */
  function panel(condition: string, script?: string): Template {
    return {
      type: 'component',
      name: 'Panel',
      props: {
        open: { type: 'boolean', default: false },
        count: { type: 'number', default: 0 },
      },
      ...(script === undefined ? {} : { extensions: { react: { script } } }),
      children: [
        {
          type: 'conditional',
          conditions: [
            {
              statement: 'if',
              condition,
              children: [
                {
                  type: 'element',
                  tag: 'div',
                  passthrough: true,
                  children: [{ type: 'slot' }],
                },
              ],
            },
          ],
        },
      ],
    } as Template;
  }

  it('returns null early, negating a bare name and parenthesizing anything else', () => {
    expect(fileContent(panel('open'))).toContain(
      '  if (!open) {\n    return null;\n  }\n'
    );
    expect(fileContent(panel('count > 0 || open'))).toContain(
      '  if (!(count > 0 || open)) {\n    return null;\n  }\n'
    );
  });

  it('drops the negation of a negated name, and keeps a line comment off the parenthesis', () => {
    expect(fileContent(panel('!open'))).toContain(
      '  if (open) {\n    return null;\n  }\n'
    );
    expect(fileContent(panel('open // while shown'))).toContain(
      '  if (!(open // while shown\n  )) {\n    return null;\n  }\n'
    );
  });

  it("returns null after the component's script, so its hooks always run", () => {
    const content = fileContent(panel('open', 'const id = useId();'));
    expect(content.indexOf('const id = useId();')).toBeLessThan(
      content.indexOf('return null;')
    );
    expect(content).toContain(
      '<div {...rest} className={className} style={style} ref={ref}>'
    );
  });
});

describe('polymorphic root event composition', () => {
  const clickable = (componentValued: boolean): Template => ({
    type: 'component',
    name: 'Clickable',
    props: {
      as: { type: componentValued ? 'any' : "'button' | 'a'" },
      onConfirm: { type: '(event: KeyboardEvent) => void' },
    },
    children: [
      {
        type: 'element',
        tag: {
          $expression: "as ?? 'button'",
          default: 'button',
          ...(componentValued ? { componentValued: true } : {}),
        },
        passthrough: true,
        events: [
          { name: 'click', handler: '() => {}', modifiers: ['prevent'] },
          { name: 'keydown', handler: 'onConfirm', modifiers: ['enter'] },
        ],
      },
    ],
  });

  // Inside the generic body the spread's handler is the union of every
  // admitted tag's handler type, which no one handler type accepts.
  it("reads the spread's handler as the default tag's", () => {
    const content = fileContent(clickable(false));
    expect(content).toContain(
      "onClick={composeEventHandlers(rest.onClick as ComponentPropsWithRef<'button'>['onClick'], (event) => { event.preventDefault(); (() => {})(); })}"
    );
    expect(content).toContain(
      "onKeyDown={composeEventHandlers(rest.onKeyDown as ComponentPropsWithRef<'button'>['onKeyDown'], (event) => { if (event.key !== 'Enter') return; invokeHandler(onConfirm, event); })}"
    );
  });

  // Where the prop may hold a component, the spread's handler is `unknown`,
  // which would leave a wrapper's `event` unusable.
  it("reads the spread's handler as the default tag's on a component-valued root too", () => {
    const content = fileContent(clickable(true));
    expect(content).toContain(
      "onClick={composeEventHandlers(rest.onClick as ComponentPropsWithRef<'button'>['onClick'], (event) =>"
    );
  });
});

describe('discriminated surface root helpers', () => {
  // Each branch renders against its own context; what it found it needs is
  // declared once for the file.
  it('declares authoredAndConsumer when a branch sets an ID list', () => {
    const content = fileContent({
      type: 'component',
      name: 'Link',
      props: { describedBy: { type: 'string' } },
      children: [
        {
          type: 'conditional',
          conditions: [
            {
              statement: 'if',
              condition: 'href !== undefined',
              props: { href: { type: 'string', required: true } },
              children: [
                {
                  type: 'element',
                  tag: 'a',
                  passthrough: true,
                  attributes: {
                    href: { $expression: 'href' },
                    'aria-describedby': { $expression: 'describedBy' },
                  },
                },
              ],
            },
            {
              statement: 'else',
              props: { href: { type: 'undefined' } },
              children: [
                {
                  type: 'element',
                  tag: 'button',
                  passthrough: true,
                  attributes: { 'aria-describedby': { $expression: 'describedBy' } },
                },
              ],
            },
          ],
        },
      ],
    });
    expect(content).toContain(
      "aria-describedby={authoredAndConsumer(describedBy, rest, 'aria-describedby')}"
    );
    expect(content).toContain('function authoredAndConsumer(');
  });
});

describe('react derived values', () => {
  it('declares each as a const after the props and ahead of the script, without client state', () => {
    const content = fileContent({
      type: 'component',
      name: 'Total',
      props: { values: { type: 'number[]', required: true } },
      derived: {
        total: 'values.reduce((sum, value) => sum + value, 0)',
        summary: '{ total, count: values.length }',
      },
      script: 'function describe() {\n  return `${summary.total}`;\n}',
      children: [{ type: 'element', tag: 'output', children: [{ type: 'text', expression: 'total' }] }],
    });
    expect(content).toContain(
      [
        '  const { values } = props;',
        '',
        '  const total = values.reduce((sum, value) => sum + value, 0);',
        '  const summary = { total, count: values.length };',
        '',
        '  function describe() {',
      ].join('\n')
    );
    expect(content).not.toContain("'use client'");
  });
});

describe('react declared ids', () => {
  it('builds each from one useId() call ahead of the derived values, without client state', () => {
    const content = fileContent({
      type: 'component',
      name: 'Field',
      props: { id: { type: 'string' } },
      ids: { inputId: { prefix: 'field', prop: 'id' }, hintId: 'field-hint' },
      derived: { describedBy: 'hintId' },
      children: [{ type: 'element', tag: 'input', attributes: { id: { $expression: 'inputId' } } }],
    });
    expect(content).toContain("import { useId } from 'react';");
    expect(content).toContain(
      [
        '  const generatedId = useId();',
        '  const inputId = id ?? `field-${generatedId}`;',
        '  const hintId = `field-hint-${generatedId}`;',
        '',
        '  const describedBy = hintId;',
      ].join('\n')
    );
    expect(content).not.toContain("'use client'");
  });
});

describe('style object literals with custom properties', () => {
  const node = (expression: string): Template => ({
    type: 'component',
    name: 'Swatch',
    props: { item: { type: 'string' } },
    children: [
      {
        type: 'element',
        tag: 'div',
        attributes: { style: { $expression: expression } },
      },
    ],
  });

  it('checks a lone object literal declaring a custom property against the widened style type', () => {
    const content = fileContent(node("{ '--i': item, opacity: 0.5 }"));
    expect(content).toContain(
      "style={({ '--i': item, opacity: 0.5 } satisfies StyleWithCustomProperties) as CSSProperties}"
    );
    expect(content).toContain('type StyleWithCustomProperties = CSSProperties & {');
    expect(content).toContain("import type { CSSProperties } from 'react';");
  });

  it('passes a lone literal without a custom property, and a call, through bare', () => {
    expect(fileContent(node('{ opacity: 0.5 }'))).toContain(
      'style={{ opacity: 0.5 }}'
    );
    expect(fileContent(node("styleOf({ '--i': item })"))).toContain(
      "style={styleOf({ '--i': item })}"
    );
    expect(fileContent(node("{ '--i': item }"))).not.toContain(
      "style={{ '--i': item }}"
    );
  });
});

describe('react imports with a default or namespace binding', () => {
  const keyed = (statement: string): Template => ({
    type: 'component',
    name: 'List',
    props: { items: { type: 'string[]', required: true } },
    imports: [statement],
    children: [
      {
        type: 'iteration',
        items: 'items',
        item: 'item',
        key: 'item',
        children: [
          { type: 'text', expression: 'item' },
          { type: 'text', content: ', ' },
        ],
      },
    ],
  });

  it('leaves out a generated member a default-binding import already binds', () => {
    const content = fileContent(keyed("import React, { Fragment } from 'react';"));
    expect(content).toContain("import React, { Fragment } from 'react';");
    expect(content).not.toContain('import { Fragment }');
    expect(content.match(/Fragment \}/g)).toHaveLength(1);
    expect(content).toContain('<Fragment key={item}>');
  });

  it('still generates a member a namespace import does not bind', () => {
    const content = fileContent(keyed("import * as React from 'react';"));
    expect(content).toContain("import { Fragment } from 'react';");
    expect(content).toContain("import * as React from 'react';");
  });
});

describe('hyphenated event names', () => {
  it('composes nothing with a hyphenated event on a passthrough root or a rest node, which the consumer props have no key for', () => {
    const { files, warnings } = processWithReact({
      type: 'component',
      name: 'Host',
      props: { onPress: { type: '() => void' } },
      children: [
        {
          type: 'element',
          tag: 'div',
          passthrough: true,
          events: [
            { name: 'my-event', handler: 'handleIt' },
            { name: 'click', handler: 'onPress' },
          ],
          children: [
            {
              type: 'element',
              tag: 'span',
              attributes: { $spread: { $expression: 'rest' } },
              events: [{ name: 'my-event', handler: 'handleIt' }],
            },
          ],
        },
      ],
    });
    const content = files[0].content;
    expect(content).toContain('onMy-event={handleIt}');
    expect(content).not.toContain('onMy-event={composeEventHandlers');
    expect(content).not.toContain('rest.onMy-event');
    expect(content).toContain('onClick={composeEventHandlers(rest.onClick, ');
    expect(warnings.map((warning) => warning.message)).toContainEqual(
      expect.stringContaining("React has no event prop for the 'my-event' event")
    );
  });
});

describe('static text inside a whitespace-preserving element', () => {
  const draft = (tag: string, content: string): Template => ({
    type: 'component',
    name: 'Draft',
    children: [{ type: 'element', tag, children: [{ type: 'text', content }] }],
  });

  it('writes text holding a line break as a string expression, which JSX would trim', () => {
    expect(fileContent(draft('pre', '\n  indented  line\nsecond line'))).toContain(
      "<pre>{'\\n  indented  line\\nsecond line'}</pre>"
    );
  });

  it('leaves text without a line break, and text elsewhere, as JSX text', () => {
    expect(fileContent(draft('pre', 'no leading break'))).toContain(
      '<pre>no leading break</pre>'
    );
    expect(fileContent(draft('p', 'one\ntwo'))).not.toContain("{'one\\ntwo'}");
  });
});

describe('react() relayed two-way props', () => {
  const select = (extra: Partial<Template & object> = {}): Template =>
    ({
      type: 'component',
      name: 'Select',
      props: {
        value: {
          type: 'string',
          bindable: { given: 'givenValue', report: 'reportValue', changeProp: 'onValueChange' },
        },
        defaultValue: { type: 'string' },
        onValueChange: { type: '(value: string) => void' },
        open: { type: 'boolean', bindable: { given: 'givenOpen', report: 'reportOpen' } },
      },
      children: [
        {
          type: 'element',
          tag: 'Driver',
          attributes: {
            value: { $expression: 'givenValue' },
            defaultValue: { $expression: 'defaultValue' },
            onValueChange: { $expression: 'reportValue' },
            open: { $expression: 'givenOpen' },
            onOpenChange: { $expression: 'reportOpen' },
          },
        },
      ],
      ...extra,
    }) as Template;

  it('reads the prop and reports through the change prop, with no state, hook or client directive', () => {
    const content = fileContent(select());
    expect(content).not.toContain("'use client'");
    expect(content).not.toContain('useState');
    expect(content).not.toContain('useRef');
    expect(content).toContain(
      [
        '  const { value, defaultValue, onValueChange, open } = props;',
        '',
        '  const givenValue = value;',
        '  function reportValue(next: string) {',
        '    onValueChange?.(next);',
        '  }',
        '',
        '  const givenOpen = open;',
        '  function reportOpen(_next: boolean) {',
        '  }',
      ].join('\n')
    );
    expect(content).toContain('value={givenValue}');
    expect(content).toContain('onValueChange={reportValue}');
  });

  it('reads the props through props on a discriminated surface', () => {
    const content = fileContent(
      select({
        children: [
          {
            type: 'conditional',
            conditions: [
              {
                statement: 'if',
                condition: 'link',
                props: { link: { type: 'true', required: true }, href: { type: 'string' } },
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
      } as Partial<Template & object>)
    );
    expect(content).toContain('  const givenValue = props.value;');
    expect(content).toContain('    props.onValueChange?.(next);');
  });
});
