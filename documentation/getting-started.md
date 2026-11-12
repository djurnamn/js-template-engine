# Getting started

This guide walks through the template format and every render target. By
the end you will have defined a component once, as data, and rendered it as
React, Vue, and Svelte components and as annotated HTML - with BEM or
Tailwind classes applied as extensions.

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

<!-- example: getting-started-greeting -->
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

With no `--target` flag, the engine renders the html target, annotated HTML: a
zero-dependency reference to copy into any framework, server template or
static page. It contains no script. Expressions show as `{{ expression }}`
placeholders, and everything plain HTML cannot express - a branch, a loop, a
slot, an event, a child component - is written as a comment where it sits.

```bash
npx js-template-engine render greeting.ts --target react
# wrote output/Greeting.tsx
```

## Components and props

A component renders one root node. Two or more top-level children make a
fragment: React and Svelte render them side by side, but Vue then has no
single element to pass a consumer's `class` and other attributes to, so it
drops them. Wrap the children in one element when the component should take
them.

The root `component` node carries the component's metadata: its `name`,
`props`, component-level `script` and `style`, and `imports`. Props declare
a type (any TypeScript type expression), whether they are required, and an
optional default:

<!-- example: getting-started-button-props -->
```ts
export default defineTemplate({
  type: 'component',
  name: 'Button',
  props: {
    label: { type: 'string', required: true },
    variant: { type: "'primary' | 'secondary'", default: 'primary' },
  },
  script: 'function handleClick(event: { type: string }) {\n  console.log(event.type);\n}',
  style: '.button {\n  cursor: pointer;\n}',
  children: [
    // ...
  ],
});
```

The React, Vue and Svelte targets turn `props` into their native form - a typed props
interface in React, `defineProps` in Vue, `export let` declarations in
Svelte. A template can also be a bare array of nodes when component
metadata isn't needed; the component name then comes from the
`--component-name` flag or the source filename.

**Module-scope declarations.** `imports` lines are emitted verbatim at module
scope. They sit on the root `component` node, or in its
`extensions.react`, `extensions.vue` or `extensions.svelte` block for lines
only one target needs; an `imports` key on an element is a validation error. Import statements head each target file's script; any other
declaration on an `imports` line runs once per module, not once per instance:
at the top of the React file, in Vue's plain `<script>` block beside
`<script setup>`, and in Svelte's module script. That makes an `imports` line
the place for a type a component's consumers use (each framework file exports
it, and a kit's barrel re-exports it) and for a value every instance shares,
such as a constant or a context:

<!-- example: getting-started-module-scope-imports -->
```ts
imports: [
  "export type TagTone = 'neutral' | 'danger';",
  "export const TAG_TONES: TagTone[] = ['neutral', 'danger'];",
],
props: { tone: { type: 'TagTone', default: 'neutral' } },
```

Module-scope code runs before any instance exists, so it never sees props or
instance state; code that needs them belongs in `script`. An id for each
instance isn't module-scope code either: declare it in `ids` (see Ids per
instance below) and each target generates it its own way. A shared value
several components use belongs in a module of its own that an `imports`
line imports. Where the shared value is behavior rather
than data, write the component as a hand-written driver per target: a
component you write in each framework, which composes a generated one for its
markup.

## Dynamic values

Dynamic values are JavaScript expressions carried as opaque strings. The
engine emits them verbatim into the target syntax. The html rendering
evaluates only an expression that reads declared `ids` alone, and
`renderInstance` evaluates them all. An expression reads a prop by its bare name in every target -
`avatarUrl`, not `props.avatarUrl` - since Vue and Svelte have no `props`
object in scope. A prop whose name can't be a variable is read by its
camel-cased alias in every target: `aria-pressed` as `ariaPressed`, and a
reserved word with `Prop` added, `for` as `forProp` and `class` as
`classProp`. A consumer still passes `aria-pressed` or `for`. Legacy Svelte
can export a prop only under a plain name, so it rejects `aria-pressed` with
an error; runes mode takes it. An alias also steers clear of any name the
component's `script` uses, adding `Prop` again if it has to.

Browser globals such as `document`, `localStorage` or `setTimeout` work in
an expression in every target. A Vue template can't see them on its own, so
the Vue component declares each one its template reads, with a function
such as `setTimeout` bound to the window. A global whose
value changes with the page, such as `scrollY` or `innerWidth`, is the
exception: the Vue build warns, and you read it as `window.scrollY`.

**Text** is either static `content` or a dynamic `expression`:

<!-- example: getting-started-text -->
```ts
{ type: 'text', content: 'Hello, ' }
{ type: 'text', expression: 'label' }
```

**Attributes** are static by default. A dynamic attribute is tagged by
shape with the `$expression` wrapper:

<!-- example: getting-started-attributes -->
```ts
{
  type: 'element',
  tag: 'img',
  attributes: {
    alt: 'Avatar',
    width: 48,
    src: { $expression: 'avatarUrl' },
  },
}
```

In React this renders `src={avatarUrl}`, in Vue `:src="avatarUrl"`, in Svelte
`src={avatarUrl}`; the HTML rendering shows a `{{ avatarUrl }}`
placeholder.

A static value is written as given, a string or a number. React types some
DOM props as numbers only, such as `tabIndex`, `colSpan` and `maxLength`, so
it writes a numeric string given for one of them as the number:
`tabindex: '0'` renders `tabIndex={0}`.

A boolean attribute such as `checked`, `disabled` or `open` binds the same
way: `checked: { $expression: 'checked' }` renders `checked={checked}` in React
and Svelte, and Vue binds it likewise. A boolean attribute is on whatever
its value, so the HTML rendering writes a bound one as a comment before the
element, `<!-- if checked: checked -->`, and leaves the attribute off. Bind it
directly rather than through `conditionalAttributes` (below): an entry renders
`checked={checked ? true : undefined}`, and a controlled input React is given
`undefined` turns uncontrolled. `hidden="until-found"` is a value, not a
boolean: write it as a static attribute.

`indeterminate` is a DOM property only: HTML has no such attribute and React
no such prop. Bind it on the input all the same, and every target sets the
property. Vue and Svelte bind it as a property, and React sets it from a ref
the output generates, `ref={indeterminateRef(indeterminate)}`:

<!-- example: getting-started-indeterminate -->
```ts
// on the component:
rest: { tag: 'input' },
// on the input:
attributes: {
  $spread: { $expression: 'rest' },
  type: 'checkbox',
  indeterminate: { $expression: 'indeterminate' },
},
```

Each target writes the property when the input mounts and when the value
changes, and not on other renders, so a click that clears a mixed box keeps
it cleared until the prop changes, inside an iteration too, and an unset
value clears it. The HTML
rendering can't set a property, so it writes it as a comment before the
input, `<!-- property indeterminate: indeterminate -->`. To set it some
other way in one target, remove it in that target's `attributes` override
with `null`: a key set to `null` removes the node's attribute of that name
in that target alone.

Here the component declares `rest` and spreads it onto the input, so a
consumer's attributes reach it. In React, `rest` also carries the
consumer's `ref`, and the input's own ref, the generated one here, doesn't
replace it: React passes both to `composeRefs`, a small generated helper, so
the component's ref and the consumer's both get the input. A ref on a
passthrough root composes with the forwarded `ref` the same way. An event the
node handles works alike: the consumer's handler for the same event, carried
in `rest`, runs first, then the template's, unless the consumer called
`event.preventDefault()` to cancel it.

