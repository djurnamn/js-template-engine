# @js-template-engine/extension-vue

The Vue target extension. Renders components defined as plain, typed data
into Vue Single File Components.

<!-- example: vue-process -->
```ts
import { process } from '@js-template-engine/core';
import { vue } from '@js-template-engine/extension-vue';
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

const result = process(template, { extensions: [vue()] });
// result.files → [{ path: 'Button.vue', content: '...' }]
```

## Generated components

A template renders as one `<Name>.vue` Single File Component containing, in
order:

- a plain `<script lang="ts">` block, when the component has something for
  it: the declarations written among the component `imports` (a counter, a
  context, an exported type), which run once per module and are shared by
  every instance, and the component description as the doc comment of an
  empty `export default {}`. Names declared there are visible to
  `<script setup>` and the template
- a `<script setup lang="ts">` block with the import statements among the
  component `imports`, a
  `<Name>Props` interface generated from the declared props, the props
  destructured from a `defineProps<NameProps>()` call with their defaults
  inline (`const { label, variant = 'primary' } = defineProps<ButtonProps>();`),
  and the component `script` content where the template's `@event` handlers
  resolve. The script reads each prop by its bare name, as the template does,
  and Vue keeps those reads reactive; a script watching a prop passes a
  getter, `watch(() => open, ...)`, since a bare name is read once. An array or object default becomes a
  fresh value per instance. An optional prop whose type is `boolean` or
  carries a `boolean` or literal `false`/`true` union member is destructured
  with an explicit `undefined` default, so an absent prop is `undefined` as on
  the other scripted targets rather than Boolean-cast to `false`. A prop whose
  name can't be a variable is read by its camel-cased alias, as in the other
  targets (`for: forProp`, `class: classProp`); a hyphenated one is declared
  under that camelized name (`ariaPressed`), the name Vue sets whether the
  consumer writes `aria-pressed` or `ariaPressed`. Under `strictTemplates`
  an optional or two-way `aria-*` prop type-checks in either spelling; a
  required one is satisfied by the camelized spelling only
  (`<IconButton ariaLabel="Close" />`), since vue-tsc checks an `aria-*`
  attribute under the name as written and the requirement sits on the
  camelized key
- a `<template>` block with the template's concepts translated to idiomatic
  Vue (below)
- a `<style>` block with the collected CSS

Components with no props, imports, or script omit the `<script setup>` block;
components with no styles omit the `<style>` block.

The generated components need Vue 3.5 or later, the first release that
compiles a destructured `defineProps` reactively and the first with
`useId()`, which a template's declared `ids` use.

A consumer that type-checks with `strictTemplates` rejects any `data-*`
attribute on an element, since Vue types none, so every authored one, such
as a headless component's `data-state`, fails the check. Allow them in the
consumer's `tsconfig.json`:

<!-- example: vue-compiler-options -->
```json
{ "vueCompilerOptions": { "strictTemplates": true, "dataAttributes": ["data-*"] } }
```

The engine's own generated `data-jte-node` attribute is declared by the
component that carries it and passes without this. So does a `data-*`
attribute a consumer writes on a component that hands its attributes on (a
passthrough root, a discriminated surface or `rest`, such as
`<Button data-testid="save">`): its props interface admits any `data-*`
name.

