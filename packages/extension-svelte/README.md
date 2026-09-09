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

The shape above is the default dialect. The `mode` option also emits Svelte 5
runes components from the same template - see [Runes mode](#runes-mode).

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

## Runes mode

The `mode` option selects the emitted dialect. The default, `svelte()` (or
explicitly `svelte({ mode: 'legacy' })`), emits the classic component shape
shown above - `export let` props, `<slot>` elements, and `on:event` bindings. `svelte({ mode: 'runes' })` emits Svelte 5
runes components from the same template: a typed `Props` interface destructured
from `$props()`, snippet props rendered with `{@render}`, and `onevent`
attribute bindings.

The same template drives both. A button with a prop and a click handler:

```ts
const template = defineTemplate({
  type: 'component',
  name: 'Button',
  props: { label: { type: 'string', required: true } },
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

renders as a classic component by default:

```svelte
<script lang="ts">
export let label: string;
</script>

<button class="button" type="button" on:click={handleClick}>{label}</button>
```

and as a runes component under `svelte({ mode: 'runes' })`:

```svelte
<script lang="ts">
interface Props {
  label: string;
}

let { label }: Props = $props();
</script>

<button class="button" type="button" onclick={handleClick}>{label}</button>
```

Across the rest of the template, runes mode maps each construct to its Svelte 5
form:

- **Props** become a typed `Props` interface destructured from `$props()`,
  each declared default carried into the destructure.
- **Slots** become snippet props (`children`, and one per named slot),
  rendered through `{@render}`; a scoped slot's exposed values arrive as one
  object parameter. A snippet prop that shares its name with a projected
  snippet the component declares (its own `icon` slot forwarded into a
  composed child's `icon` slot) destructures under a `<propName>Slot` alias
  and is referenced through it, since the snippet declaration would otherwise
  shadow the prop inside its own body and render itself. A passthrough root
  gathers the consumer's undeclared attributes into `...restProperties` and
  exposes its DOM node through `element = $bindable(undefined)`.
- **Events** become `onevent` attributes. An event attribute takes no modifier
  syntax, so a modifier renders as generated handler code: a guard wrapper for
  `prevent`, `stop`, `self`, and key filters; the capture attribute for
  `capture`; a generated one-shot helper for `once`; and a passive listener
  attachment for `passive`.
- **Events on a passthrough root** share one attribute object with
  `{...restProperties}`, so each binding renders through a generated
  `composeEventHandlers(...)` helper: the component's own handler runs first,
  then any handler the consumer spread onto the root for the same event.
  Neither erases the other, and an element with no handler on either side gets
  no listener.

A component whose script would carry no rune (an event-only component, say) gets
a `<svelte:options runes={true} />` tag so it always compiles as a runes
component.

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