A checkbox drawn as a `<label>` around its input can instead keep the label
as its passthrough root, which takes the consumer's class, style and ref, and
send the input only the attributes that belong on it:

<!-- example: getting-started-routed-attributes -->
```ts
{
  type: 'element',
  tag: 'label',
  passthrough: true,
  attributes: { class: ['checkbox'] },
  children: [
    {
      type: 'element',
      tag: 'input',
      passthrough: { attributes: ['aria-*', 'on*', 'name', 'required', 'form'] },
      attributes: { type: 'checkbox' },
    },
    { type: 'slot' },
  ],
}
```

`passthrough: { attributes }` on an element inside the root lists what that
element receives instead of the root: `'aria-*'` for every ARIA attribute,
`'on*'` for every event handler, and HTML attribute names in their HTML
spelling (`tabindex`, which React's `tabIndex` matches). A consumer's
`aria-describedby`, `required` and `onBlur` land on the input; `class`,
`style`, `data-*` and anything else land on the label, and the ref, Vue's
`$el` and Svelte's `bind:element` reach the label. A blur handler then runs,
where focus events that don't bubble would never reach the label in Vue and
Svelte, and a click handler runs once per press instead of twice. `'*'`
sends the input everything except `class`, `style` and `data-*`. React types
the routed props after the input, so `onBlur`'s `event.currentTarget` is the
input. The input's own attributes win over the consumer's, as the root's
do, except for an ID list: an `aria-describedby`, `aria-labelledby`,
`aria-controls`, `aria-owns` or `aria-details` the input or the root sets
joins the consumer's, the element's own IDs first, each once. Legacy Svelte routes no
handlers, since its events are directives rather than attributes. A declared
name in the list is skipped, as under the wildcards; bind it on the element.

A text input that keeps a wrapper `<div>` as its root, Mantine-style, wants
the handle on the input too, so a form library's `ref` and `focus()` reach
the field rather than the wrapper. `handle: 'routed'` moves it there:

<!-- example: getting-started-routed-handle -->
```ts
{
  type: 'element',
  tag: 'div',
  passthrough: true,
  attributes: { class: ['text-input'] },
  children: [
    {
      type: 'element',
      tag: 'input',
      passthrough: { attributes: ['*'], handle: 'routed' },
      attributes: {
        class: ['text-input__input'],
        'aria-describedby': { $expression: 'hintId' },
      },
    },
  ],
}
```

React's `ref` is typed as the input's and composes with a `ref` the template
sets on it. Vue exposes the input as `element`, typed
`HTMLInputElement | null`, and as `$el`, which Vue types as `any` on every
instance. Svelte binds the input to `bind:element`, in both modes. A consumer's `aria-describedby` joins
`hintId`. The default, `handle: 'root'`, leaves the handle on the root. A
routed handle may not sit inside an iteration, where one handle can't name
every item.

**Classes** accept `$expression` entries alongside literals - in the array
form or as the sole value:

<!-- example: getting-started-class-expressions -->
```ts
attributes: { class: ['card', { $expression: 'className' }] }
attributes: { class: { $expression: 'className' } }
```

Expression classes render after every other class source, a falsy runtime
value contributes nothing, and they are never used as generated CSS
selectors. Each expression is evaluated once: React and Svelte guard a plain
reference such as `className` and join any other expression's class list as
an array with its falsy entries dropped, and Vue's array `:class` binding
drops falsy entries itself.

**Styles** take expressions per property - CSS custom properties included -
or as a whole object: a top-level `$expression` key evaluating to an object
of camelCase property→value pairs, alone or beside static and per-property
keys:

<!-- example: getting-started-style-expressions -->
```ts
attributes: {
  style: {
    color: 'blue',
    '--badge-size': { $expression: "size + 'rem'" },
  },
}
attributes: {
  style: {
    $expression: 'computeStyleVariables(size)',
    display: 'flex',
    '--gap': { $expression: 'gap' },
  },
}
```

Expression styles always render through the target's dynamic mechanism -
React `style` objects, Vue `:style`, Svelte `style:property` directives
(whole-object via a generated serializer helper) - and never enter
generated CSS; static sibling properties follow the configured stylesheet
placement unchanged. Inline, the whole object is the base layer and the
per-property values follow it, so they win per key; a static property in the
stylesheet loses to an inline one of the same name, as the cascade decides.
Expressions are invalid inside nested selector blocks: stylesheets cannot
hold runtime values.

**Spread** merges a named runtime object's own properties onto a node with the
reserved `$spread` key. Its value is an `$expression`, or an array of them to
spread several objects in order:

<!-- example: getting-started-spread -->
```ts
attributes: {
  $spread: { $expression: 'backdropProps' },
  class: ['overlay'],
}
```

The spread leads the node's attributes, so authored attributes, classes, and
styles follow it and win per key. React renders `{...backdropProps}`, Vue
`v-bind="backdropProps"`, Svelte `{...backdropProps}`; the HTML rendering
writes a `<!-- spread: backdropProps -->` comment before the element. It works on a component reference the
same way, spreading onto that component's props.

## Conditionals

A `conditional` node holds the whole branch list - `if`, any number of
`else-if`, and an optional `else`:

<!-- example: getting-started-conditional -->
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

<!-- example: getting-started-conditional-attributes -->
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
`class:` directives (a class name a directive cannot carry, such as
`hover:bg-primary/90`, joins the `class` attribute as a guarded
interpolation instead), and the HTML rendering a comment before the element
(`<!-- if size === 'large': class="btn--lg" -->`). Styles attached to a conditional class are kept in
the CSS output for every target. `class` and `style` inside
`conditionalAttributes` are literal-only - the condition is their
dynamism; pass-through `$expression` values belong on the node's
`attributes`.

## Iteration

An `iteration` node loops `items` (an expression) binding `item`, an
optional `index`, and an optional `key` for targets that use one:

<!-- example: getting-started-iteration -->
```ts
{
  type: 'element',
  tag: 'ul',
  children: [
    {
      type: 'iteration',
      items: 'users',
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

<!-- example: getting-started-slot-fallback -->
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
fallback applied via `??`. The HTML rendering shows the fallback between
`<!-- slot -->` and `<!-- /slot -->` comments, or the opening comment alone
where a slot has no fallback.

A slot can expose runtime values to whatever fills it through an `exposes`
record - a render prop in React, a scoped `<slot>` in Vue and Svelte:

<!-- example: getting-started-slot-exposes -->
```ts
{ type: 'slot', exposes: { api: 'api' } }
```

The consuming side names what it receives with `slotScope` (see Composing
components). React calls the children as a function with the exposed scope, Vue
binds `<slot :api="api" />`, Svelte `<slot api={api} />`. The string form,
as here, types the binding `any` in React and Svelte runes; the object form,
`{ value: 'api', type: 'MenuApi' }`, gives it a type, which is what to use.

When content cannot work without the scope, such as a trigger that has to
spread the props it is given, add `scopeRequired: true`:

<!-- example: getting-started-slot-scope-required -->
```ts
{
  type: 'slot',
  name: 'trigger',
  exposes: { triggerProps: { value: 'api.getTriggerProps()', type: 'Record<string, unknown>' } },
  scopeRequired: true,
}
```

React then types the `trigger` prop as the render function alone, so a plain
element there fails the typecheck instead of rendering a button that does
nothing. Svelte runes types every scoped snippet as a function already, and
Vue and legacy Svelte cannot refuse content that ignores the scope, so there
the key only documents the slot. A slot with `scopeRequired` and no `exposes`
is a validation error.

A `conditional` whose `condition` is a bare slot name resolves to that slot's
presence check instead of a plain identifier - the wrapper-when-filled pattern
for an optional icon or affix:

<!-- example: getting-started-slot-presence -->
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
`{#if $$slots.icon}`. The name resolves wherever an expression reads it as a
variable, so `!icon` and `icon && compact` work too, in a condition, an
attribute or a class. A name the expression binds itself reads that binding
instead: a loop's `item` or `index`, a `slotScope` binding, or a function's
own parameter, as in `options.find((icon) => icon.value === picked)`. A
string `'icon'`, an object key and a member such as `item.icon` are left
alone.

## Events

Events sit on the element node, with optional modifiers:

<!-- example: getting-started-events -->
```ts
{
  type: 'element',
  tag: 'form',
  events: [{ name: 'submit', handler: 'handleSubmit', modifiers: ['prevent'] }],
  children: [/* ... */],
}
```

Event names are generic DOM names; each target maps them natively
(`click` → `onClick` in React, `@click` in Vue, `on:click` in Svelte; the
HTML rendering writes `<!-- on click: handleClick -->` before the element,
modifiers included). React writes the bubbling `focusin` and `focusout` as
`onFocus` and `onBlur`, which listen for them, and warns about an event name
it has no prop for. The modifier
vocabulary is `prevent`, `stop`, `self`, `once`, `capture`, `passive` -
mapped natively where the target supports it (Vue `@submit.prevent`,
Svelte `on:submit|preventDefault`) and wrapped in generated handler code
where it doesn't. A modifier a target cannot express emits a warning.

Key-guard modifiers filter keyboard events on `KeyboardEvent.key`:
`enter`, `escape`, `tab`, `space`, `backspace`, `delete`, `arrow-up`,
`arrow-down`, `arrow-left`, `arrow-right`:

<!-- example: getting-started-key-modifiers -->
```ts
events: [
  { name: 'keyup', handler: 'submitSearch', modifiers: ['enter'] },
  { name: 'keydown', handler: 'highlightNext', modifiers: ['prevent', 'arrow-down'] },
]
```

Vue maps them natively (`@keyup.enter`, `@keydown.prevent.arrow-down`);
React and Svelte wrap the handler in a generated `event.key` guard. The guard
runs before the other modifiers, so `prevent` cancels only the guarded key in
every target, as it does in Vue.
At most one key modifier per event definition - chained key guards could
never pass together; write multiple accepted keys as separate event
entries. The modifier list is closed, and any other modifier is a
validation error. For another key, such as `Home`, `End` or a letter, use a
handler without modifiers that reads `event.key` itself.

A `handler` is any expression that yields a function: an identifier
(`handleSubmit`), an arrow (`() => onRemove?.(item.id)`), or an expression
that may yield none (`onSave ? (event) => onSave(event) : undefined`), which
attaches nothing in React and Svelte. Vue binds a member path
(`handleSubmit`, `actions.save`) or a function literal as it is and calls any
other expression with the event,
`@click="(<handler>)?.($event)"`, so it too does nothing when it yields none.
Where a target wraps a handler for a modifier or a key guard, it calls a
named handler with the event, and a handler that declares fewer parameters,
such as `() => void`, type-checks there in every target; one that needs a
parameter the listener doesn't pass is a type error. A method given by path
(`actions.save`) keeps its `this`.

React passes its own synthetic event, not the DOM one, so a handler shared
between targets in the component `script` should type its event by the
members it reads rather than as a DOM `KeyboardEvent`:

<!-- example: getting-started-shared-handler -->
```ts
script: 'function handleKeydown(event: { key: string; preventDefault(): void }) {\n  if (event.key === "Escape") close();\n}',
```

A shared handler that reads the element, such as a select's value, reads it
through `event.target` with a cast:

<!-- example: getting-started-shared-element-handler -->
```ts
script: 'function handleChange(event: { target: EventTarget | null }) {\n  onPick?.((event.target as HTMLSelectElement).value);\n}',
// on the select:
events: [{ name: 'change', handler: 'handleChange' }],
```

`event.currentTarget.value` compiles in React and Svelte, which type the
current target by the element, but not in Vue: there `currentTarget` is a
plain `EventTarget` that may be `null`, so vue-tsc rejects it. The cast on
`event.target` compiles in every target.

On a controlled input, React expects `onChange` beside a bound `value`, and
the generic `input` event renders as `onInput`. Give React the `change` event
through an events override, `extensions: { react: { events: [{ name:
'change', handler: 'handleInput' }] } }`, and keep `input` for the other
targets. The override replaces the node's whole event list in React, so it
repeats any other event the node declares, and the build warns, naming each
event an override leaves out. The `change` event counts as `input`'s
replacement whatever its handler reads, as does an event of another name
that takes a left-out event's handler, and an empty list drops the node's
events without a warning. The `change` rule holds in every target's
override, but outside React `change` fires when the value is committed, not
on each keystroke, so swap it in only for React unless that is what you
want.

## Component events and state

A component's own events are function props named `on<Event>`, typed to
return nothing. The component calls the prop from a handler, and each
target's consumer passes it as that target expects:

<!-- example: getting-started-component-events -->
```ts
props: {
  id: { type: 'string', required: true },
  onRemove: { type: '(id: string) => void', description: 'Called when the remove button is pressed.' },
},
// on an element inside the component:
events: [{ name: 'click', handler: '() => onRemove?.(id)' }],
```

| Target | The consumer writes |
|---|---|
| React | `<Tag onRemove={remove} />` |
| Vue | `<Tag @remove="remove" />` (or `:onRemove="remove"`) |
| Svelte | `<Tag onRemove={remove} />`, in both modes; a legacy `on:remove` directive listens for a dispatched event, which the component never sends |

**Two-way values.** A value the consumer may own or leave to the component,
such as a disclosure's `open`, is a prop whose `bindable` names the
protocol: the name the template reads the value by, a setter it changes the
value through, the prop the component's own copy starts from, and the event
prop reporting each change. Every target generates the rest:

<!-- example: getting-started-state -->
```ts
props: {
  open: {
    type: 'boolean',
    description: 'Whether the details show. Leave it out to let the disclosure keep its own.',
    bindable: { current: 'isOpen', setter: 'setOpen', defaultProp: 'defaultOpen', changeProp: 'onOpenChange' },
  },
  defaultOpen: { type: 'boolean', default: false },
  onOpenChange: { type: '(open: boolean) => void' },
},
// in the template:
attributes: { 'aria-expanded': { $expression: 'isOpen' } },
events: [{ name: 'click', handler: '() => setOpen((open) => !open)' }],
```

When the consumer gives `open`, the disclosure shows it and reports changes
through `onOpenChange`. When it doesn't, the disclosure keeps its own value,
starting from `defaultOpen`, which declares the same type as `open` (the
build checks it). `isOpen` is the value either way, and
`setOpen` takes the next value or a function from the current one to the
next, skipping a value that hasn't changed. A `<select>` bound to a prop
with no handler writing the change back differs per target: React restores
the prop's value after a pick, and Vue and Svelte keep the pick. A two-way
value agrees in every target. Each target binds it the way its consumers
expect:

| Target | The consumer writes | The component generates |
|---|---|---|
| React | `<Disclosure open={open} onOpenChange={setOpen} />`, or `defaultOpen` alone | `useState` seeded from `defaultOpen`, a given `open` read over it, and `'use client'` |
| Vue | `<Disclosure v-model:open="open" />`, on a plain `ref(false)` | an `open` prop and a typed `update:open` emit, not `defineModel` |
| Svelte | `<Disclosure bind:open />`, in both modes | runes: `open = $bindable()` read through `$derived`; legacy: `export let` read through `$:` |

`null` counts as a given value: only `undefined` leaves the value to the
component. A value given with nothing writing back stays as given in React
and Vue: `<Disclosure open />` without `onOpenChange` or `v-model` holds
open. Svelte can't tell a bound prop from a plain one, so there a value given
without `bind:` takes the component's change locally until the consumer
passes a new one; a Svelte consumer that controls the value binds it. The setter calls `onOpenChange` with every new value in every
target, ahead of Vue's `update:open` emit. The
component's `script` calls `setOpen` and reads `isOpen` the same way, in
every target: `function toggle() { setOpen(!isOpen); }` works as written.
In Vue `isOpen` is a `computed`, so the Vue output reads it as
`isOpen.value` in the script for you; when the value is an object with a
`value` field of its own, `selected.value` reads that field in every
target. A `vue` script override is written for Vue alone and reads
`isOpen.value` itself. Neither the script nor an event handler assigns
`isOpen`: the build rejects it and names `setOpen`. A read at the script's top
level, outside
any function, runs once in Vue and Svelte but on every render in React, so
read the value inside the function that needs it.

Calls to `setOpen` in one handler build on each other: two
`setOpen((open) => !open)` calls leave the disclosure as it was, in every
target.

Passing `open` without a way to report changes back keeps the disclosure
where the consumer set it in React and Vue. Svelte can't tell a bound prop
from a plain one, so it takes the click locally until the consumer passes a
new value. Svelte also keeps no separate copy: until the first click, a
disclosure left to itself reads `defaultOpen` as it is now, so it follows a
new `defaultOpen`, where React and Vue start from the first one.

A native checkbox, input or select bound to a value that nothing writes back
behaves differently. Vue and Svelte write a bound property only when its
value changes, so the control keeps the user's click or keystroke, as the
browser does. React puts its controlled input back. For the control to
follow the value in every target, record the change in state, with a
two-way prop or a handler that writes the value back.

A boolean attribute the browser also changes, such as `open` on a
`<details>`, needs its state kept in the component. React and Vue write the
attribute only when its value changes, but Svelte sets `open` again whenever
anything else in the same block changes. An expression meant only for the
first render, such as `item.value === defaultValue`, then closes a section
the user just opened as soon as a handler changes other state. Have the
`toggle` handler record the change, in a two-way value that lists the open
sections, say, and read that in the expression. Then each write gives what
the page already shows, in every target. Svelte writes `checked`, `value`
and `selected` only on a change, as the other targets do.

For Vue consumers who write a bare `v-model`, the component override
`extensions.vue: { model: 'open' }` names the one two-way prop it binds. The
Vue component then also takes `modelValue` and emits `update:modelValue`, and
`v-model:open` keeps working.

The html target has no state: it reads the value prop, else the default
prop, and says so in a comment above the element (`<!-- isOpen: open, else
defaultOpen -->`). A preview story's html reads the same way, so a story that
gives neither shows the template's own default.

`bindable: true` is the binding alone, for a component whose own scripts
change the value: Svelte in runes mode declares the prop with `$bindable()`,
so a consumer can write `bind:open`, and the other targets ignore it.

**Derived values.** A value computed from props and two-way values, such
as the rows a filter leaves, is written once in the component's `derived`
map, by name, in the order the values read each other:

<!-- example: getting-started-derived -->
```ts
props: {
  items: { type: 'string[]', required: true },
  query: {
    type: 'string',
    bindable: { current: 'search', setter: 'setQuery', defaultProp: 'defaultQuery' },
  },
  defaultQuery: { type: 'string', default: '' },
},
derived: {
  matches: 'items.filter((item) => item.toLowerCase().includes(search.toLowerCase()))',
  summary: '`${matches.length} of ${items.length}`',
},
// in the template:
children: [{ type: 'text', expression: 'summary' }],
```

Each target keeps it in step with what it reads:

| Target | The component generates |
|---|---|
| React | `const matches = ...;` after the props and two-way values, recomputed each render |
| Vue | `const matches = computed(() => ...)`, the expression reading `search.value` |
| Svelte | runes: `const matches = $derived(...)`; legacy: `$: matches = ...` |

The template and the component's `script` read `matches` and `summary` by
name in every target; in Vue the script's reads become `matches.value` for
you, as a two-way value's do. An expression reads props, two-way values,
derived values above it and anything the `imports` lines declare, such as
a sorting helper. It can't read a function the component's `script`
declares, since React computes the values ahead of the script: the build
names the function and asks for it in `imports`. That works for a pure
helper or a constant. A derived value can read an id the component
declares in `ids`, below. A value the script reads per instance from a
context can't move to module scope, so keep it, and anything computed from
it, in the script. A derived value is never
assigned; the build rejects a script, an event handler or any other
expression that does. The html target lists each derived value and its
expression in a comment at the top, and a preview story's html shows the
value computed from the story's props, calling the helpers the `imports`
lines declare.

**Ids per instance.** Wiring such as `aria-controls`, `aria-labelledby`,
a label's `for` or a radio group's `name` needs an id that's different for
each instance. Declare it in `ids` with the literal prefix it starts with,
or `{ prefix, prop }` to let a string prop the consumer gives replace it:

<!-- example: getting-started-ids -->
```ts
props: {
  name: { type: 'string', description: 'The form field name. Each group gets its own when it is left out.' },
  value: { type: 'string', default: '' },
},
ids: {
  groupName: { prefix: 'choice', prop: 'name' },
  hintId: 'choice-hint',
},
// in the template:
attributes: {
  type: 'radio',
  name: { $expression: 'groupName' },
  'aria-describedby': { $expression: 'hintId' },
},
```

The template, the component's `script` and derived values read each id by
name, like a prop. With `prop`, the id is the consumer's value when they
give one, and the generated id when it's `undefined`.

| Target | The component generates |
|---|---|
| React | `const generatedId = useId();`, then `` const hintId = `choice-hint-${generatedId}`; `` |
| Vue | the same from Vue 3.5's `useId()`; an id with a `prop` is a `computed` |
| Svelte | runes: `const generatedId = $props.id();` (Svelte 5.20 or later); legacy: one counter every component on the page shares |

The html target writes `choice-1` and `choice-hint-1`, wherever an
expression reads only ids, so the copied markup's radios share a name and
its aria references resolve; a comment at the top names each id. A preview
story's html numbers each prefix through the page, so two instances get
`choice-1` and `choice-2`. React's ids hold characters a CSS selector
doesn't take as they are (React 19.2 renders `_R_1_`, earlier versions `:`
or `«»`), so pass an id through `CSS.escape()` before using it in a
selector. Legacy
Svelte's counter keeps counting across server requests, so its ids don't
match between server rendering and hydration; build with runes when a
Svelte kit renders on the server.

**State per target.** Two-way values are the only state the engine
generates. A value that isn't a prop, such as a copy button's "Copied" note,
lives in a per-target `script` override, and the template reads the names
the scripts define:

<!-- example: getting-started-local-state -->
```ts
props: {
  text: { type: 'string', required: true },
},
extensions: {
  react: {
    imports: ["import { useState } from 'react';"],
    script: 'const [copied, setCopied] = useState(false);\nfunction copy() {\n  void navigator.clipboard.writeText(text);\n  setCopied(true);\n}',
  },
  vue: {
    imports: ["import { ref } from 'vue';"],
    script: 'const copied = ref(false);\nfunction copy() {\n  void navigator.clipboard.writeText(text);\n  copied.value = true;\n}',
  },
  svelte: {
    script: 'function copy() {\n  void navigator.clipboard.writeText(text);\n  copied = true;\n}',
    legacy: { script: 'let copied = false;' },
    runes: { script: 'let copied = $state(false);' },
  },
},
// in the template:
events: [{ name: 'click', handler: 'copy' }],
children: [{ type: 'text', expression: "copied ? 'Copied' : 'Copy'" }],
```

The state line is written per Svelte mode, since runes mode needs `$state`
for a reactive `let`: the `legacy` and `runes` blocks of the Svelte
override each apply only in their own mode, after the shared `script`, so
the template builds in both.
A target's `script` is itself added after the template's top-level `script`
(`scriptStrategy: 'replace'` in the override replaces it instead), so a
function every target shares goes in the top-level `script` once. A copy in a
target's `script` as well declares it twice, which does not compile.
Effects and the context a compound's parts share stay in scripts the same
way. A component whose behavior differs too much between
targets is written by hand per target as a driver composing a generated
one; scaffold-ui-kit kits keep drivers beside the templates.

The engine passes scripts through without reading them, so a script that
declares a prop's own name, such as `const text = ...` beside a `text` prop,
is not caught at build. React's and Svelte's compilers reject it as a name
declared twice. In Vue the script's `text` shadows the prop: the template
reads the script's value, as Vue reads a script binding over a prop, and the
prop is destructured under another name. A script that declares a two-way
value's name or setter is caught: the build says which.

Vue reads a ref through `.value`, so under `noUncheckedIndexedAccess` a check
like `filtered[i] && choose(filtered[i])` narrows in React and not in Vue's
`filtered.value[i]`. Bind the element to a `const` first, then test and use
that.

## Styles and stylesheet placement

Styles live on the nodes they style, as nested style objects supporting
pseudo-classes, media queries, and parent-modifier selectors - nesting
composes recursively, with at-rules wrapping outermost in the emitted CSS:

<!-- example: getting-started-styles -->
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
stay untouched. The value names the component and counts its marked nodes
(`data-jte-node="Card-0"`), so components sharing a page never match each
other's elements.

Where styles are emitted - the stylesheet placement - is an output decision,
not a template decision:

| Placement | Styles |
|---|---|
| `inline` | `style="..."` attributes |
| `in-file` (default) | a `<style>` block in the component file |
| `separate-file` | `Button.css` + import/link |

```bash
npx js-template-engine render button.ts --target vue --stylesheet-placement separate-file
# wrote output/Button.vue, output/Button.css
```

Programmatically: `process(template, { styling: { placement: 'separate-file' } })`.
Placements a target cannot express fail with a processing error
rather than silently falling back.

Under `separate-file` the component links the stylesheet it owns - an
`import` on react and svelte, a `<style src>` block on a Vue SFC, a `<link>`
in the html target. `--stylesheet-link none` emits the stylesheet and links it from
none of them, so a consumer decides how the styles are loaded: one aggregate
stylesheet, per-component imports, or a build of its own.

```bash
npx js-template-engine render button.ts --target react \
  --stylesheet-placement separate-file --stylesheet-link none
# wrote output/Button.tsx (no import), output/Button.css
```

Programmatically: `process(template, { styling: { placement: 'separate-file', stylesheetLink: 'none' } })`.
It needs a stylesheet to leave unlinked, so pairing it with `in-file` or
`inline` is a processing error.

### Cascade layers

`styling.layer` wraps the emitted rules in a cascade layer, so a component
holds one position in the cascade however its styles are taken - from an
aggregate stylesheet or from the per-component one beside it:

```bash
npx js-template-engine render button.ts --styling-layer kit.components \
  --styling-layer-order kit.reset,kit.base,kit.components
```

```css
@layer kit.reset, kit.base, kit.components;

@layer kit.components {
  .button { ... }
}
```

The order statement is emitted in every stylesheet, because cascade-layer
order is fixed by first declaration and a per-component stylesheet may be the
first thing a consumer loads; repeating an identical order costs nothing.
Omit `--styling-layer-order` when something the page already loads declares
it. The layer applies under every stylesheet placement wherever rules reach a
stylesheet - inline `style="..."` declarations carry none - and under `scss`
the preamble's `@use` and `@forward` loads stay above the layer block, where
sass requires them. Programmatically:
`process(template, { styling: { layer: { name: 'kit.components', order: [...] } } })`.

### CSS or SCSS output

The stylesheet language is a separate choice - `styling.language`, `'css'`
(default) or `'scss'`. Under `'scss'` the nested style objects emit as
nested SCSS blocks (`&:hover`, nested `@media`, `.ancestor &`) instead of
flattened rules; the two compile to the same cascade.

```bash
npx js-template-engine render button.ts --styling-language scss --stylesheet-placement separate-file
# wrote output/Button.scss
```

SCSS presumes a build step. Vue and Svelte tag their SFC style block
`<style lang="scss">` under any placement; the **react and html
targets** support `'scss'` only with `separate-file` (`Button.scss` + an
import or `<link>`) - an in-document `<style>` block a browser can't parse
is a processing error, not a silent fallback. Programmatically:
`process(template, { styling: { language: 'scss', placement: 'separate-file' } })`.

A style object can also carry Sass `@include`s, written as at-rule keys. The
value is the content block: `true` (or `{}`) for a no-content include, an
object for one that takes a body. Includes interleave with sibling declarations
in authored order, so an include followed by an overriding declaration cascades
as written - legal in any block, nested ones included:

<!-- example: getting-started-sass-includes -->
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
resolve. Under `'css'` output (or the `inline` placement) the engine resolves
them itself with Dart Sass against the directories in `styling.loadPaths`,
expanding mixins, functions, and `$variables` to plain CSS - so a template that
authors its styles in Sass still renders to any language a consumer picks. Token
`var()` references survive the compile, so themed output stays reactive. From
the CLI, point at the helper directories with a repeatable `--load-path`.
`styling.sassImporters` passes Dart Sass importers to the same compiles, such
as one resolving a package's own `pkg:` URLs; a preamble that loads a `pkg:`
URL is resolved even without load paths.

```bash
npx js-template-engine render button.ts --styling-language css --load-path src/styles
```

(An earlier `$include` key holds the same Sass `@include` source and still
works, but emits a deprecation warning; prefer `@include` at-rule keys.)

## Rendering to React, Vue, and Svelte

From the CLI, pick a target per run:

```bash
npx js-template-engine render src/components --target react  --output-directory dist/react
npx js-template-engine render src/components --target vue    --output-directory dist/vue
npx js-template-engine render src/components --target svelte --output-directory dist/svelte
```

Programmatically, extensions are passed directly - no registry, no string
keys:

<!-- example: getting-started-process -->
```ts
import { process } from '@js-template-engine/core';
import { react } from '@js-template-engine/extension-react';

const result = process(template, { extensions: [react()] });
for (const file of result.files) {
  // { path: 'Button.tsx', content: '...' }
}
```

One target extension per `process()` call; each render is one target, and a
call with none renders the html target. Per-target escape hatches exist as node- and component-level overrides
(`extensions.react`, `extensions.vue`, `extensions.svelte`): attributes and
events a single target should see (`v-model` in Vue, `bind:` in Svelte), and a
per-target `tag`. Each is rendered verbatim by that target and ignored by every
other. A key an extension's override does not read, such as a misspelled one,
is a warning naming its path.

**Composing components.** A `tag` may name a component identifier
(`tag: 'UserAvatar'`) - the way to render one component inside another.
Supply the matching import through the per-extension `imports` overrides
when module paths differ per target:

<!-- example: getting-started-composition -->
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

The React, Vue and Svelte targets emit the tag verbatim as a component
reference; the html target writes `<!-- component: UserAvatar size="48" -->`, wrapping
any content projected into it between that comment and
`<!-- /component -->`. Those targets warn about a capitalized tag that
no import, `script` declaration, prop or binding of the component names, since
the generated file would not compile without it; a framework's own components,
such as Vue's `Transition` or `Teleport`, need no import. Vue also resolves a
component registered globally (`app.component`, Vue Router's `RouterLink`),
which the build can't see, so its warning says the name compiles only if it is
registered that way. To quiet it, import the component in
`extensions.vue.imports` (`import { RouterLink } from 'vue-router';`), which
Vue resolves the same way and types too.

**A different element per target.** The per-target `tag` override swaps the
rendered element for one target - the route for a node that portals differently
in each framework:

<!-- example: getting-started-tag-override -->
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

<!-- example: getting-started-slot-fills -->
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

## Compound components

A compound is a root component and the parts a consumer writes inside it,
such as a `Field` and its `FieldLabel`, sharing a value through a context.
Each is a template of its own. The root provides the context:

<!-- example: getting-started-compound-root -->
```ts
defineTemplate({
  type: 'component',
  name: 'Field',
  parts: ['FieldLabel'],
  rest: { tag: 'div' },
  ids: { id: 'field' },
  extensions: {
    react: {
      imports: [
        "import { createContext } from 'react';",
        "export const FieldContext = createContext('');",
      ],
    },
    vue: {
      imports: [
        "import { provide, type InjectionKey } from 'vue';",
        "export const fieldKey: InjectionKey<string> = Symbol('field');",
      ],
      script: 'provide(fieldKey, id);',
    },
    svelte: {
      imports: [
        "import { setContext } from 'svelte';",
        "export const fieldKey = Symbol('field');",
      ],
      script: 'setContext(fieldKey, id);',
    },
  },
  children: [
    {
      type: 'fragment',
      extensions: {
        react: { tag: 'FieldContext', attributes: { value: { $expression: 'id' } } },
      },
      children: [
        {
          type: 'element',
          tag: 'div',
          attributes: { $spread: { $expression: 'rest' }, 'data-part': 'field' },
          children: [{ type: 'slot' }],
        },
      ],
    },
  ],
});
```

- **`parts` names the compound's parts,** by component name. Rendering
  ignores it; the kit build records it in the kit manifest, so the kit's
  `add` command can place `FieldLabel` beside its `Field` and copy the
  compound whole. A part belongs to one compound.
- **The context lives on `imports` lines,** so it is created once per module
  and every instance shares it. The id it carries is declared in `ids`, so
  each instance generates its own (see Ids per instance).
- **React provides a context by rendering it,** so the outer node is a
  fragment whose `react` block names a wrapper: its `tag` turns the fragment
  into `<FieldContext value={id}>` there (React 19 renders a context as its
  own provider). Vue and Svelte provide it from the script and name no
  wrapper, so they render only the fragment's children, and so does the
  HTML rendering, which starts at the `div`.
- **`rest` carries the consumer's attributes to the real element.** The root
  node is the context, not the `div`, so `passthrough` can't reach the
  element. `rest: { tag: 'div' }` gathers every attribute a consumer passes
  that is not a declared prop into one value, typed as a `div`'s attributes,
  and `$spread` places it. Its `class` and `style` arrive unmerged: a node
  that spreads `rest` and has a class of its own replaces the consumer's in
  React and Svelte, and the build warns. Leave the class off, as here, or
  spread `rest` onto a passthrough component, which merges them.

Each part imports the context from the root's file and reads it in its
script:

<!-- example: getting-started-compound-part -->
```ts
defineTemplate({
  type: 'component',
  name: 'FieldLabel',
  extensions: {
    react: {
      imports: ["import { useContext } from 'react';", "import { FieldContext } from './Field';"],
      script: 'const id = useContext(FieldContext);',
    },
    vue: {
      imports: ["import { inject } from 'vue';", "import { fieldKey } from './Field.vue';"],
      script: "const id = inject(fieldKey, '');",
    },
    svelte: {
      imports: ["import { getContext } from 'svelte';", "import { fieldKey } from './Field.svelte';"],
      script: 'const id = getContext<string>(fieldKey);',
    },
  },
  children: [
    {
      type: 'element',
      tag: 'label',
      attributes: { for: { $expression: 'id' }, 'data-part': 'label' },
      children: [{ type: 'slot' }],
    },
  ],
});
```

A consumer writes `<Field><FieldLabel>Name</FieldLabel></Field>` in every
framework.

**A value that changes.** The field's id never changes once the field
exists, so Vue and Svelte can provide it as a plain value. A value that
changes, such as the selected tab, has to reach the parts as something they
can follow. React re-renders the parts that read a context whenever its
value changes. Vue provides a ref and each part reads it through `computed`.
Svelte provides a store, which each part reads as `$selected`; a part that
takes a plain value from the context keeps the value it saw when it was
created. Here the root's `value` is a two-way value (Component events and
state), so a consumer can control the selection or leave it to the tabs, and
the root hands the context the current value and the setter the engine
generates for it:

<!-- example: getting-started-compound-changing-root -->
```ts
defineTemplate({
  type: 'component',
  name: 'Tabs',
  props: {
    value: {
      type: 'string',
      bindable: { current: 'selected', setter: 'select', defaultProp: 'defaultValue', changeProp: 'onValueChange' },
    },
    defaultValue: { type: 'string', default: '' },
    onValueChange: { type: '(value: string) => void' },
  },
  rest: { tag: 'div' },
  extensions: {
    react: {
      imports: [
        "import { createContext } from 'react';",
        "export const TabsContext = createContext({ selected: '', select: (value: string) => {} });",
      ],
    },
    vue: {
      imports: [
        "import { provide, type InjectionKey, type Ref } from 'vue';",
        "export const tabsKey: InjectionKey<{ selected: Readonly<Ref<string>>; select: (value: string) => void }> = Symbol('tabs');",
      ],
      script: 'provide(tabsKey, { selected, select });',
    },
    svelte: {
      imports: [
        "import { setContext } from 'svelte';",
        "export const tabsKey = Symbol('tabs');",
      ],
      legacy: {
        imports: ["import { writable } from 'svelte/store';"],
        script: 'const selectedStore = writable(selected);\n$: selectedStore.set(selected);\nsetContext(tabsKey, { selected: selectedStore, select });',
      },
      runes: {
        imports: ["import { toStore } from 'svelte/store';"],
        script: 'setContext(tabsKey, { selected: toStore(() => selected), select });',
      },
    },
  },
  children: [
    {
      type: 'fragment',
      extensions: {
        react: { tag: 'TabsContext', attributes: { value: { $expression: '{ selected, select }' } } },
      },
      children: [
        {
          type: 'element',
          tag: 'div',
          attributes: { $spread: { $expression: 'rest' }, role: 'tablist' },
          children: [{ type: 'slot' }],
        },
      ],
    },
  ],
});
```

- **`selected` and `select` are generated in every target,** so the root
  writes no state of its own. React reads them while rendering and hands them
  to the provider. In Vue `selected` is a `computed`, which the root provides
  as it is, so each part follows it.
- **Svelte turns the value into a store per mode.** In runes mode `selected`
  is a `$derived`, and `toStore(() => selected)` reads it as a store. In
  legacy mode it is a `$:` value, so the root keeps a `writable` of its own
  and a `$:` line sets it from `selected` whenever it changes.

Each part compares the selection with its own `value` and selects itself
when clicked:

<!-- example: getting-started-compound-changing-part -->
```ts
defineTemplate({
  type: 'component',
  name: 'Tab',
  props: { value: { type: 'string', required: true } },
  extensions: {
    react: {
      imports: ["import { useContext } from 'react';", "import { TabsContext } from './Tabs';"],
      script: 'const tabs = useContext(TabsContext);\nconst isSelected = tabs.selected === value;\nconst choose = () => tabs.select(value);',
    },
    vue: {
      imports: ["import { computed, inject } from 'vue';", "import { tabsKey } from './Tabs.vue';"],
      script: 'const tabs = inject(tabsKey)!;\nconst isSelected = computed(() => tabs.selected.value === value);\nconst choose = () => tabs.select(value);',
    },
    svelte: {
      imports: [
        "import { getContext } from 'svelte';",
        "import type { Readable } from 'svelte/store';",
        "import { tabsKey } from './Tabs.svelte';",
      ],
      script: 'const tabs = getContext<{ selected: Readable<string>; select: (value: string) => void }>(tabsKey);\nconst selected = tabs.selected;\nconst choose = () => tabs.select(value);',
      legacy: { script: '$: isSelected = $selected === value;' },
      runes: { script: 'const isSelected = $derived($selected === value);' },
    },
  },
  children: [
    {
      type: 'element',
      tag: 'button',
      attributes: { type: 'button', role: 'tab', 'aria-selected': { $expression: 'isSelected' } },
      events: [{ name: 'click', handler: 'choose' }],
      children: [{ type: 'slot' }],
    },
  ],
});
```

The part's derived line differs per Svelte mode, so it sits in the `legacy`
and `runes` blocks of the Svelte override, as in the state recipe. A part
reads the context the same way whether the consumer controls the tabs or
leaves them to themselves:

| Target | The consumer writes |
|---|---|
| React | `<Tabs value={tab} onValueChange={setTab}>`, or `<Tabs defaultValue="one">` |
| Vue | `<Tabs v-model:value="tab">`, on a plain `ref('one')` |
| Svelte | `<Tabs bind:value={tab}>`, in both modes |

with the parts inside, such as
`<Tab value="one">One</Tab><Tab value="two">Two</Tab>`.

The html target renders each part on its own, so what a part reads from its
root's context, such as `isSelected` here, can't be evaluated there: a
preview story's html leaves those attributes out and lists each one it
left out as a warning. A helper the parts share, such as one building
matching trigger and panel ids, stays evaluable when it lives in a shared
module rather than on the root's `imports` lines.

## Styling extensions: BEM and Tailwind

Styling extensions contribute classes to element nodes; they compose with
any target, and with each other.

**BEM.** Declare a block on a container and elements/modifiers on
descendants - the block is inherited from the nearest ancestor that
declares one:

<!-- example: getting-started-bem -->
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

<!-- example: getting-started-tailwind -->
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
in the order passed, then conditional classes, then expression classes.
Static and extension classes are deduplicated, the first occurrence
winning; a conditional class is dropped when a static or extension class
already carries it, and a class repeated across conditional entries applies
whenever any of its conditions holds. A template can carry both `bem` and `tailwind` blocks;
each is inert unless its extension is active, so the same source renders
correctly for every configuration. A kit styled only with Tailwind writes its
static utilities here, its variant ones in `conditionalAttributes` as below,
and keeps `attributes.class` for a class that isn't Tailwind's.

**Variant classes.** A component whose utilities depend on a prop, such as a
button's `variant`, takes one of two routes. One `conditionalAttributes` entry
per variant keeps every class literal, where Tailwind's scanner finds it and
the HTML rendering shows it, and a class two variants share applies under
either:

<!-- example: getting-started-variant-conditional -->
```ts
conditionalAttributes: [
  { condition: "variant === 'solid'", attributes: { class: ['bg-primary', 'text-white'] } },
  { condition: "variant === 'outline'", attributes: { class: ['border', 'text-primary'] } },
],
```

Or a variant map in a module of the kit's own, read through a class
expression:

<!-- example: getting-started-variant-map -->
```ts
imports: ["import { buttonVariants } from 'my-ui-kit/scripts';"],
// on the element:
attributes: { class: ['button', { $expression: 'buttonVariants[variant]' }] },
```

The map has to live in a module or on an `imports` line, not in the
component `script`, for a kit's preview to print its classes in the story's
html: the preview evaluates the exports of the kit's shared modules (the
`add.shared` code modules its `package.json` exports) and the declarations
on the template's own `imports` lines, and never runs a component's script.
Tailwind's build has to scan a shared module too.

