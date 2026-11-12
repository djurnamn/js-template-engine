import { describe, expect, it } from 'vitest';

import { defineTemplate } from '../src';
import type {
  ConditionalNode,
  ElementNode,
  SlotNode,
  Template,
  TemplateNode,
} from '../src';

/**
 * A component template exercising every component-level concept the types
 * must accept.
 */
const buttonTemplate: Template = defineTemplate({
  type: 'component',
  name: 'Button',
  props: {
    label: { type: 'string', required: true },
    variant: { type: "'primary' | 'secondary'", default: 'primary' },
  },
  imports: ["import { focusRing } from './focus-ring';"],
  script: 'function handleClick(event) { console.log(event); }',
  style: '.button { cursor: pointer; }',
  children: [
    {
      type: 'element',
      tag: 'button',
      attributes: { class: ['button'], type: 'button' },
      conditionalAttributes: [
        {
          condition: "variant === 'primary'",
          attributes: { class: ['button--primary'] },
        },
      ],
      events: [{ name: 'click', handler: 'handleClick' }],
      children: [{ type: 'text', expression: 'label' }],
      extensions: {
        bem: { block: 'button' },
        tailwind: { classes: ['px-4', 'py-2'] },
      },
    },
  ],
  extensions: {
    react: { imports: ["import { useCallback } from 'react';"] },
    vue: { style: '.button { user-select: none; }', styleStrategy: 'replace' },
  },
});

describe('defineTemplate', () => {
  it('returns the template unchanged', () => {
    expect(defineTemplate(buttonTemplate)).toBe(buttonTemplate);
  });

  it('accepts a bare node array without a component wrapper', () => {
    const template = defineTemplate([
      {
        type: 'element',
        tag: 'div',
        children: [{ type: 'text', content: 'Hello World' }],
      },
    ]);
    expect(Array.isArray(template)).toBe(true);
  });

  it('produces plain serializable data (JSON round-trip is lossless)', () => {
    expect(JSON.parse(JSON.stringify(buttonTemplate))).toEqual(buttonTemplate);
  });
});

/*
 * Type-level assertions, verified by `pnpm typecheck` (which includes
 * tests). Each line must keep failing to compile; if a @ts-expect-error
 * stops erroring, typecheck fails.
 */

// @ts-expect-error - unknown node `type` values are rejected
defineTemplate([{ type: 'banner' }]);

// The constrained `$expression` forms on `class` and `style` are accepted:
// sole value, array entries, top-level style property values, and the
// whole-object style expression.
defineTemplate([
  {
    type: 'element',
    tag: 'div',
    attributes: {
      class: ['card', { $expression: 'className' }],
      style: {
        color: 'blue',
        '--badge-size': { $expression: "size + 'rem'" },
      },
    },
  },
  {
    type: 'element',
    tag: 'div',
    attributes: {
      class: { $expression: 'className' },
      style: { $expression: 'computeStyleVariables(props)' },
    },
  },
]);

defineTemplate([
  {
    type: 'element',
    tag: 'div',
    attributes: {
      style: {
        // @ts-expect-error - `$expression` values are invalid inside nested selector blocks
        ':hover': { color: { $expression: 'hoverColor' } },
      },
    },
  },
]);

// Mixing `$expression` with other style keys is rejected by the JSON Schema
// and core validation; structural typing cannot express the sole-key
// constraint (extra properties survive assignability to ExpressionBinding).

// @ts-expect-error - iteration requires `items`, `item`, and `children`
defineTemplate([{ type: 'iteration', items: 'props.users' }]);

defineTemplate([
  {
    type: 'element',
    tag: 'button',
    events: [
      // @ts-expect-error - event modifiers are a closed set
      { name: 'click', handler: 'handleClick', modifiers: ['debounce'] },
    ],
  },
]);

// A key a node, branch, conditional attribute entry or event does not take
// is rejected at that key, at any depth.
defineTemplate([
  {
    type: 'element',
    tag: 'div',
    // @ts-expect-error - an element's style goes in `attributes`
    style: { color: 'red' },
  },
]);

defineTemplate([
  {
    type: 'conditional',
    conditions: [
      {
        statement: 'if',
        condition: 'open',
        children: [
          {
            type: 'element',
            tag: 'section',
            // @ts-expect-error - `componentValued` belongs in a dynamic tag
            componentValued: true,
          },
        ],
      },
    ],
  },
]);

defineTemplate([
  {
    type: 'iteration',
    items: 'items',
    item: 'item',
    children: [
      {
        type: 'element',
        tag: 'Card',
        slots: {
          // @ts-expect-error - a named slot's object form takes content and slotScope
          footer: { content: [], scope: ['api'] },
        },
        events: [
          // @ts-expect-error - an event takes name, handler and modifiers
          { name: 'click', handler: 'select', once: true },
        ],
      },
    ],
  },
]);

