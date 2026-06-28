# @js-template-engine/types

Type definitions for the js-template-engine template format: UI components
defined as plain, JSON-compatible data and rendered to vanilla HTML/CSS/JS or
to framework components.

## Installation

```bash
pnpm add @js-template-engine/types
```

## Usage

```typescript
import { defineTemplate } from '@js-template-engine/types';

export default defineTemplate({
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
      attributes: { class: ['button'], type: 'button' },
      events: [{ name: 'click', handler: 'handleClick' }],
      children: [{ type: 'text', expression: 'label' }],
    },
  ],
});
```

`defineTemplate` is an identity helper: it gives template authors compile-time
checking and autocompletion, and returns the template unchanged.

## The format

A template is either a root `component` node (carrying name, props, script,
style, and imports) or a bare array of nodes. Eight node types cover the
format:

| Node | Purpose |
|---|---|
| `element` | An HTML element with attributes, events, and children |
| `text` | Static `content` or a dynamic `expression` |
| `comment` | A comment in every render target |
| `fragment` | Children without a wrapper element |
| `slot` | A content projection point with optional fallback |
| `conditional` | An `if` / `else-if` / `else` branch list |
| `iteration` | A loop with item, optional index, and optional key |
| `component` | The root-only metadata wrapper |

Dynamic values are JavaScript expressions carried as opaque strings - the
engine emits them verbatim into the target syntax and never evaluates them.
Dynamic attributes are tagged by shape: `src: { $expression: 'props.url' }`.
The same wrapper works on `class` (as array entries or the sole value) and
on `style` (as top-level property values, or as a top-level `$expression`
key holding the whole-object expression - which may coexist with static
properties, nested selectors, and per-property expressions on one node). A
`style` object may also carry Sass `@include`s, written as at-rule keys
(`'@include name': true` for a no-content include, an object for one that
takes a body) - emitted verbatim under SCSS output and resolved to plain CSS
otherwise.

## Root surface forms

A component's single root `element` can opt into a **surface contract** with
`passthrough: true`. The element then forwards consumer-supplied props, merges
an incoming `className`/`class` and `style` with the authored ones, and exposes
a handle to its DOM node - React forwards `{...rest}` and a ref, Vue falls
through `$attrs` and exposes `$el`, Svelte spreads `{...$$restProps}` and binds
the element. The root tag itself can be chosen at runtime with
`tag: { $expression: 'props.as', default: 'button' }`, typed against the
`default` tag. In the HTML rendering the contract is inert preview markup.

### Discriminated surface root

A root that varies between **element shapes with different prop surfaces and
content roles** - a look-alike `<div>` versus an interactive `<input>` - is a
discriminated surface root: a single root `conditional` whose every branch
renders one `passthrough` element, each typically a different intrinsic tag. The
branch condition is the discriminant, authored as a bare prop identifier.

A conditional branch may carry its own **`props`**, scoped to that branch. They
assemble with the component's shared props into a discriminated union: each
branch contributes its element's typed surface plus its branch props, with the
discriminant typed as a literal so the union narrows. A name that is content in
one branch and a native attribute in another (a textbox's `value`) stays a
shared prop, bound explicitly where it is native.

```ts
{
  type: 'component',
  name: 'Input',
  props: {
    value: { type: 'string | number' },
    placeholder: { type: 'string' },
  },
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
              attributes: { class: ['Input', 'Input--visual'] },
              children: [{ type: 'text', expression: 'value ?? placeholder' }],
            },
          ],
        },
        {
          statement: 'else',
          props: { visual: { type: 'false' } },
          children: [
            {
              type: 'element',
              tag: 'input',
              passthrough: true,
              attributes: {
                class: ['Input'],
                value: { $expression: 'value' },
                placeholder: { $expression: 'placeholder' },
              },
            },
          ],
        },
      ],
    },
  ],
}
```

React emits the discriminated-union props type with a body that narrows on the
discriminant; Vue uses `inheritAttrs: false` with two `v-if`/`v-else` roots, each
binding `$attrs`; Svelte emits `{#if}` branches each spreading `{...$$restProps}`;
the HTML rendering previews every branch.

## JSON Schema

Templates are JSON-serializable by construction. The package ships a JSON
Schema generated from these types for validating the JSON transport form:

```typescript
import templateSchema from '@js-template-engine/types/schema/template.schema.json';
```

## License

MIT