**Tailwind without a Tailwind build.** The same utilities can instead be
converted into ordinary CSS: `tailwind({ output: 'styles' })` resolves
them against the bundled Tailwind v4 default theme into each node's style
object - variants become pseudo-selector and media-query blocks - and the
result flows through the normal styling pipeline, so the generated
components are self-contained. How you author and what you ship become
independent choices:

<!-- example: getting-started-tailwind-styles -->
```ts
process(template, { extensions: [react(), tailwind({ output: 'styles' })] });
// → <div className="...">  with generated CSS:
// .panel { display: flex; align-items: center; }
// @media (min-width: 48rem) { .panel { padding-inline: 1.5rem; } }
```

The conversion covers a subset: the utilities that resolve to plain
declarations on their own node (see the extension README for the exact
table). An unknown utility, or one outside the subset, is a processing error,
never a silent drop, and one run lists every such utility in the template.
The converted CSS assumes three things:

- **Tailwind's preflight, or a comparable reset, is loaded.** Utilities
  convert to what Tailwind emits for them and nothing more: `border` becomes
  `border-width: 1px`, relying on the reset's solid border style. Tailwind's
  own `preflight.css` needs a Tailwind build; the Tailwind extension's README
  gives a reset that doesn't.
- **Conditional classes stay class names.** Only a node's
  `extensions.tailwind.classes` convert; a class in `class` or in
  `conditionalAttributes` is passed through as written, with no CSS behind it.
  A utility-looking class in `conditionalAttributes` or a class expression
  gets a warning. Give a variant its styles another way, such as a BEM
  modifier or a `conditionalAttributes` style.