A passthrough root binds the consumer's attributes itself, with
`defineOptions({ inheritAttrs: false })` and `v-bind="$attrs"` placed after
its own class and style and before its other attributes and listeners, so
its authored attributes win and a consumer's listener runs before the
root's own for the same event. The root's listener runs through a generated
helper with every argument it receives, `@click="(...args) =>
unlessDefaultPrevented(toggle, ...args)"`, which skips it when the consumer
called `event.preventDefault()`. A `capture` listener composes with the
consumer's `onClickCapture`. A node that spreads the component's `rest`
binds its listeners the same way. A `$spread` beside the consumer's
attributes joins the one `v-bind` through Vue's `mergeProps` - on the root,
`v-bind="mergeProps($attrs, extraProps)"`; on a root or an element that
takes its share of them through `consumerAttributes`, and on a node
spreading `rest`, the same call around that share - so the spread adds its
`class`, `style` and listeners to the consumer's rather than replacing
them. When an
element below it routes attributes (`passthrough: { attributes }`), the root
binds `v-bind="consumerAttributes($attrs, 'root')"` and that element
`v-bind="consumerAttributes($attrs, 'routed')"`, and the props interface
extends two `@vue-ignore` bases, the root's attributes without the routed
keys and the routed element's for them, so `@blur` on the component
type-checks against the input. `$el` stays the root; with `handle: 'routed'`
a generated `v-routed-element` directive records the routed element, which
the component exposes through `defineExpose`, so a `ref` the template sets
on it stays its own. It is exposed twice: as `$el`, which Vue types as `any`
on every component instance, and as `element`, typed after the routed tag:
`HTMLElementTagNameMap['input'] | null`, an `SVGElementTagNameMap` entry for
an SVG tag, or `HTMLElement | null` for a custom element or a component a
`tag` override names. So `field.value?.element?.focus()` type-checks against
the input, as React's `ref` and Svelte's `bind:element` do. The usual
`ref<InstanceType<typeof Field>>()` types that handle for a component
without `typeParameters`; Vue gives a generic component no `InstanceType`,
so type its handle after what it exposes
(`ref<{ element: HTMLInputElement | null } | null>(null)`) or with
`ComponentExposed` from `vue-component-type-helpers`. A script that
calls `defineExpose` itself gets both merged into its call. An `element` it
exposes stays its own, with a build warning, and the routed element is then
`$el` only; a computed key read from a variable can't be seen, so name the
key directly. An ID list the root or the routed element sets (`aria-describedby` and the like) joins the consumer's through
a generated `authoredAndConsumer` helper, and a root without a routed element then binds
`consumerAttributes($attrs, 'root', [...])` so the consumer's camel-case spelling of that list stays out of its spread.

## Concept translation

| Concept | Vue output |
|---|---|
| Text expression | `{{ user.name }}` |
| Attribute binding | `:src="avatarUrl"`; an expression holding a `"` and no `'` is single-quoted (`:aria-label='open ? "Close" : "Open"'`), and one holding both has its double-quoted strings rewritten single-quoted; only a `"` outside any string (in a regular expression or a comment) is still written `&quot;` |
| Conditional | `v-if` / `v-else-if` / `v-else` directives |
| Iteration | `v-for="item in items"` with `:key` |
| Conditional classes | `:class="{ 'btn--lg': size === 'large' }"` alongside static `class` |
| Events | `@click="handleClick"` |
| Slots | `<slot name="...">fallback</slot>` |
| Fragment | sibling nodes (no wrapper), or the element its `extensions.vue` block names with `tag` |
| Comment | `<!-- ... -->` |

A scoped slot binds its exposed values on the `<slot>`
(`<slot name="trigger" :triggerProps="triggerProps" />`). Vue cannot make a
consumer's slot content read them, so a slot marked `scopeRequired: true`
renders the same way. Its content has to take the scope itself, as in
`<template #trigger="{ triggerProps }">`; content that ignores the scope still
type-checks and renders.

### Conditionals and iterations

A conditional or iteration whose body is a single element places the
directive directly on that element (`<p v-if="isVisible">`,
`<li v-for="user in users" :key="user.id">`). Any other body shape is
wrapped in a `<template>` element carrying the directive. An iteration
without a `key` renders without one and emits a warning.

### Browser globals

A Vue template sees only a short list of globals, such as `Math`, `Date`,
`JSON` and `console`. When an expression reads another browser global, such
as `document` in `() => document.getElementById(id)?.focus()` or `navigator`
in `navigator.language`, `<script setup>` declares it under its own name,
`const document = globalThis.document;`, and the template reads it as
written. A window function is bound to the window,
`const setTimeout = globalThis.setTimeout?.bind(globalThis);`, so it works
when Vite's development server calls it through the setup state. A prop, a script declaration or a loop variable of the same name
is read instead, and nothing is declared. A global whose value changes with
the page, such as `scrollY`, is not declared: the build warns, and
`window.scrollY` reads it.

### Event modifiers

