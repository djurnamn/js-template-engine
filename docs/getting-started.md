# Getting started

This guide walks through the template format and every render target. By
the end you will have defined a component once, as data, and rendered it as
vanilla HTML/CSS/JS, React, Vue, and Svelte - with BEM or Tailwind classes
applied as extensions.

## Install

The quickest path is the CLI:

```bash
npm install --save-dev js-template-engine
```

For type-checked template authoring, add the types package too:

```bash
npm install --save-dev @js-template-engine/types
```

## Your first template

A template is plain, JSON-compatible data. Author it as a TypeScript module
for autocompletion and compile-time checking - `defineTemplate` is an
identity helper that types the data and returns it unchanged:

```ts
// greeting.ts
import { defineTemplate } from '@js-template-engine/types';

export default defineTemplate({
  type: 'component',
  name: 'Greeting',
  children: [
    {
      type: 'element',
      tag: 'p',
      attributes: { class: ['greeting'] },
      children: [{ type: 'text', content: 'Hello!' }],
    },
  ],
});
```

```bash
npx js-template-engine render greeting.ts
# wrote output/Greeting.html
```

With no `--framework` flag, the engine renders vanilla HTML - a working,
zero-dependency output that is also the semantic baseline every framework
target follows.

```bash
npx js-template-engine render greeting.ts --framework react
# wrote output/Greeting.tsx
```

## Components and props

The root `component` node carries the component's metadata: its `name`,
`props`, component-level `script` and `style`, and `imports`. Props declare
a type (any TypeScript type expression), whether they are required, and an
optional default:

```ts
export default defineTemplate({
  type: 'component',
  name: 'Button',
  props: {
    label: { type: 'string', required: true },
    variant: { type: "'primary' | 'secondary'", default: 'primary' },
  },
  script: 'function handleClick(event) {\n  console.log(event);\n}',
  style: '.button {\n  cursor: pointer;\n}',
  children: [
    // ...
  ],
});
```

Framework targets turn `props` into their native form - a typed props
interface in React, `defineProps` in Vue, `export let` declarations in
Svelte. A template can also be a bare array of nodes when component
metadata isn't needed; the component name then comes from the
`--component-name` flag or the source filename.

## Dynamic values

Dynamic values are JavaScript expressions carried as opaque strings. The
engine emits them verbatim into the target syntax - it never evaluates
them.

**Text** is either static `content` or a dynamic `expression`:

```ts
{ type: 'text', content: 'Hello, ' }
{ type: 'text', expression: 'label' }
```

**Attributes** are static by default. A dynamic attribute is tagged by
shape with the `$expression` wrapper:

```ts
{
  type: 'element',
  tag: 'img',
  attributes: {
    alt: 'Avatar',
    width: 48,
    src: { $expression: 'props.avatarUrl' },
  },
}
```

In React this renders `src={props.avatarUrl}`, in Vue `:src`, in Svelte
`src={...}`; the HTML rendering shows a `{{ props.avatarUrl }}`
placeholder.

**Classes** accept `$expression` entries alongside literals - in the array
form or as the sole value:

```ts
attributes: { class: ['card', { $expression: 'className' }] }
attributes: { class: { $expression: 'className' } }
```

Expression classes render after every other class source, a falsy runtime
value contributes nothing (React and Svelte generate falsy guards; Vue's
array `:class` binding drops falsy entries), and they are never used as
generated CSS selectors.

**Styles** take expressions per property - CSS custom properties included -
or as the entire style object (`$expression` as the sole key, evaluating to
an object of camelCase property→value pairs):

```ts
attributes: {
  style: {
    color: 'blue',
    '--badge-size': { $expression: "size + 'rem'" },
  },
}
attributes: { style: { $expression: 'computeStyleVariables(props)' } }
```

Expression styles always render through the target's dynamic mechanism -
React `style` objects, Vue `:style`, Svelte `style:property` directives
(whole-object via a generated serializer helper) - and never enter
generated CSS; static sibling properties follow the configured styling
strategy unchanged. Expressions are invalid inside nested selector blocks:
stylesheets cannot hold runtime values.

**Spread** merges a named runtime object's own properties onto a node with the
reserved `$spread` key. Its value is an `$expression`, or an array of them to
spread several objects in order:

```ts
attributes: {
  $spread: { $expression: 'backdropProps' },
  class: ['overlay'],
}
```

