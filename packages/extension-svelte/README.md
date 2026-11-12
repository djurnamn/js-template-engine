# @js-template-engine/extension-svelte

The Svelte target extension. Renders components defined as plain, typed
data into Svelte components.

<!-- example: svelte-process -->
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
  script: "function handleClick() {\n  console.log('clicked');\n}",
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

- a `<script context="module" lang="ts">` block, when the component's imports
  hold declarations other than import statements (a counter, a context, an
  exported type): they run once per module and are shared by every instance,
  and their names are visible to the instance script and the markup
- a `<script lang="ts">` block with the import statements among the
  component `imports`, an `export let`
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
| Attribute binding | `src={avatarUrl}` |
| Conditional | `{#if}` / `{:else if}` / `{:else}` / `{/if}` |
| Iteration | `{#each items as item, i (item.id)}` |
| Conditional classes | `class:btn--lg={size === 'large'}` alongside static `class`; a name a directive cannot carry (`hover:bg-primary/90`), or any conditional class on a `componentValued` root, joins the `class` attribute as `{size === 'large' ? ' hover:bg-primary/90' : ''}` |
| Events | `on:click={handleClick}` |
| Slots | `<slot name="...">fallback</slot>` |
| Fragment | sibling nodes (no wrapper), or the element its `extensions.svelte` block names with `tag` |
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

A prop named by a reserved word is declared under its alias and exported
under its name (`let forProp: string; export { forProp as for };`), and
expressions read the alias, as in the other targets. A legacy component can
export a prop only under a plain name, so a prop such as `aria-pressed` is an
error here, as is a prop named `default`, which a component module cannot
export; runes mode destructures them as `'aria-pressed': ariaPressed` and
`default: defaultProp`.

A prop whose `bindable` is an object (`{ current, setter, defaultProp,
changeProp }`) is read under its `current` name, the given prop when it is
not `undefined` and the default prop otherwise, and changed through the
generated setter, which assigns the prop and then calls the change prop:

```svelte
$: isPressed = pressed !== undefined ? pressed : defaultPressed;
```

Runes mode declares the prop `pressed = $bindable()`, with no fallback, and
reads it through `$derived`. Either way a consumer's `bind:pressed` follows
the component, and with nothing bound the component holds the value itself.
A value given without a binding takes the change locally until the consumer
passes a new one, since Svelte cannot tell a bound prop from a plain one.
Until the first change, a value left to the component reads the default
prop as it is now, so it follows a new default the consumer passes.

A value whose owner holds it - a state-machine driver, a native input,
which handles being controlled or uncontrolled itself - is **relayed**
instead: `bindable: { given, report, changeProp }` keeps no copy. Svelte
cannot tell a bound prop from a plain one: `report` assigns the prop, which
a consumer's `bind:` follows, and with nothing bound the assignment stays in
the component as its own copy, which would turn an owner that keeps its own
state into a controlled one. So the given value passes through an echo
guard, inlined in the component: it is `undefined` while the prop holds only
values the component reported itself, and every value once the consumer
gives one, initially or later:

```svelte
const valueEcho = { recorded: false, last: undefined as string | undefined, controlled: false };
const givenValue = $derived.by(() => {
  if (!valueEcho.controlled && (value === undefined || (valueEcho.recorded && Object.is(value, valueEcho.last)))) {
    return undefined;
  }
  valueEcho.controlled = true;
  return value;
});
function reportValue(next: string) {
  value = next;
  valueEcho.recorded = true;
  valueEcho.last = next;
  onValueChange?.(next);
}
```

Legacy mode keeps `givenValue` in step with a `$:` statement. The report
function assigns the prop first, records the value for the guard, then
calls the change prop, so a consumer that writes the reported value back
writes after the component's own copy. The template forwards `givenValue`
to the owner and hands it `reportValue`, the same text in every target.

### Attributes the browser changes

