import { process, TemplateError } from '@js-template-engine/core';
import type { Template } from '@js-template-engine/types';
import { describe, expect, it } from 'vitest';

import { vue } from '../src/index';

function processWithVue(
  template: Template,
  options: Parameters<typeof process>[1] = {}
) {
  return process(template, { ...options, extensions: [vue()] });
}

function fileContent(
  template: Template,
  options: Parameters<typeof process>[1] = {}
) {
  return processWithVue(template, options).files[0].content;
}

describe('vue()', () => {
  it('declares inline and separate-file scripting unsupported', () => {
    const template: Template = [
      { type: 'element', tag: 'div', children: [{ type: 'text', content: 'Hi' }] },
    ];
    expect(() =>
      processWithVue(template, { scripting: { outputStrategy: 'inline' } })
    ).toThrowError(TemplateError);
    expect(() =>
      processWithVue(template, {
        scripting: { outputStrategy: 'separate-file' },
      })
    ).toThrowError(TemplateError);
  });

  it('names the output file after the component', () => {
    const result = processWithVue({
      type: 'component',
      name: 'Button',
      children: [
        { type: 'element', tag: 'button', children: [{ type: 'text', content: 'Save' }] },
      ],
    });
    expect(result.files.map((file) => file.path)).toEqual(['Button.vue']);
  });

  it('emits a typed script setup with withDefaults for defaulted props', () => {
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
    expect(content).toContain('<script setup lang="ts">');
    expect(content).toContain('interface ButtonProps {');
    expect(content).toContain('withDefaults(defineProps<ButtonProps>(), {');
    expect(content).toContain("variant: 'primary',");
  });

  it('renders conditionals as v-if directives on a lone element', () => {
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
    expect(content).toContain('<p v-if="isVisible">Hi</p>');
    expect(content).toContain('<p v-else>Bye</p>');
  });

  it('wraps a multi-child conditional branch in a template element', () => {
    const content = fileContent([
      {
        type: 'conditional',
        conditions: [
          {
            statement: 'if',
            condition: 'show',
            children: [
              { type: 'element', tag: 'h2', children: [{ type: 'text', content: 'A' }] },
              { type: 'element', tag: 'p', children: [{ type: 'text', content: 'B' }] },
            ],
          },
        ],
      },
    ]);
    expect(content).toContain('<template v-if="show">');
  });

  it('renders iterations as v-for with a key and warns when the key is missing', () => {
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
    expect(keyed).toContain('v-for="(user, i) in props.users"');
    expect(keyed).toContain(':key="user.id"');

    const result = processWithVue([
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
    expect(result.files[0].content).not.toContain(':key=');
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

  it('binds expression attributes and renders static classes with conditional :class', () => {
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
    expect(content).toContain(`:class="{ 'btn--lg': size === 'large' }"`);
    expect(content).toContain(':data-id="id"');
  });

  it('keeps {{ }} in static text literal instead of interpolating', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'p',
        children: [
          { type: 'text', content: 'Use {{ count }} as a placeholder' },
        ],
      },
    ]);
    expect(content).toContain('Use &#123;&#123; count }} as a placeholder');
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

  it('renders the style block as scoped under the in-file strategy', () => {
    const content = fileContent({
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
      extensions: { vue: { scoped: true } },
    });
    expect(content).toContain('<style scoped>');
  });

  it('ignores scoped with a warning when styling is not in-file', () => {
    const result = processWithVue(
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
        extensions: { vue: { scoped: true } },
      },
      { styling: { outputStrategy: 'separate-file' } }
    );
    expect(result.files.map((file) => file.path)).toEqual(['Box.vue', 'Box.css']);
    expect(result.files[0].content).not.toContain('scoped');
    expect(result.warnings).toEqual([
      expect.objectContaining({
        message: expect.stringContaining("'scoped' option applies only"),
      }),
    ]);
  });

  it('lets node-level vue overrides win, carrying raw directives like v-model', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'input',
        attributes: { type: 'text' },
        events: [{ name: 'input', handler: 'genericHandler' }],
        extensions: {
          vue: {
            attributes: { 'v-model': 'value' },
            events: [{ name: 'input', handler: 'vueHandler' }],
          },
        },
      },
    ]);
    expect(content).toContain('v-model="value"');
    expect(content).toContain('@input="vueHandler"');
    expect(content).not.toContain('genericHandler');
  });

  it('lets a node-level vue tag override replace the element and merge its attributes', () => {
    const content = fileContent([
      {
        type: 'element',
        tag: 'div',
        extensions: { vue: { tag: 'Teleport', attributes: { to: 'body' } } },
        children: [{ type: 'text', content: 'x' }],
      },
    ]);
    expect(content).toContain('<Teleport to="body">');
    expect(content).toContain('</Teleport>');
    expect(content).not.toContain('<div');
  });

  it('applies a component-level vue override (style replace)', () => {
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
        vue: { style: '.alert {\n  border: 2px dashed;\n}', styleStrategy: 'replace' },
      },
    });
    expect(content).toContain('border: 2px dashed;');
    expect(content).not.toContain('border: 1px solid;');
  });

  describe('slot-presence conditions', () => {
    it('resolves a condition naming a slot to $slots across branches, leaving prop and compound conditions bare', () => {
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
      expect(content).toContain('v-if="$slots.icon"');
      expect(content).toContain('v-else-if="$slots.prefix"');
      expect(content).toContain('v-if="pressed"');
      expect(content).toContain('v-if="icon && pressed"');
    });
  });
});