The spread leads the node's attributes, so authored attributes, classes, and
styles follow it and win per key. React renders `{...backdropProps}`, Vue
`v-bind="backdropProps"`, Svelte `{...backdropProps}`; the HTML rendering is
inert, with no runtime object to spread. It works on a component reference the
same way, spreading onto that component's props.

## Conditionals

A `conditional` node holds the whole branch list - `if`, any number of
`else-if`, and an optional `else`:

```ts
{
  type: 'conditional',
  conditions: [
    {
      statement: 'if',
      condition: 'isVisible',
      children: [
        { type: 'element', tag: 'div', children: [{ type: 'text', content: 'Visible' }] },
      ],
    },
    {
      statement: 'else',
      children: [
        { type: 'element', tag: 'div', children: [{ type: 'text', content: 'Hidden' }] },
      ],
    },
  ],
}
```

React renders `&&` or ternary chains, Vue `v-if`/`v-else-if`/`v-else`,
Svelte `{#if}` blocks. The HTML rendering shows every branch between
`<!-- if -->` comments.

**Conditional attributes** put a condition on attributes rather than
markup - the idiomatic form for state-dependent classes:

```ts
{
  type: 'element',
  tag: 'button',
  attributes: { class: ['btn'], type: 'button' },
  conditionalAttributes: [
    {
      condition: "size === 'large'",
      attributes: { class: ['btn--lg'] },
    },
  ],
}
```

React renders a class expression, Vue `:class` object syntax, Svelte
`class:` directives. Styles attached to a conditional class are kept in
the CSS output for every target. `class` and `style` inside
`conditionalAttributes` are literal-only - the condition is their
dynamism; pass-through `$expression` values belong on the node's
`attributes`.

## Iteration

An `iteration` node loops `items` (an expression) binding `item`, an
optional `index`, and an optional `key` for targets that use one:

```ts
{
  type: 'element',
  tag: 'ul',
  children: [
    {
      type: 'iteration',
      items: 'props.users',
      item: 'user',
      index: 'i',
      key: 'user.id',
      children: [
        {
          type: 'element',
          tag: 'li',
          children: [
            { type: 'text', expression: 'i' },
            { type: 'text', content: ': ' },
            { type: 'text', expression: 'user.name' },
          ],
        },
      ],
    },
  ],
}
```

React renders `.map()` with `key`, Vue `v-for` with `:key`, Svelte
`{#each}` with a keyed binding. Omitting `key` emits a warning on targets
that want one.

## Slots

A `slot` node marks a content projection point, optionally named, with
optional fallback children:

```ts
{
  type: 'slot',
  name: 'header',
  fallback: [
    { type: 'element', tag: 'h2', children: [{ type: 'text', content: 'Default header' }] },
  ],
}
```

Vue and Svelte render native `<slot>` elements. React has no slot
primitive, so each slot becomes an optional `ReactNode` prop (the default
slot is `children`; named slots are camelCased prop names) with the
fallback applied via `??`. The HTML rendering shows the fallback in place.

A slot can expose runtime values to whatever fills it through an `exposes`
record - a render prop in React, a scoped `<slot>` in Vue and Svelte:

```ts
{ type: 'slot', exposes: { api: 'api' } }
```

The consuming side names what it receives with `slotScope` (see Composing
components). React calls the children as a function with the exposed scope, Vue
binds `<slot :api="api" />`, Svelte `<slot api={api} />`.

A `conditional` whose `condition` is a bare slot name resolves to that slot's
presence check instead of a plain identifier - the wrapper-when-filled pattern
for an optional icon or affix:

```ts
{
  type: 'conditional',
  conditions: [
    {
      statement: 'if',
      condition: 'icon',
      children: [
        { type: 'element', tag: 'span', children: [{ type: 'slot', name: 'icon' }] },
      ],
    },
  ],
}
```

React renders `props.icon &&`, Vue `v-if="$slots.icon"`, Svelte
`{#if $$slots.icon}`. Only a bare slot name resolves this way; a compound
expression that merely mentions one is emitted verbatim.

## Events

Events sit on the element node, with optional modifiers:

```ts
{
  type: 'element',
  tag: 'form',
  events: [{ name: 'submit', handler: 'handleSubmit', modifiers: ['prevent'] }],
  children: [/* ... */],
}
```

