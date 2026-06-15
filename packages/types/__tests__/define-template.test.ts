import { describe, expect, it } from 'vitest';

import { defineTemplate } from '../src';
import type { Template } from '../src';

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
 * Type-level assertions, verified by `pnpm type-check` (which includes
 * __tests__). Each line must keep failing to compile; if a @ts-expect-error
 * stops erroring, type-check fails.
 */

// @ts-expect-error — unknown node `type` values are rejected
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
        // @ts-expect-error — `$expression` values are invalid inside nested selector blocks
        ':hover': { color: { $expression: 'hoverColor' } },
      },
    },
  },
]);

// Mixing `$expression` with other style keys is rejected by the JSON Schema
// and core validation; structural typing cannot express the sole-key
// constraint (extra properties survive assignability to ExpressionBinding).

// @ts-expect-error — iteration requires `items`, `item`, and `children`
defineTemplate([{ type: 'iteration', items: 'props.users' }]);

defineTemplate([
  {
    type: 'element',
    tag: 'button',
    events: [
      // @ts-expect-error — event modifiers are a closed set
      { name: 'click', handler: 'handleClick', modifiers: ['debounce'] },
    ],
  },
]);