Every modifier maps to a native Vue modifier, appended to the event name in
declared order: `@submit.prevent`, `@click.stop.once`. Key-guard modifiers
map to Vue's kebab-cased `KeyboardEvent.key` modifiers, and behind one a
handler given by name binds through a generated `invokeHandler`, since Vue's
key guard throws on an unset handler:
`@keyup.enter="(...args) => invokeHandler(submit, ...args)"`. An unset
handler does nothing, and one taking fewer arguments than the listener
(`() => void`) type-checks. On a listener that runs after a consumer's
(above), `prevent`, `stop`, `self` and `once` move into a generated arrow
applied after the `defaultPrevented` check instead: a native `.prevent` would
prevent the default before the check reads it, and a native `.once` would be
used up even when the check skipped the handler. The arrow claims a
one-shot listener for its element through a generated `claimOnceListener`
when the template's handler runs, and returns early once it is claimed, so
each element a `v-for` renders keeps its own one-shot state. On a component
tag the state is shared per component instance, since a component's event
carries no element.

### Two-way props

A prop whose `bindable` is an object (`{ current, setter, defaultProp,
changeProp }`) is declared as an ordinary prop beside a typed `update:`
emit, not with `defineModel`. The component keeps its own copy in a
`shallowRef`, seeded from the default prop, and reads a given prop over it
in a `computed`:

```vue
const { pressed = undefined, defaultPressed = false, onPressedChange } = defineProps<ToggleProps>();
const emit = defineEmits<{ 'update:pressed': [pressed: boolean] }>();
const ownPressed = shallowRef<boolean>(defaultPressed);
const isPressed = computed(() => (pressed !== undefined ? pressed : ownPressed.value));
```

The setter keeps the copy only while the prop is not given, calls the change
prop and then emits `update:pressed`, so a consumer writes
`v-model:pressed="pressed"` on a plain `ref(false)`: the update is typed
`boolean`, never `boolean | undefined`. `= undefined` keeps an absent boolean
from being cast to `false`. A given value with no listener stays as given.
A native control works the way the browser does: Vue writes a bound
`checked` or `value` when its value changes, so an input, textarea or select
a consumer controls keeps the user's change until the value changes. Record
the change in state, with a two-way prop or a handler that writes the value
back, for the control to follow it.
The template reads `isPressed`, which Vue unwraps. The component's shared
`script` reads it bare too, as in React and Svelte: the Vue output reads
each free `isPressed` there as `isPressed.value`, leaving a parameter or
local of the same name, a member such as `menu.isPressed`, an object key,
a class field and a regular expression as they are. A read followed by
`.value` is rewritten too, since the shared script reads the value itself:
`selected.value` is a `{ value }` value's own field, `selected.value.value`
in Vue. A `vue` script override is
written for Vue and stays as written, so it reads `isPressed.value` itself.

A value whose owner holds it - a state-machine driver, a native input,
which handles being controlled or uncontrolled itself - is **relayed**
instead: `bindable: { given, report, changeProp }` keeps no copy. The
given value is a `computed`, reading `modelValue` first when
`extensions.vue.model` names the prop, and `report` calls the change prop
with each new value, then emits:

```vue
const givenValue = computed(() => (modelValue !== undefined ? modelValue : value));
function reportValue(next: string) {
  onValueChange?.(next);
  emit('update:value', next);
  emit('update:modelValue', next);
}
```

The template forwards `givenValue` to the owner and hands it `reportValue`,
the same text in every target; the shared `script` reads `givenValue` bare
and the Vue output reads `givenValue.value`, as for a copy. Every call
passes through: the owner decides what a change is.

A derived value is a `computed` too: `derived: { label: "isPressed ? 'On' :
'Off'" }` becomes `const label = computed(() => isPressed.value ? 'On' :
'Off')`, with `computed` imported from `vue`. Its expression and the
shared `script` read each two-way value and each derived value through
`.value` the same way, and the template reads `label` bare.

A declared id, `ids: { inputId: { prefix: 'field', prop: 'id' } }`, comes
from Vue's `useId()`, called once as `const generatedId = useId();`: an id
without a `prop` is a plain string, `` `field-${generatedId}` ``, and one
with a `prop` a `computed`, `` computed(() => id ?? `field-${generatedId}`) ``,
which the shared `script` reads through `.value` like a derived value.

To bind a bare `v-model`, name the prop in the component-level override:

<!-- example: vue-model -->
```ts
defineTemplate({
  type: 'component',
  name: 'Switch',
  props: {
    checked: { type: 'boolean', bindable: { current: 'isChecked', setter: 'setChecked' } },
  },
  extensions: { vue: { model: 'checked' } },
  children: [
    {
      type: 'element',
      tag: 'button',
      attributes: { type: 'button', role: 'switch', 'aria-checked': { $expression: 'isChecked' } },
      events: [{ name: 'click', handler: '() => setChecked((checked) => !checked)' }],
    },
  ],
});
```