Event names are generic DOM names; each target maps them natively
(`click` → `onClick` in React, `@click` in Vue, `on:click` in Svelte; in
the HTML rendering, handlers are wired in the script block). The modifier
vocabulary is `prevent`, `stop`, `self`, `once`, `capture`, `passive` -
mapped natively where the target supports it (Vue `@submit.prevent`,
Svelte `on:submit|preventDefault`) and wrapped in generated handler code
where it doesn't. A modifier a target cannot express emits a warning.

Key-guard modifiers filter keyboard events on `KeyboardEvent.key`:
`enter`, `escape`, `tab`, `space`, `backspace`, `delete`, `arrow-up`,
`arrow-down`, `arrow-left`, `arrow-right`:

```ts
events: [
  { name: 'keyup', handler: 'submitSearch', modifiers: ['enter'] },
  { name: 'keydown', handler: 'highlightNext', modifiers: ['prevent', 'arrow-down'] },
]
```

Vue maps them natively (`@keyup.enter`, `@keydown.prevent.arrow-down`);
React, Svelte, and the HTML rendering wrap the handler in a generated
`event.key` guard, composed with the other modifiers in declared order.
At most one key modifier per event definition - chained key guards could
never pass together; write multiple accepted keys as separate event
entries.

## Styles and output strategies

Styles live on the nodes they style, as nested style objects supporting
pseudo-classes, media queries, and parent-modifier selectors - nesting
composes recursively, with at-rules wrapping outermost in the emitted CSS:

```ts
{
  type: 'element',
  tag: 'button',
  attributes: {
    class: ['button'],
    type: 'button',
    style: {
      color: 'white',
      backgroundColor: '#007bff',
      ':hover': { backgroundColor: '#0056b3' },
      '@media (min-width: 768px)': { padding: '0.75rem 1.5rem' },
    },
  },
}
```

Where the generated CSS needs a selector, the engine uses the node's first
class; a node with no usable class is marked with a generated
`data-jte-node` attribute and targeted through it - authored class lists
stay untouched.

How styles and scripts are emitted is an output decision, not a template
decision. Both share one strategy vocabulary, set independently:

| Strategy | Styles | Scripts |
|---|---|---|
| `inline` | `style="..."` attributes | `onclick="..."` attributes |
| `in-file` (default) | a `<style>` block in the component file | a `<script>` block |
| `separate-file` | `Button.css` + import/link | `Button.js` + script tag |

```bash
npx js-template-engine render button.ts --framework vue --styling-strategy separate-file
# wrote output/Button.vue, output/Button.css
```

Programmatically: `process(template, { styling: { outputStrategy: 'separate-file' } })`.
Framework component files keep scripts in-file; strategy combinations a
target cannot express fail with a processing error rather than silently
falling back.

### CSS or SCSS output

The stylesheet language is a separate choice - `styling.language`, `'css'`
(default) or `'scss'`. Under `'scss'` the nested style objects emit as
nested SCSS blocks (`&:hover`, nested `@media`, `.ancestor &`) instead of
flattened rules; the two compile to the same cascade.

```bash
npx js-template-engine render button.ts --styling-language scss --styling-strategy separate-file
# wrote output/Button.scss
```

SCSS presumes a build step. Vue and Svelte tag their SFC style block
`<style lang="scss">` under any strategy; the **react target and HTML
mode** support `'scss'` only with `separate-file` (`Button.scss` + an
import or `<link>`) - an in-document `<style>` block a browser can't parse
is a processing error, not a silent fallback. Programmatically:
`process(template, { styling: { language: 'scss', outputStrategy: 'separate-file' } })`.

A style object can also carry Sass `@include`s, written as at-rule keys. The
value is the content block: `true` (or `{}`) for a no-content include, an
object for one that takes a body. Includes interleave with sibling declarations
in authored order, so an include followed by an overriding declaration cascades
as written - legal in any block, nested ones included:

```ts
attributes: {
  style: {
    '@include typography': true,
    fontWeight: 700,
    ':hover': { '@include hover-lift': true },
  },
}
// .label {
//   @include typography;
//   font-weight: 700;
//
//   &:hover {
//     @include hover-lift;
//   }
// }
```

The component-level `style` string is the **file-scope preamble** - `@use`
imports, `$variables`, mixins, and `@keyframes`, emitted ahead of every node
rule, where the includes resolve.

