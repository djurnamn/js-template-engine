import { process, TemplateError } from '@js-template-engine/core';
import type { Template } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import { react } from '../src/index';

function processWithReact(
  template: Template,
  options: Parameters<typeof process>[1] = {}
) {
  return process(template, { ...options, extensions: [react()] });
}

function fileContent(template: Template, options: Parameters<typeof process>[1] = {}) {
  return processWithReact(template, options).files[0].content;
}

describe('react()', () => {
  it('declares inline and separate-file scripting unsupported', () => {
    const template: Template = [
      { type: 'element', tag: 'div', children: [{ type: 'text', content: 'Hi' }] },
    ];
    expect(() =>
      processWithReact(template, { scripting: { outputStrategy: 'inline' } })
    ).toThrowError(TemplateError);
    expect(() =>
      processWithReact(template, {
        scripting: { outputStrategy: 'separate-file' },
      })
    ).toThrowError(TemplateError);
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
    for (const outputStrategy of ['in-file', 'inline'] as const) {
      expect(() =>
        processWithReact(template, {
          styling: { language: 'scss', outputStrategy },
        })
      ).toThrowError(TemplateError);
    }
    const result = processWithReact(template, {
      styling: { language: 'scss', outputStrategy: 'separate-file' },
    });
    expect(result.files.map((file) => file.path)).toContain('Component.scss');
    expect(result.files[0].content).toContain("import './Component.scss';");
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
      { styling: { outputStrategy: 'separate-file' } }
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
      { styling: { outputStrategy: 'inline' } }
    );
    expect(content).toContain(
      "style={{ backgroundColor: 'blue', fontSize: '16px' }}"
    );
    expect(content).not.toContain('const styles');
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
      { styling: { outputStrategy: 'inline' } }
    );
    expect(content).toContain('data-jte-node="0"');
    expect(content).toContain('<style>{styles}</style>');
    expect(content).toContain('[data-jte-node="0"]:hover');
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
});