The component then also takes `modelValue`, which stands in for `checked`,
and emits `update:modelValue`, so `v-model="on"` and `v-model:checked="on"`
both bind it. One prop per component answers to a bare `v-model`. A
required prop is declared optional in Vue, since a consumer binding
`v-model` gives its value through `modelValue`.

## Stylesheet placements

| Placement | Styles |
|---|---|
| `inline` | `style="..."` attributes |
| `in-file` (default) | a `<style>` block in the SFC |
| `separate-file` | `<Name>.css` + `<style src>` |

Styles with nested selectors (pseudo-classes, media queries) always require
a stylesheet and stay in the `<style>` block under the `inline` placement.

The `scss` stylesheet language (`styling.language`) emits nested SCSS. The
SFC `<style>` block is tagged `<style lang="scss">` (composing with
`scoped`) under any placement, and `separate-file` writes `<Name>.scss` - the
SFC compiler resolves both.

### Scoped styles

The component-level `extensions.vue.scoped` flag renders the SFC's
`<style>` block as `<style scoped>`:

<!-- example: vue-scoped -->
```ts
defineTemplate({
  type: 'component',
  name: 'Button',
  extensions: { vue: { scoped: true } },
  children: [/* ... */],
});
```

It applies only to the in-file `<style>` block; under the `inline` and
`separate-file` placements there is no SFC style block to scope, so
a requested `scoped` is ignored with a warning.

## Node-level overrides

Element nodes may carry Vue-specific overrides under `extensions.vue`:
`attributes` merges into the node's attributes per key, and `events`
replaces the node's event list; the build warns, naming each event the
override leaves out, unless an override event of another name takes its
handler or is `change` standing in for `input` (in every target, though
outside React `change` fires on commit, not per keystroke), and an empty list drops them all without a warning. A `class` key is one key: it replaces the
node's whole class list in Vue, the classes a styling extension such as
BEM or Tailwind gives the node included, so an override that adds a class
repeats the ones it keeps. Override attributes render verbatim, which
is how framework-specific directives without a generic concept - such as
`v-model` - are authored:

<!-- example: vue-v-model -->
```ts
{
  type: 'element',
  tag: 'input',
  extensions: {
    vue: { attributes: { 'v-model': 'value' } },
  },
}
// → <input v-model="value" />
```

Override attributes merge with the node's by their literal key, so an
override keyed `:value` renders beside the node's own `value` binding rather
than replacing it. To replace a bound attribute for Vue alone, override its
generic key: `vue: { attributes: { value: { $expression: 'draft' } } }`.

Component-level overrides under the root node's `extensions.vue` merge
extension-specific `imports`, `script`, `style`, and `props` into the
component, each with a `merge` (default) or `replace` strategy, alongside
the `scoped` flag.

## Reserved names

A Vue component declares these names itself, so in a build with `vue()` no
prop, slot, loop variable, id, derived value or script declaration of the
template may take them (validation names the clash):

- in every component: `createBem`, `definedProperties`, `routedElement`,
  `vRoutedElement`, `unlessDefaultPrevented`, `usedOnceListeners`,
  `claimOnceListener`, `useAttrs`, `mergeProps`;
- in a component with derived values: `computed`;
- in a component declaring ids: `useId`, `computed`;
- in a component whose passthrough root routes the handle to an element
  (`handle: 'routed'`): `shallowRef`;
- in a component with a two-way prop: `emit` (left out where the
  component's script calls `defineEmits`, which is an error of its own),
  `computed`, `shallowRef`, `latest<Prop>` for each two-way prop (after its
  local name), and `modelValue` when `extensions.vue.model` binds a bare
  `v-model`; a derived value reads neither `emit` nor `latest<Prop>`.

A build with `vue()` also checks what only Vue reads: `extensions.vue.model`
names one two-way prop, as a string; no two props camelize to one key
(`aria-pressed` and `ariaPressed`), since Vue declares a prop under its
camelized key; and beside two-way props, the component `script` and
`extensions.vue.script` call no `defineEmits` of their own. The engine
reserves its own names (`bem`, `RootTag`, `Tag`, the surface helpers) in
every build.

## License

MIT
