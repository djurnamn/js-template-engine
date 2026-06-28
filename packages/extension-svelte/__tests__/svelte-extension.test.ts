import { process, TemplateError } from '@js-template-engine/core';
import type { Template } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import { svelte } from '../src/index';

function processWithSvelte(
  template: Template,
  options: Parameters<typeof process>[1] = {}
) {
  return process(template, { ...options, extensions: [svelte()] });
}

function fileContent(
  template: Template,
  options: Parameters<typeof process>[1] = {}
) {
  return processWithSvelte(template, options).files[0].content;
}

describe('svelte()', () => {
  it('declares inline and separate-file scripting unsupported', () => {
    const template: Template = [
      { type: 'element', tag: 'div', children: [{ type: 'text', content: 'Hi' }] },
    ];
    expect(() =>
      processWithSvelte(template, { scripting: { outputStrategy: 'inline' } })
    ).toThrowError(TemplateError);
    expect(() =>
      processWithSvelte(template, {
        scripting: { outputStrategy: 'separate-file' },
      })
    ).toThrowError(TemplateError);
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
    expect(content).toContain('<slot name="header"><h2>Title</h2></slot>');
    expect(content).toContain('<slot>Body</slot>');
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
      { styling: { outputStrategy: 'inline' } }
    );
    expect(content).toContain('style="background-color: blue; font-size: 16px"');
    expect(content).not.toContain('<style>');
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
      { styling: { outputStrategy: 'inline' } }
    );
    expect(content).toContain('data-jte-node="0"');
    expect(content).toContain('[data-jte-node="0"]:hover');
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
      { styling: { outputStrategy: 'separate-file' } }
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

  describe('slot-presence conditions', () => {
    it('resolves a condition naming a slot to $$slots across branches, leaving prop and compound conditions bare', () => {
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
      expect(content).toContain('{#if icon && pressed}');
    });
  });
});