React and Vue write a bound attribute only when its value changes. Svelte
writes `checked`, `value` and `selected` the same way, but sets a boolean
property such as `open` again whenever anything else in the same block
changes, even when its own value hasn't. In legacy mode an expression also
depends on every name it reads, in both branches of a conditional. So
`open={item.value === defaultValue}` on a `<details>` closes the section a
user just opened as soon as a click handler changes any state the block
reads.

Keep the state the browser changes in the component, so the expression
always gives what the page shows. Have the `toggle` handler record the
change, for example in a two-way value that lists the open sections, and
read it in the expression: `open: { $expression: 'openValues.includes(item.value)' }`.
An expression meant only for the first render, or one that reads state the
handler doesn't update, isn't safe for `open` in Svelte.

### Events on a root that may render a component

A `componentValued` root renders `<svelte:element>` for a tag name and
`<svelte:component>` for a component. On a component, an `on:click` directive
listens for a component event, which a component that doesn't forward it never
sends. So the component branch passes the root's events as event-attribute
props instead, each composed with the consumer's handler for the same event:

```svelte
<svelte:component this={RootTag} {...$$restProps} onclick={composeEventHandlers($$restProps.onclick, toggle)}>
```

`$$restProps` stands for the component's rest here: a component with named
slots reads its rest through `restProperties`, which leaves slot content out.

The component you pass must spread its rest props onto an element, as a kit's
own passthrough `Button` does, or declare the `on*` prop. A component that
forwards `on:click` without either gets none of the root's events. The
consumer's handler runs first, and the template's is skipped when the
consumer calls `event.preventDefault()`. For that, a legacy consumer passes
its handler as a prop too, `<PopoverTrigger as={Button} onclick={...}>`:
an `on:click` on the component reaches neither branch. The element branch
keeps its `on:` directives.

### Event modifiers

Every modifier maps to a native Svelte modifier, appended to the event name
in declared order: `on:submit|preventDefault`,
`on:click|stopPropagation|once`.

Svelte's native modifier set has no key filters, so a key-guard modifier
(`enter`, `escape`, `arrow-down`, ...) wraps the handler in a generated
`event.key` guard. The guard runs first, so `prevent` and `stop` apply only
to the guarded key, as Vue's `@keydown.prevent.enter` does; `self`,
`prevent`, and `stop` follow it in the wrapper in declared order, while
`once`, `capture`, and `passive` stay native pipe modifiers:

```svelte
on:keydown={(event) => { if (event.key !== 'Enter') return; event.preventDefault(); submitSearch(event); }}
```

## Runes mode

The `mode` option selects the emitted dialect. The default, `svelte()` (or
explicitly `svelte({ mode: 'legacy' })`), emits the classic component shape
shown above - `export let` props, `<slot>` elements, and `on:event` bindings. `svelte({ mode: 'runes' })` emits Svelte 5
runes components from the same template: a typed `Props` interface destructured
from `$props()`, snippet props rendered with `{@render}`, and `onevent`
attribute bindings.

Both modes need Svelte 5 or later. Legacy mode is the classic shape, not
Svelte 4 output: a generated wrapper on a dynamic-tag root types its event
parameter in the markup, which Svelte 4 does not compile.

A template that declares `ids` takes each instance's id from `$props.id()` in
runes mode, which needs Svelte 5.20 or later. Legacy mode numbers instances
from one counter on `globalThis` that every component shares, so two
components with the same prefix never render the same id; that counter keeps
counting across server requests, so build with runes when the markup is
rendered on a server and hydrated.

The same template drives both. A button with a prop and a click handler:

<!-- example: svelte-template -->
```ts
const template = defineTemplate({
  type: 'component',
  name: 'Button',
  props: { label: { type: 'string', required: true } },
  script: "function handleClick() {\n  console.log('clicked');\n}",
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

function handleClick() {
  console.log('clicked');
}
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

function handleClick() {
  console.log('clicked');
}
</script>

<button class="button" type="button" onclick={handleClick}>{label}</button>
```

