# @js-template-engine/extension-react

The React framework extension. Renders components defined as plain, typed
data into React function components in TypeScript.

```ts
import { process } from '@js-template-engine/core';
import { react } from '@js-template-engine/extension-react';
import { defineTemplate } from '@js-template-engine/types';

const template = defineTemplate({
  type: 'component',
  name: 'Button',
  props: {
    label: { type: 'string', required: true },
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

const result = process(template, { extensions: [react()] });
// result.files → [{ path: 'Button.tsx', content: '...' }]
```

## Generated components

A template renders as one `<Name>.tsx` file containing:

- a `<Name>Props` interface generated from the declared props, with optional
  markers and destructured defaults
  (`const { variant = 'primary' } = props;`)
- the component `script` content inside the function body, where handlers
  referenced from JSX are in scope
- JSX with the template's concepts translated to idiomatic React (below)

## Concept translation

| Concept | React output |
|---|---|
| Text expression | `{user.name}` |
| Attribute binding | `src={props.avatarUrl}` |
| Conditional | `{condition && (...)}` / ternary chains for `else` branches |
| Iteration | `{items.map((item) => ...)}` |
| Conditional classes | `className={'btn' + (condition ? ' btn--lg' : '')}` — no runtime dependency |
| Events | `onClick={handleClick}` |
| Fragment | `<>...</>` |
| Comment | `{/* ... */}` |

### Slots become props

React has no slot primitive, so slots render as component props: the default
slot as `children`, named slots as props named after the slot. Slot names
normalize to valid JavaScript identifiers (`navigation-menu` →
`navigationMenu`); two slots normalizing to the same identifier, or a slot
colliding with a declared prop, are processing errors.

Each slot also adds an optional `ReactNode` entry to the generated props
interface, and fallback content renders through `??`:

```tsx
{props.header ?? <h2>Default header</h2>}
```

### Iteration keys

When an iteration body is a single element, its `key` lands directly on it
(`<li key={user.id}>`); any other body shape is wrapped in
`<Fragment key={...}>`. An iteration without a `key` renders without one and
emits a warning.

### Event modifiers

`prevent`, `stop`, and `self` are applied in a generated handler in declared
order, as are the key-guard modifiers (`enter`, `escape`, `arrow-down`, ...),
which become `event.key` guards:

```tsx
onKeyUp={(event) => { if (event.key !== 'Enter') return; submitSearch(event); }}
```

`capture` maps to React's `Capture`-suffixed props
(`onClickCapture`). `once` and `passive` cannot be expressed through React's
declarative event props and emit a warning.

## Output strategies

| Strategy | Styles | Scripts |
|---|---|---|
| `inline` | `style={{ ... }}` objects | — |
| `in-file` (default) | a rendered `<style>` element | script in the component function |
| `separate-file` | `<Name>.css` + import | — |

Styles with nested selectors (pseudo-classes, media queries) always require
a stylesheet and stay in the `<style>` element under the `inline` strategy.
Scripting supports only `in-file`: requesting `inline` or `separate-file`
scripts with this extension is a processing error.

The `scss` stylesheet language (`styling.language`) emits nested SCSS. A
React `<style>` element is injected at runtime and cannot parse SCSS, so
`scss` is supported only with the `separate-file` strategy (`<Name>.scss` +
an import); `in-file` and `inline` under `scss` are a processing error.

## Node-level overrides

Element nodes may carry React-specific overrides under `extensions.react`:
`attributes` merges into the node's attributes per key, and `events`
replaces the node's event list.

```ts
{
  type: 'element',
  tag: 'button',
  events: [{ name: 'click', handler: 'handleClick' }],
  extensions: {
    react: { events: [{ name: 'click', handler: 'handleReactClick' }] },
  },
}
```

Component-level overrides under the root node's `extensions.react` merge
extension-specific `imports`, `script`, `style`, and `props` into the
component, each with a `merge` (default) or `replace` strategy.

## License

MIT