Under `'scss'` output the includes pass through verbatim for your own build to
resolve. Under `'css'` output (or the `inline` strategy) the engine resolves
them itself with Dart Sass against the directories in `styling.loadPaths`,
expanding mixins, functions, and `$variables` to plain CSS - so a template that
authors its styles in Sass still renders to any language a consumer picks. Token
`var()` references survive the compile, so themed output stays reactive. From
the CLI, point at the helper directories with a repeatable `--load-path`.

```bash
npx js-template-engine render button.ts --styling-language css --load-path src/styles
```

(An earlier `$include` key holds the same Sass `@include` source and still
works, but emits a deprecation warning; prefer `@include` at-rule keys.)

### JavaScript or TypeScript output

The script language is the matching choice - `scripting.language`,
`'javascript'` (default) or `'typescript'`. Under `'typescript'` the
generated prop-default consts carry their declared types
(`const variant: 'primary' | 'secondary' = 'primary';`); your component
`script` and event wiring emit verbatim. It governs HTML mode only - the
React, Vue, and Svelte renderers emit TypeScript regardless - and, like
SCSS, presumes a build step, so HTML mode supports it only with
`separate-file` (writing `Button.ts`); `in-file`/`inline` are a processing
error.

```bash
npx js-template-engine render button.ts --scripting-language typescript --scripting-strategy separate-file
# wrote output/Button.ts
```

## Rendering to React, Vue, and Svelte

From the CLI, pick a framework per run:

```bash
npx js-template-engine render src/components --framework react  --output-directory dist/react
npx js-template-engine render src/components --framework vue    --output-directory dist/vue
npx js-template-engine render src/components --framework svelte --output-directory dist/svelte
```

Programmatically, extensions are passed directly - no registry, no string
keys:

```ts
import { process } from '@js-template-engine/core';
import { react } from '@js-template-engine/extension-react';

const result = process(template, { extensions: [react()] });
for (const file of result.files) {
  // { path: 'Button.tsx', content: '...' }
}
```

One framework extension per `process()` call; each render is one target.
Per-framework escape hatches exist as node- and component-level overrides
(`extensions.react`, `extensions.vue`, `extensions.svelte`): attributes and
events a single target should see (`v-model` in Vue, `bind:` in Svelte), and a
per-target `tag`. Each is rendered verbatim by that target and ignored by every
other.

**Composing components.** A `tag` may name a component identifier
(`tag: 'UserAvatar'`) - the way to render one component inside another.
Supply the matching import through the per-extension `imports` overrides
when module paths differ per target:

```ts
{
  type: 'component',
  name: 'UserCard',
  extensions: {
    react: { imports: ["import { UserAvatar } from './UserAvatar';"] },
    vue: { imports: ["import UserAvatar from './UserAvatar.vue';"] },
    svelte: { imports: ["import UserAvatar from './UserAvatar.svelte';"] },
  },
  children: [
    { type: 'element', tag: 'UserAvatar', attributes: { size: 48 } },
  ],
}
```

Framework renderers emit the tag verbatim as a component reference; the
HTML rendering emits the literal `<UserAvatar>` tag as its static preview.

**A different element per target.** The per-target `tag` override swaps the
rendered element for one target - the route for a node that portals differently
in each framework:

```ts
{
  type: 'element',
  tag: 'div',
  extensions: {
    react: { tag: 'Portal' },
    vue: { tag: 'Teleport', attributes: { to: 'body' } },
  },
}
```

React renders `<Portal>`, Vue `<Teleport to="body">`, Svelte and HTML keep the
base `<div>`. A capitalized value is a component reference; bring it into scope
with the component-level `imports` override.

**Filling a composed component's slots.** A component-reference node fills the
default slot with its `children`, named slots with a `slots` map, and receives a
scoped slot's exposed values with `slotScope`:

```ts
{
  type: 'element',
  tag: 'Modal',
  slotScope: ['api'],
  slots: {
    closeButton: [
      { type: 'element', tag: 'button', children: [{ type: 'text', content: 'Close' }] },
    ],
  },
  children: [{ type: 'text', content: 'Body' }],
}
```

React passes each named slot as a prop (`closeButton={...}`) and the exposed scope
as a render prop; Vue emits `<template #closeButton>` and consumes the scope with
`v-slot`; Svelte emits `<svelte:fragment slot="closeButton">` and `let:`. A named
slot can itself be scoped by giving it `{ content, slotScope }` instead of a bare
array.

## Styling extensions: BEM and Tailwind