defineTemplate({
  type: 'component',
  name: 'Panel',
  children: [
    { type: 'element', tag: 'header' },
    {
      type: 'slot',
      // @ts-expect-error - a slot's default content goes in `fallback`
      children: [],
    },
  ],
});

// A scoped slot can require its scope to be taken; the key is a boolean.
defineTemplate({
  type: 'component',
  name: 'Dialog',
  children: [
    {
      type: 'slot',
      name: 'trigger',
      exposes: { triggerProps: 'api.getTriggerProps()' },
      scopeRequired: true,
    },
    {
      type: 'slot',
      name: 'actions',
      exposes: { closeProps: 'api.getCloseProps()' },
      // @ts-expect-error - `scopeRequired` is a boolean
      scopeRequired: 'yes',
    },
  ],
});

// A typed node built elsewhere and spread into a list still type-checks.
const footer: TemplateNode = { type: 'text', content: 'Footer' };
defineTemplate([{ type: 'fragment', children: [footer, ...[footer]] }]);

// A node held in a value typed as one node type passes, a component
// reference's named slots included.
const heading: ElementNode = { type: 'element', tag: 'h2' };
const fallback: SlotNode = { type: 'slot' };
const branch: ConditionalNode = {
  type: 'conditional',
  conditions: [{ statement: 'if', condition: 'open', children: [] }],
};
defineTemplate({
  type: 'component',
  name: 'Typed',
  children: [
    heading,
    fallback,
    branch,
    { type: 'element', tag: 'section', children: [heading, fallback, branch] },
  ],
});

// An array that mixes in a value typed as the whole `TemplateNode` union is
// not checked here: its other entries' unknown keys are left to validation.
defineTemplate([footer, { type: 'text', content: 'Body', typo: true }]);

// A fragment's framework block names the wrapper that target renders: a
// `tag`, with `attributes` and `events`; another key is an error, and so is a
// block with no `tag`. An element's blocks stay open.
defineTemplate([
  {
    type: 'fragment',
    extensions: {
      react: {
        tag: 'FieldContext',
        attributes: { value: { $expression: 'id' } },
      },
      vue: {
        tag: 'Teleport',
        attributes: { to: 'body' },
        events: [{ name: 'click', handler: 'close' }],
      },
    },
    children: [],
  },
  {
    type: 'element',
    tag: 'div',
    extensions: { react: { tag: 'FieldContext', anything: true } },
  },
  {
    type: 'fragment',
    extensions: {
      // @ts-expect-error - a fragment's block takes tag, attributes and events
      svelte: { tag: 'div', unwrap: true },
    },
    children: [],
  },
  {
    type: 'fragment',
    extensions: {
      // @ts-expect-error - a fragment's block requires a tag
      vue: { attributes: { to: 'body' } },
    },
    children: [],
  },
]);

// A passthrough root routes named attributes to an element below it; a
// shared readonly list is accepted, and the routing object takes only
// `attributes` and `handle`, which is 'root' or 'routed'.
const NATIVE_INPUT_ATTRIBUTES = ['aria-*', 'on*', 'required', 'form'] as const;
defineTemplate({
  type: 'component',
  name: 'Checkbox',
  children: [
    {
      type: 'element',
      tag: 'label',
      passthrough: true,
      children: [
        {
          type: 'element',
          tag: 'input',
          passthrough: { attributes: NATIVE_INPUT_ATTRIBUTES },
        },
        {
          type: 'element',
          tag: 'input',
          passthrough: { attributes: ['*'], handle: 'routed' },
        },
        {
          type: 'element',
          tag: 'input',
          // @ts-expect-error - a handle is 'root' or 'routed'
          passthrough: { attributes: ['*'], handle: true },
        },
        {
          type: 'element',
          tag: 'input',
          // @ts-expect-error - a routing object takes only `attributes` and `handle`
          passthrough: { attributes: ['*'], target: 'input' },
        },
      ],
    },
  ],
});

// A component declares per-instance ids: a prefix, or `{ prefix, prop }`,
// whose object form takes only those two keys.
defineTemplate({
  type: 'component',
  name: 'Command',
  props: { id: { type: 'string' } },
  ids: {
    listId: 'command',
    inputId: { prefix: 'command-input', prop: 'id' },
    // @ts-expect-error - an id's object form takes only `prefix` and `prop`
    labelId: { prefix: 'command-label', fallback: 'label' },
  },
  children: [],
});