Across the rest of the template, runes mode maps each construct to its Svelte 5
form:

- **Props** become a typed `Props` interface destructured from `$props()`,
  each declared default carried into the destructure.
- **Slots** become snippet props (`children`, and one per named slot),
  rendered through `{@render}`; a scoped slot's exposed values arrive as one
  object parameter, the prop typed `Snippet<[{ ... }]>`. A snippet is always
  a function of that scope, so for a slot marked `scopeRequired: true` the
  consumer passes a snippet either way, and only reading the parameter is
  left to it. Legacy `<slot>` content cannot be made to take the scope (`let:`
  is optional), so there `scopeRequired` changes nothing in the output. A
  snippet prop that shares its name with a projected snippet the component
  declares (its own `icon` slot forwarded into a composed child's `icon`
  slot) destructures under a `<propName>Slot` alias and is referenced
  through it, since the snippet declaration would otherwise shadow the prop
  inside its own body and render itself. A passthrough root
  gathers the consumer's undeclared attributes into `...restProperties` and
  exposes its DOM node through `element = $bindable(undefined)`. When an
  element below it routes attributes (`passthrough: { attributes }`), the root
  spreads `{...consumerAttributes(restProperties, 'root')}`, that element
  `{...consumerAttributes(restProperties, 'routed')}`, and `Props` takes the
  routed keys from that element's attributes; `bind:element` stays on the
  root, or with `handle: 'routed'` binds the routed element, typed after its
  tag. An ID list the root or the routed element sets (`aria-describedby`
  and the like) joins the consumer's through a generated
  `authoredAndConsumer` helper.
  Legacy components split `$$restProps` the same way, and route no
  event handlers, since legacy events are directives rather than attributes.
- **Events** become `onevent` attributes. An event attribute takes no modifier
  syntax, so a modifier renders as generated handler code: a guard wrapper for
  `prevent`, `stop`, `self`, and key filters; the capture attribute for
  `capture`; a generated one-shot helper for `once`; and a passive listener
  attachment for `passive`.
- **Events on a passthrough root** share one attribute object with
  `{...restProperties}`, so each binding renders through a generated
  `composeEventHandlers(...)` helper: any handler the consumer spread onto the
  root for the same event runs first, then the component's own handler,
  unless the consumer called `event.preventDefault()`. Neither erases the
  other, an inline handler keeps the element's event type, and an element
  with no handler on either side gets no listener. A `passive` binding there
  composes in attribute form instead of attaching, its listener not passive,
  since Svelte would run an attached listener before the consumer's handler
  and the consumer could not cancel it. `touchstart` and `touchmove` stay
  passive, as Svelte attaches them by default, so a consumer's
  `preventDefault()` on them has no effect. A `once` binding merged with a
  same-name one keeps its one-shot state in the merged handler for the same
  reason. A key-guarded `once` checks its key before it is used up, so
  another key leaves it armed, and the generated `once` helper accepts an
  unset optional handler. Legacy components do not compose: their `on:` directives run
  beside the spread, so a consumer's handler is not ordered first and cannot
  cancel them. The component branch of a root that may render a component
  is the exception (above), where legacy components compose as runes does.
  A node that spreads a component's `rest` composes its events with the
  consumer's handlers in `rest` the same way.
- **Declarations among the imports** go to a `<script module lang="ts">`
  block, the runes form of the module script.

A component whose script would carry no rune (an event-only component, say) gets
a `<svelte:options runes={true} />` tag so it always compiles as a runes
component.

### A script per mode

The component `script` is emitted as written in both modes, so code that
differs between the dialects goes in the mode blocks of the component's
`extensions.svelte` override. `legacy` applies only in legacy mode, `runes`
only in runes mode, each on top of the override's shared keys, which apply
in both. A legacy reactive statement and its runes `$derived` form then live
in one template:

