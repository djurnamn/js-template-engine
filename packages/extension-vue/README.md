# @js-template-engine/extension-vue

The Vue framework extension. Renders components defined as plain, typed data
into Vue Single File Components.

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

- a `<script setup lang="ts">` block with the component `imports`, a
  `<Name>Props` interface generated from the declared props, a
  `defineProps<NameProps>()` call (wrapped in `withDefaults` when any prop
  declares a default), and the component `script` content where the
  template's `@event` handlers resolve
- a `<template>` block with the template's concepts translated to idiomatic
  Vue (below)
- a `<style>` block with the collected CSS

Components with no props, imports, or script omit the `<script setup>` block;
components with no styles omit the `<style>` block.

## Concept translation

| Concept | Vue output |
|---|---|
| Text expression | `{{ user.name }}` |
| Attribute binding | `:src="props.avatarUrl"` |
| Conditional | `v-if` / `v-else-if` / `v-else` directives |
| Iteration | `v-for="item in items"` with `:key` |
| Conditional classes | `:class="{ 'btn--lg': size === 'large' }"` alongside static `class` |
| Events | `@click="handleClick"` |
| Slots | `<slot name="...">fallback</slot>` |
| Fragment | sibling nodes (no wrapper) |
| Comment | `<!-- ... -->` |

### Conditionals and iterations

A conditional or iteration whose body is a single element places the
directive directly on that element (`<p v-if="isVisible">`,
`<li v-for="user in users" :key="user.id">`). Any other body shape is
wrapped in a `<template>` element carrying the directive. An iteration
without a `key` renders without one and emits a warning.

### Event modifiers

Every modifier maps to a native Vue modifier, appended to the event name in
declared order: `@submit.prevent`, `@click.stop.once`. Key-guard modifiers
map to Vue's kebab-cased `KeyboardEvent.key` modifiers: `@keyup.enter`,
`@keydown.prevent.arrow-down`. No handler wrappers are generated.

## Output strategies

| Strategy | Styles | Scripts |
|---|---|---|
| `inline` | `style="..."` attributes | - |
| `in-file` (default) | a `<style>` block in the SFC | `<script setup>` |
| `separate-file` | `<Name>.css` + `<style src>` | - |

Styles with nested selectors (pseudo-classes, media queries) always require
a stylesheet and stay in the `<style>` block under the `inline` strategy.
Scripting supports only `in-file`: a Vue SFC wires handlers through
`<script setup>`, so requesting `inline` or `separate-file` scripts with
this extension is a processing error.

The `scss` stylesheet language (`styling.language`) emits nested SCSS. The
SFC `<style>` block is tagged `<style lang="scss">` (composing with
`scoped`) under any strategy, and `separate-file` writes `<Name>.scss` - the
SFC compiler resolves both.

### Scoped styles

The component-level `extensions.vue.scoped` flag renders the SFC's
`<style>` block as `<style scoped>`:

```ts
defineTemplate({
  type: 'component',
  name: 'Button',
  extensions: { vue: { scoped: true } },
  children: [/* ... */],
});
```

It applies only to the in-file `<style>` block; under the `inline` and
`separate-file` styling strategies there is no SFC style block to scope, so
a requested `scoped` is ignored with a warning.

## Node-level overrides

Element nodes may carry Vue-specific overrides under `extensions.vue`:
`attributes` merges into the node's attributes per key, and `events`
replaces the node's event list. Override attributes render verbatim, which
is how framework-specific directives without a generic concept - such as
`v-model` - are authored:

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

Component-level overrides under the root node's `extensions.vue` merge
extension-specific `imports`, `script`, `style`, and `props` into the
component, each with a `merge` (default) or `replace` strategy, alongside
the `scoped` flag.

## License

MIT