- **Variants stay on their own node.** `group-hover:`, `peer-*` and other
  variants that react to a different element are a processing error. Write
  the rule as a nested style key on the node instead, which converts
  alongside the utilities: `style: { '.card:hover &': { color: 'red' } }`.

`dark:` converts to `@media (prefers-color-scheme: dark)` unless you name
the selector that turns dark mode on:
`tailwind({ output: 'styles', darkSelector: '[data-mode="dark"]' })`
writes each `dark:` utility under `:where(:root:is([data-mode="dark"]))`,
adding no specificity, so it
follows an attribute or class on `<html>`, such as the one a kit preview's
color-mode option sets; a kit sets it as `tailwind.darkSelector`. A selector
holding `&` is used as written, as in Tailwind's `@custom-variant dark
(...)`.

An arbitrary value's type picks the property where a utility has several,
as in Tailwind: `text-[length:var(--size)]` is a font size and
`text-[clamp(1rem,2vw,2rem)]` is inferred as one, while a bare
`text-[var(--ink)]` takes Tailwind's fallback, a color. Math functions are
spaced as Tailwind spaces them: `w-[calc(100%-2rem)]` emits
`calc(100% - 2rem)`.

The reverse also works: `tailwind({ convertStyles: true })` turns each
element's authored `style` into utility classes against the same theme -
on-scale values become named utilities, everything else an arbitrary value
or property. A nested block with no Tailwind variant, such as a
parent-modifier selector (`'&.badge--small'`, `'.card:hover &'`), is a
processing error, so a component styled through BEM modifiers or parent
selectors keeps its CSS. Authoring in plain CSS and shipping utility-class
components becomes just another independent choice:

<!-- example: getting-started-convert-styles -->
```ts
process(template, { extensions: [react(), tailwind({ convertStyles: true })] });
// style: { paddingInline: '1rem', display: 'flex' }
// → <div className="px-4 flex">  with no stylesheet
```

From the CLI: `--styling bem`, `--styling tailwind`, or both
(`--styling bem,tailwind`, applied in order); `--tailwind-output styles`
converts utilities to CSS, `--tailwind-dark-selector` names its dark-mode
selector, and `--tailwind-convert-styles` converts CSS to utilities.

## JSON templates and validation

Templates are serializable by construction, so everything above also works
as plain JSON - the transport form for generators and tooling. The types
package ships a generated JSON Schema for validating it, and the CLI
validates either form directly:

```bash
npx js-template-engine validate src/components
```

`validate` reports every violation in each invalid template, one line each
with the path of the offending node; programmatically, `process()` throws one
`TemplateError` listing them, each message and path also on its `errors`.
A node missing a field it needs, such as a conditional without its
`conditions`, is one of them, and so is a key a node does not take, such as
`style` beside `tag` instead of inside `attributes`, which the error says
where to put. In a TypeScript module, `defineTemplate` flags such a key as
you write it, in the objects written in place; a node held in a value typed
as the whole `TemplateNode` union is left to validation.

## Building a UI kit

To turn templates into a publishable, multi-framework component library -
single source of truth in `src/components/`, built output per target, and
a consumer CLI that copies components into consuming projects with zero
engine dependencies - use [scaffold-ui-kit](https://github.com/djurnamn/scaffold-ui-kit),
a separate project built on this engine:

```bash
npx scaffold-ui-kit my-ui-kit
```

The kit's tests come from `@scaffold-ui-kit/testing`, which renders each
component in every target and compares the markup, type-checks what the build
wrote and sweeps the preview with axe and the keyboard. Templates that use Sass
modifier helpers and hand-written drivers built on Zag take
`@scaffold-ui-kit/helpers`.

## Coming from React

Where each habit goes in a template:

| In React | In a template |
|---|---|
| `children` | a `slot` node; a named slot is a prop in React |
| A render prop | `exposes` on the slot, `slotScope` on what fills it |
| `{...rest}` on the root, `forwardRef` | `passthrough: true` on the root element, the "root surface" a consumer's attributes and ref land on |
| `{...rest}` somewhere else | `rest: { tag }` on the component, `$spread` where it lands |
| `value`, `onChange`, `defaultValue` | a prop with `bindable`: one state, every target's idiom |
| `useState` for a value that isn't a prop | a per-target `script` override |
| `useMemo`, a computed value | `derived` |
| `useId` | `ids` |
| Compound components over a context | `parts`, and the context on the `imports` lines of the root |
| `className` | `class`, an array of literals and `{ $expression }` entries |
| `&&`, ternaries, `.map()` | `conditional` and `iteration` nodes, `conditionalAttributes` for classes |
| A custom hook or a headless library | a hand-written driver per target, composing a generated component |

## Coming from Svelte

The same table, from Svelte's words:

| In Svelte | In a template |
|---|---|
| `export let`, `$props()` | `props` |
| `$bindable()`, `bind:value` on a component | a prop with `bindable`: one state, every target's idiom |
| `bind:value` on an element | `value` and a `change` event, or a prop with `bindable` |
| `$state` for a value that isn't a prop | a per-target `script` override, with `$state` in its `runes` block |
| `$derived` | `derived` |
| `$effect`, lifecycle functions | a per-target `script` override |
| `$props.id()` | `ids` |
| `<slot>`, `{@render children()}` | a `slot` node; a named slot is a named `slot` node |
| A snippet with parameters, `let:` on a slot | `exposes` on the slot, `slotScope` on what fills it |
| `{...rest}` on the root | `passthrough: true` on the root element |
| `{#if}`, `{#each}` | `conditional` and `iteration` nodes |
| `class:active={on}` | `conditionalAttributes`, one entry for each class |
| `use:action` | a Svelte-only `use:` key in the element's `attributes` override, its value an `$expression`, with the action on an `imports` line |
| `setContext`, `getContext` | `parts`, and the context on the `imports` lines of the root |
| A behavior that differs per framework | a hand-written driver per target, composing a generated component |

## Reference

- [`@js-template-engine/types`](../packages/types) - the template format
- [`@js-template-engine/core`](../packages/core) - the engine and extension contract
- [`js-template-engine`](../packages/cli) - the CLI
- [`scaffold-ui-kit`](https://github.com/djurnamn/scaffold-ui-kit) - the kit scaffolder (a separate project)
- [`@scaffold-ui-kit/testing`](https://www.npmjs.com/package/@scaffold-ui-kit/testing) - testing a kit
- [`@scaffold-ui-kit/helpers`](https://www.npmjs.com/package/@scaffold-ui-kit/helpers) - style helpers and a driver's runtime
- Extensions: [react](../packages/extension-react), [vue](../packages/extension-vue),
  [svelte](../packages/extension-svelte), [bem](../packages/extension-bem),
  [tailwind](../packages/extension-tailwind)
