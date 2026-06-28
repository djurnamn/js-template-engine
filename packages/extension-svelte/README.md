# @js-template-engine/extension-svelte

The Svelte framework extension. Renders components defined as plain, typed
data into Svelte components.

```ts
import { process } from '@js-template-engine/core';
import { svelte } from '@js-template-engine/extension-svelte';
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

const result = process(template, { extensions: [svelte()] });
// result.files → [{ path: 'Button.svelte', content: '...' }]
```

## Generated components

A template renders as one `<Name>.svelte` component containing, in order:

- a `<script lang="ts">` block with the component `imports`, an `export let`
  declaration for each declared prop (typed, with its default when present),
  and the component `script` content where the markup's `on:event` handlers
  resolve
- the markup, with the template's concepts translated to idiomatic Svelte
  (below)
- a `<style>` block with the collected CSS

Components with no props, imports, or script omit the `<script>` block;
components with no styles omit the `<style>` block.

## Concept translation

| Concept | Svelte output |
|---|---|
| Text expression | `{user.name}` |
| Attribute binding | `src={props.avatarUrl}` |
| Conditional | `{#if}` / `{:else if}` / `{:else}` / `{/if}` |
| Iteration | `{#each items as item, i (item.id)}` |
| Conditional classes | `class:btn--lg={size === 'large'}` alongside static `class` |
| Events | `on:click={handleClick}` |
| Slots | `<slot name="...">fallback</slot>` |
| Fragment | sibling nodes (no wrapper) |
| Comment | `<!-- ... -->` |

### Conditionals and iterations

Conditionals and iterations render as Svelte logic blocks wrapping their
children: `{#if condition} ... {/if}` and
`{#each items as item, i (item.id)} ... {/each}`. The iteration index is the
second `as` binding and the `key` expression is the trailing `(...)`; an
iteration without a `key` renders without one and emits a warning.

### Props

Each declared prop becomes a typed `export let` declaration:

```svelte
export let label: string;
export let variant: 'primary' | 'secondary' = 'primary';
```

A required prop with no default is declared without one; an optional prop
with no default defaults to `undefined`.

### Event modifiers

Every modifier maps to a native Svelte modifier, appended to the event name
in declared order: `on:submit|preventDefault`,
`on:click|stopPropagation|once`.

Svelte's native modifier set has no key filters, so a key-guard modifier
(`enter`, `escape`, `arrow-down`, ...) wraps the handler in a generated
`event.key` guard; `self`, `prevent`, and `stop` move into the wrapper with
it in declared order, while `once`, `capture`, and `passive` stay native
pipe modifiers:

```svelte
on:keyup={(event) => { if (event.key !== 'Enter') return; submitSearch(event); }}
```

## Output strategies

| Strategy | Styles | Scripts |
|---|---|---|
| `inline` | `style="..."` attributes | - |
| `in-file` (default) | a `<style>` block in the component | `<script>` |
| `separate-file` | `<Name>.css` + import from `<script>` | - |

Styles with nested selectors (pseudo-classes, media queries) always require
a stylesheet and stay in the `<style>` block under the `inline` strategy.
Scripting supports only `in-file`: a Svelte component wires handlers through
`<script>`, so requesting `inline` or `separate-file` scripts with this
extension is a processing error.

The `scss` stylesheet language (`styling.language`) emits nested SCSS. The
`<style>` block is tagged `<style lang="scss">` under any strategy (your
Svelte preprocessor compiles it), and `separate-file` writes `<Name>.scss`
imported from `<script>`.

## Node-level overrides

Element nodes may carry Svelte-specific overrides under `extensions.svelte`:
`attributes` merges into the node's attributes per key, and `events`
replaces the node's event list. Override attributes render verbatim, which
is how framework-specific bindings without a generic concept - such as the
`bind:` family - are authored:

```ts
{
  type: 'element',
  tag: 'input',
  extensions: {
    svelte: { attributes: { 'bind:value': { $expression: 'name' } } },
  },
}
// → <input bind:value={name} />
```

Component-level overrides under the root node's `extensions.svelte` merge
extension-specific `imports`, `script`, `style`, and `props` into the
component, each with a `merge` (default) or `replace` strategy.

## License

MIT
