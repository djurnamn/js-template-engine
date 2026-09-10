import {
  process,
  TemplateError,
  type StylingExtension,
} from '@js-template-engine/core';
import type { ElementNode, Template } from '@js-template-engine/types';
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
        styling: { outputStrategy: 'separate-file', stylesheetLink: 'none' },
      });
      expect(result.files.map((file) => file.path)).toEqual([
        'Component.svelte',
        'Component.css',
      ]);
      expect(result.files[0].content).not.toContain('import');
      expect(result.files[1].content).toContain('.card {');
    }
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
      `${declaration![0].replace(/:\s*Record<[^)]*>\s*\|\s*null\s*\|\s*undefined/, '').replace('): string {', ') {')}\nreturn serializeStyleObject;`
    )() as (styleObject: Record<string, unknown> | null | undefined) => string;

    expect(serialize({ '--justify': undefined })).toBe('');
    expect(serialize({ '--justify': null, '--align': 'stretch' })).toBe('--align: stretch');
    expect(serialize({ marginTop: 0, opacity: 0 })).toBe('margin-top: 0; opacity: 0');
    // A custom property name is case-sensitive; a capital in it is not a word boundary.
    expect(serialize({ '--kit-component--Badge--size': '1rem' })).toBe('--kit-component--Badge--size: 1rem');
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
          "  variant?: 'primary' | 'secondary';",
          '  pressed?: boolean;',
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
          "type Props = SvelteHTMLElements['div'] & {",
          '  label: string;',
          '  class?: string;',
          '  style?: string;',
          '  element?: HTMLElement;',
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

    it('types a dynamic-root passthrough against HTMLAttributes<HTMLElement>', () => {
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
        "import type { HTMLAttributes } from 'svelte/elements';"
      );
      expect(content).toContain('type Props = HTMLAttributes<HTMLElement> & {');
      expect(content).toContain('<svelte:element');
      expect(content).toContain('this={as}');
      expect(content).toContain('{...restProperties}');
    });

    it('renders a default slot as an optional-chained render tag with a Snippet prop', () => {
      const content = runesContent([
        { type: 'element', tag: 'div', children: [{ type: 'slot' }] },
      ]);
      expect(content).toContain("import type { Snippet } from 'svelte';");
      expect(content).toContain('children?: Snippet;');
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
          '  {/if}',
        ].join('\n')
      );
      expect(content).toContain(
        ['  {#if children}', '    {@render children()}', '  {:else}', '    Body', '  {/if}'].join(
          '\n'
        )
      );
      expect(content).toContain('header?: Snippet;');
      expect(content).toContain('children?: Snippet;');
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
      expect(content).toContain('children?: Snippet<[{ api: any; state: string }]>;');
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
      expect(content).toContain('  icon?: Snippet;');
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
        'onsubmit={(event) => { event.preventDefault(); handleSubmit(event); }}'
      );
      expect(content).toContain(
        'onclick={once((event) => { event.stopPropagation(); trackClick(event); })}'
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
        "{@attach (node) => on(node, 'wheel', handleWheel, { passive: true })}"
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
      expect(content).toContain('<span class="indicator"></span>');
      expect(content).toContain('<img alt="Avatar" />');
      expect(content).toContain('<Icon />');
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
          componentValuedRoot({ attributes: { style: { '--accent': { $expression: 'color' } } } }),
          { extensions: [svelte({ mode })] }
        ).files[0].content;
        expect(content).toContain("{#if typeof RootTag === 'string'}");
        const [stringArm, componentArm] = content.split('{:else}');
        // String arm keeps the element-only `style:` directive.
        expect(stringArm).toContain('style:--accent={color}');
        // Component arm rewrites it to the component CSS-var-prop form.
        expect(componentArm).toContain('--accent={color}');
        expect(componentArm).not.toContain('style:--accent');
        expect(componentArm).toMatch(mode === 'legacy' ? /<svelte:component/ : /<RootTag/);
      }
    });

    it('rejects an element-only class: directive on a component-valued root', () => {
      const template = componentValuedRoot({
        attributes: { class: ['box'] },
        conditionalAttributes: [{ condition: 'on', attributes: { class: ['active'] } }],
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
  });
});
