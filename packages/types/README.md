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

Dynamic values are JavaScript expressions carried as opaque strings — the
engine emits them verbatim into the target syntax and never evaluates them.
Dynamic attributes are tagged by shape: `src: { $expression: 'props.url' }`.
The same wrapper works on `class` (as array entries or the sole value) and
on `style` (as top-level property values, or as the entire style object
with `$expression` as its sole key). A `style` object may also carry a
`$include` key — Sass `@include` source emitted verbatim under SCSS output,
the compile-time counterpart of `$expression`.

## JSON Schema

Templates are JSON-serializable by construction. The package ships a JSON
Schema generated from these types for validating the JSON transport form:

```typescript
import templateSchema from '@js-template-engine/types/schema/template.schema.json';
```

## License

MIT