<!-- example: svelte-script-per-mode -->
```ts
const template = defineTemplate({
  type: 'component',
  name: 'Counter',
  props: { count: { type: 'number', default: 0 } },
  children: [{ type: 'element', tag: 'output', children: [{ type: 'text', expression: 'doubled' }] }],
  extensions: {
    svelte: {
      legacy: { script: '$: doubled = count * 2;' },
      runes: { script: 'const doubled = $derived(count * 2);' },
    },
  },
});
```

A mode block takes the same keys as the override itself - `script`,
`imports`, `style`, `props` and their `merge` or `replace` strategies - and
combines with the component the shared keys produced, so
`scriptStrategy: 'replace'` in a mode block replaces the whole script for
that mode. Both blocks are checked whichever mode you build: a malformed one
is an error naming its path, and a key a block does not read is a warning.

## Stylesheet placements

| Placement | Styles |
|---|---|
| `inline` | `style="..."` attributes |
| `in-file` (default) | a `<style>` block in the component |
| `separate-file` | `<Name>.css` + import from `<script>` |

Styles with nested selectors (pseudo-classes, media queries) always require
a stylesheet and stay in the `<style>` block under the `inline` placement.

The `scss` stylesheet language (`styling.language`) emits nested SCSS. The
`<style>` block is tagged `<style lang="scss">` under any placement (your
Svelte preprocessor compiles it), and `separate-file` writes `<Name>.scss`
imported from `<script>`.

## Node-level overrides

Element nodes may carry Svelte-specific overrides under `extensions.svelte`:
`attributes` merges into the node's attributes per key, and `events`
replaces the node's event list; the build warns, naming each event the
override leaves out, unless an override event of another name takes its
handler or is `change` standing in for `input` (in every target, though
outside React `change` fires on commit, not per keystroke), and an empty list drops them all without a warning. A `class` key is one key: it replaces the
node's whole class list in Svelte, the classes a styling extension such as
BEM or Tailwind gives the node included, so an override that adds a class
repeats the ones it keeps. On a node that spreads `rest`, an override that
adds `rest.class` keeps the consumer's class, which `rest` carries unmerged,
and the build does not warn about the node's own class. Override attributes
render verbatim, which is how framework-specific bindings without a generic
concept - such as the `bind:` family - are authored:

<!-- example: svelte-bind-value -->
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

`ignore` silences Svelte warnings on one element, in Svelte output only: it
emits a `svelte-ignore` comment directly before the element, for a warning
the markup cannot avoid, such as a pointer shortcut whose keyboard route is
elsewhere:

<!-- example: svelte-ignore -->
```ts
{
  type: 'element',
  tag: 'div',
  events: [{ name: 'click', handler: 'open' }],
  extensions: {
    svelte: {
      ignore: ['a11y_click_events_have_key_events', 'a11y_no_static_element_interactions'],
    },
  },
}
// → <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
//   <div on:click={open}>...</div>
```

Component-level overrides under the root node's `extensions.svelte` merge
extension-specific `imports`, `script`, `style`, and `props` into the
component, each with a `merge` (default) or `replace` strategy. Its `legacy`
and `runes` blocks carry the same keys for one mode only (see
[A script per mode](#a-script-per-mode)).

## Reserved names

A Svelte component declares these names itself, in either mode, so in a
build with `svelte()` no prop, slot, loop variable, id, derived value or
script declaration of the template may take them (validation names the
clash):

- in every component: `createBem`, `serializeStyleObject`,
  `consumerStyleValue`, `restProperties`;
- where an event uses the `once` modifier: `once`, `onceRan`;
- where an event uses `passive`: `on`;
- where an event uses `passive` or `once`: `listenerElement`.

A build with `svelte()` also checks the `legacy` and `runes` blocks of
`extensions.svelte` against the shared override shape and reads their
scripts and imports as it reads the override's. The engine reserves its own
names (`bem`, `RootTag`, `Tag`, the surface helpers) in every build.

## License

MIT