Styling extensions contribute classes to element nodes; they compose with
any framework target, and with each other.

**BEM.** Declare a block on a container and elements/modifiers on
descendants - the block is inherited from the nearest ancestor that
declares one:

```ts
import { bem } from '@js-template-engine/extension-bem';

// in the template:
{
  type: 'element',
  tag: 'article',
  extensions: { bem: { block: 'media-card', modifiers: ['highlighted'] } },
  children: [
    {
      type: 'element',
      tag: 'h2',
      extensions: { bem: { element: 'title' } },
      children: [{ type: 'text', content: 'Headline' }],
    },
  ],
}

// at render time:
process(template, { extensions: [react(), bem()] });
// → <article class="media-card media-card--highlighted">
//     <h2 class="media-card__title">
```

`bem({ elementSeparator, modifierSeparator })` customizes the separators
(defaults `'__'` and `'--'`).

**Tailwind.** Utility classes ride along per node, written exactly as
Tailwind expects them - variants included:

```ts
import { tailwind } from '@js-template-engine/extension-tailwind';

// in the template:
{
  type: 'element',
  tag: 'div',
  extensions: { tailwind: { classes: ['flex', 'items-center', 'md:px-6'] } },
}

// at render time:
process(template, { extensions: [react(), tailwind()] });
```

Classes merge in a fixed order - static first, then each styling extension
in the order passed, then conditional classes, then expression classes -
with first-occurrence deduplication of the literal sources. A template can carry both `bem` and `tailwind` blocks;
each is inert unless its extension is active, so the same source renders
correctly for every configuration.

**Tailwind without a Tailwind build.** The same utilities can instead be
converted into ordinary CSS: `tailwind({ output: 'styles' })` resolves
them against the bundled Tailwind v4 default theme into each node's style
object - variants become pseudo-selector and media-query blocks - and the
result flows through the normal styling pipeline, so the generated
components are self-contained. How you author and what you ship become
independent choices:

```ts
process(template, { extensions: [react(), tailwind({ output: 'styles' })] });
// → <div className="...">  with generated CSS:
// .panel { display: flex; align-items: center; }
// @media (min-width: 48rem) { .panel { padding-inline: 1.5rem; } }
```

The conversion covers the utilities that resolve to plain declarations on
their own node (see the extension README for the exact table); anything
outside that - and any unknown utility - is a loud processing error, never
a silent drop.

The reverse also works: `tailwind({ convertStyles: true })` turns each
element's authored `style` into utility classes against the same theme -
on-scale values become named utilities, everything else an arbitrary value
or property, so coverage is total. Authoring in plain CSS and shipping
utility-class components becomes just another independent choice:

```ts
process(template, { extensions: [react(), tailwind({ convertStyles: true })] });
// style: { paddingInline: '1rem', display: 'flex' }
// → <div className="px-4 flex">  with no stylesheet
```

From the CLI: `--styling bem`, `--styling tailwind`, or both
(`--styling bem,tailwind`, applied in order); `--tailwind-output styles`
converts utilities to CSS, and `--tailwind-convert-styles` converts CSS to
utilities.

## JSON templates and validation

Templates are serializable by construction, so everything above also works
as plain JSON - the transport form for generators and tooling. The types
package ships a generated JSON Schema for validating it, and the CLI
validates either form directly:

```bash
npx js-template-engine validate src/components
```

`validate` reports each invalid template with the path of the offending
node; programmatically, `process()` throws a `TemplateError` carrying the
same path.

## Building a UI kit

To turn templates into a publishable, multi-framework component library -
single source of truth in `src/components/`, built output per target, and
a consumer CLI that copies components into consuming projects with zero
engine dependencies - use [scaffold-ui-kit](https://github.com/djurnamn/scaffold-ui-kit),
a separate project built on this engine:

```bash
npx scaffold-ui-kit my-ui-kit
```

## Reference

- [`@js-template-engine/types`](../packages/types) - the template format
- [`@js-template-engine/core`](../packages/core) - the engine and extension contract
- [`js-template-engine`](../packages/cli) - the CLI
- [`scaffold-ui-kit`](https://github.com/djurnamn/scaffold-ui-kit) - the kit scaffolder (a separate project)
- Extensions: [react](../packages/extension-react), [vue](../packages/extension-vue),
  [svelte](../packages/extension-svelte), [bem](../packages/extension-bem),
  [tailwind](../packages/extension-tailwind)
