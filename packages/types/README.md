# @js-template-engine/types

Type definitions for the js-template-engine template format: UI components
defined as plain, JSON-compatible data and rendered to framework components or
to annotated HTML and CSS.

## Installation

```bash
pnpm add @js-template-engine/types
```

## Usage

<!-- example: types-button -->
```typescript
import { defineTemplate } from '@js-template-engine/types';

export default defineTemplate({
  type: 'component',
  name: 'Button',
  props: {
    label: { type: 'string', required: true },
    variant: { type: "'primary' | 'secondary'", default: 'primary' },
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
```

`defineTemplate` is an identity helper: it gives template authors compile-time
checking and autocompletion, and returns the template unchanged. A key a node
does not take, such as `style` written beside `tag` instead of inside
`attributes`, is a type error at that key in the objects written in place, as
it is a validation error when the template is processed. A node held in a
value typed as the whole `TemplateNode` union, and an array that mixes one
in, are checked by validation only.

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
engine emits them verbatim into the target syntax. The html rendering
evaluates only an expression that reads declared `ids` alone, and
`renderInstance` evaluates them all.
An expression reads a prop by its bare name in every target, as the
component's own code does. A prop whose name can't be a variable
(`aria-pressed`, `for`, `class`) is read by its camel-cased alias,
`ariaPressed`, `forProp`, `classProp`, again in every target; legacy Svelte
can't declare a hyphenated prop at all and rejects it, so build it in runes
mode. Dynamic attributes are tagged by shape:
`src: { $expression: 'url' }`.
The same wrapper works on `class` (as array entries or the sole value) and
on `style` (as top-level property values, or as a top-level `$expression`
key holding the whole-object expression - which may coexist with static
properties, nested selectors, and per-property expressions on one node). A
`style` object may also carry Sass `@include`s, written as at-rule keys
(`'@include name': true` for a no-content include, an object for one that
takes a body) - emitted verbatim under SCSS output and resolved to plain CSS
otherwise.

## Documenting and typing a component

A few optional fields describe a component to its consumers and type it
precisely. None of them changes what the component renders.

<!-- example: types-data-list -->
```ts
defineTemplate({
  type: 'component',
  name: 'DataList',
  description: 'A list of rows, each rendered by the `row` slot.',
  typeParameters: [{ name: 'Row', constraint: '{ id: string }' }],
  props: {
    rows: { type: 'Row[]', required: true, description: 'The rows to list.' },
    align: { type: "'start' | 'end'", documentedDefault: "'start'" },
    open: { type: 'boolean', bindable: true, default: false },
  },
  children: [
    {
      type: 'iteration',
      items: 'rows',
      item: 'row',
      key: 'row.id',
      children: [
        { type: 'slot', name: 'row', exposes: { row: { value: 'row', type: 'Row' } } },
      ],
    },
  ],
});
```

| Field | On | Effect |
|---|---|---|
| `description` | component, prop | A doc comment on the generated component or prop in every scripted target, so a consumer's editor shows it on hover. Markdown is allowed. |
| `typeParameters` | component | Type parameters, each a name or `{ name, constraint, default }`, that prop types, `exposes` types and `imports` may use. React emits `function DataList<Row extends { id: string }>`, Vue `<script setup generic="...">`, Svelte `<script generics="...">`. |
| `default` | prop | The prop's fallback, a JSON literal the targets write as written. An expression binding (`{ $expression }`) is a validation error, and so is a default that is not a value of a type built from `string`, `number`, `boolean`, `null` and literals (`'lg'` for `'sm' \| 'md'`). Compute a fallback from other props where the value is read (`label ?? ...`) or as a `derived` value. |
| `documentedDefault` | prop | A default the component applies itself, such as an absent value its conditionals treat as `'start'`, written as the prop's `@defaultValue` without changing the code. A prop sets this or `default`, not both. |
| `bindable` | prop | The prop is two-way. `true` declares the binding alone: Svelte runes declares it with `$bindable()`, so a consumer can write `bind:open`; legacy Svelte binds every prop already, and React and Vue ignore it. An object has every target generate the value, in one of two forms. The copy form, `{ current, setter, defaultProp?, changeProp? }`: the template reads the value as `current`, the given prop or else the component's own copy started from `defaultProp`, and changes it through `setter`, which calls `changeProp`; React keeps the copy in `useState`, Vue emits `update:<prop>` for `v-model:<prop>`, and Svelte binds it with `bind:`. The relayed form, `{ given, report, changeProp? }`, for a value its owner holds (a state-machine driver, a native input): the component keeps no copy, forwards the given prop as `given` and hands the owner `report`, which calls `changeProp` with each new value; Svelte guards `given` so the component's own reports do not control the owner. |
| `derived` | component | Values computed from props and two-way values, written once: `{ sortedRows: 'sortRows(rows, sortKey)' }`, in the order they read each other. The template and the script read each by name; React declares a `const`, Vue a `computed`, Svelte runes a `$derived` and legacy Svelte a `$:` declaration. An expression reads props, two-way values, declared `ids`, derived values above it and what the `imports` lines declare, never a function only the component `script` declares, and no script, handler or other expression assigns a derived value. `renderInstance` runs the `imports` declarations, so a helper declared there computes the value at rest. |
| `ids` | component | Ids generated once per instance, for `aria-controls`, `aria-labelledby`, a label's `for` or a radio group's `name`: `{ listId: 'command' }`, or `{ inputId: { prefix: 'field', prop: 'id' } }` to let a string prop the consumer gives replace it. The template, the script and derived values read each by name, like a prop. React builds it from `useId()`, Vue from `useId()`, Svelte runes from `$props.id()` (Svelte 5.20 or later) and legacy Svelte from a counter every component on the page shares, each after the prefix; the html target and `renderInstance` write `command-1`, `command-2` and so on, counted through the page. A prefix is a literal of letters, digits, `-` and `_`, no two ids share one, and the prop is a declared `string` prop that is not two-way. |
| `exposes` (object form) | slot | `{ value, type }` types a scoped slot's value: React's render prop takes `(scope: { row: Row }) => ReactNode` and Svelte runes' snippet `Snippet<[{ row: Row }]>`. The string form, `exposes: { row: 'row' }`, types it `any` there. |
| `scopeRequired` | slot | The slot's content must take its scope, as a trigger that has to spread the props it is given. React types the prop as the render function alone, so plain content is a type error, and renders the fallback when no function is given. Svelte runes types the snippet as a function already; Vue and legacy Svelte cannot refuse content that ignores the scope, and the html target is unaffected. Valid only beside `exposes`. |

## Composing a component

These fields shape how a component fits together with others, such as the
root and parts of a compound sharing a context.

| Field | On | Effect |
|---|---|---|
| `imports` | component, or its `extensions.react`, `.vue` or `.svelte` block | Lines emitted verbatim at module scope: import statements, and declarations every instance shares, such as a context, a counter or an exported type. On an element the key is a validation error. |
| `rest` | component | `{ tag }` gathers the attributes a consumer passes that are not declared props into one value named `rest`, typed as `tag`'s attributes, for `$spread: { $expression: 'rest' }` to place on any node. For a component whose real element is not its root node, where `passthrough` can't reach. `class` and `style` arrive unmerged, so a node spreading `rest` with a class or inline style of its own replaces the consumer's in React and Svelte, and the build warns, about the class and the style together, unless the node's override for that target reads the consumer's (`rest.className` in React, `rest.class` in Svelte, `rest.style`; in React a spread such as `{ gap, ...rest.style }` reads it too). A static style the stylesheet carries replaces nothing, and in Svelte neither does an expression-valued property, a `style:` directive that keeps the spread's style attribute. Where the consumer's style is kept, it wins over the node's expression-valued properties: React writes it after them, and a Svelte directive takes the consumer's value for its property. In Svelte `rest.style` is the consumer's style string, so a spread or passing it to `Object.assign` breaks it into characters, and the build warns about one: a style override's `$expression` takes it alone or last in an array, `[{ gap }, rest.style]`, the node's own declarations first and the consumer's winning. Vue merges them, the node's own class first and the consumer's style winning. An event the node handles runs its own handler and then the consumer's. Not combined with `passthrough`. |
| `tag` | an element's `extensions.react`, `.vue` or `.svelte` block | Renders a different element or component in that target only. A capitalized name is a component reference. |
| `tag` | a fragment's `extensions.react`, `.vue` or `.svelte` block | Renders that element or component around the fragment's children in that target only, with the block's `attributes` and `events`, for a wrapper only some targets need, such as React's context provider or Vue's `Teleport`. Every other target, the HTML output included, renders the children alone. The block takes only `tag`, `attributes` and `events`, and needs the `tag`; styling extensions give the wrapper no class, so a class goes in its `attributes`, and it takes no `style`. |
| `attributes` | an element's `extensions.react`, `.vue` or `.svelte` block | Merges into the node's attributes per key in that target, the override winning. A key set to `null` removes the node's attribute of that name there alone. |

## Root surface forms

A component's single root `element` can opt into a **surface contract** with
`passthrough: true`. The element then forwards consumer-supplied props, merges
an incoming `className`/`class` and `style` with the authored ones, and exposes
a handle to its DOM node - React forwards `{...rest}` and a ref, Vue falls
through `$attrs` and exposes `$el`, Svelte spreads its rest and binds
the element. The passthrough element is the component's one rendered root:
an element meant to sit beside it, such as a hidden input that posts a
value, goes inside it, or the component spreads `rest` instead. The
component's own scripts can hold the handle too: a React `ref` the template
sets on the root is combined with the consumer's, and a Vue `ref` attribute
reads through `useTemplateRef`, so a template can measure or focus its root
without reaching for an id. The root
tag itself can be chosen at runtime by a dynamic tag,
typed against its `default` tag. The expression reads a declared prop, and
writes any fallback itself: `default` names the tag the types and the HTML
rendering use, and is never applied at runtime.

<!-- example: types-polymorphic -->
```ts
props: { as: { type: "'button' | 'a'" } },
children: [
  {
    type: 'element',
    tag: { $expression: "as ?? 'button'", default: 'button' },
    passthrough: true,
    attributes: { class: ['button'] },
    children: [{ type: 'slot' }],
  },
],
```

When that expression may resolve to a component rather than only a tag name
(the polymorphic `as={Link}` pattern), add `componentValued: true` to the
`tag` object, not to the element, and type the prop to take a component:

<!-- example: types-component-valued -->
```ts
tag: { $expression: "as ?? 'button'", default: 'button', componentValued: true },
```

React and Vue accept both values as they are, and Svelte, whose
`<svelte:element>` renders tag names only, emits a `typeof` branch with a
string arm and a component arm. The flag is allowed only on the component's
root element. Placed on the element itself, the flag passes validation and
type-checking but does nothing, and Svelte's `<svelte:element>` then
receives the component. In the HTML rendering the contract is inert preview markup.

In React the root is then **typed by what it renders as**, when the
expression is the prop's bare name, alone or with a fallback tag (`as`,
`as ?? 'button'`). The component is generic over the tag:
`<Button as="a" href="/docs">` takes an anchor's props and its `ref` an
`HTMLAnchorElement`, `<Button href="/docs">` is a type error because a
button has no `href`, and leaving `as` out types the props by the `default`
tag. With `componentValued`, `as={Link}` takes `Link`'s props. Without it,
`as` accepts tag names only. The prop's own type still limits the choice,
so `"'button' | 'a'"` rejects `as="div"`. Type it `any` to accept any tag
or, with `componentValued`, any component. Any other expression, such as
`visual ? 'div' : 'button'`, types the props by the `default` tag. The
typing adds no runtime code. To reuse the props in your own code, take them
from `ButtonProps`, or `ButtonProps<'a'>` for one tag, not from
`ComponentProps<typeof Button>`, which resolves the tag to every tag
allowed: it keeps only the props those tags share, or nearly any props
with `componentValued`. The root's own attributes in the template are not
checked against any one tag.

What a consumer can and cannot change on a passthrough root:

- **Authored attributes win.** An attribute the template sets on the root,
  such as `type="button"` or an ARIA attribute, overrides the consumer's of
  the same name in every target. An attribute bound to an expression that
  yields `undefined` or `null` leaves the consumer's in place. To let a
  consumer change a value, declare it as a prop with a default.
- **Events add up.** A declared event on the root runs together with a
  consumer's handler for the same event. The consumer's runs first, and the
  component's runs only if the consumer did not call `event.preventDefault()`,
  so a consumer can stop a switch from toggling or a tab from activating.
  This holds in React, Vue and Svelte runes mode. In legacy Svelte the
  component's `on:` directives run beside the spread, so a consumer's handler
  is not ordered first and cannot cancel them.
- **Legacy Svelte forwards attributes, not `on:` directives.** A consumer's
  `on:click` on the component does not reach the root. Declare the event as
  an `on*` function prop, or build runes components, whose rest props carry
  `onclick` handlers.
- **Per-target overrides.** A Svelte directive given through
  `extensions.svelte.attributes` (`bind:value`, `on:input`) renders as
  written on the root. A `fragment` has no element of its own, so it is
  never the passthrough root; a `tag` in its block renders a wrapper in that
  target alone (see Composing a component).

### Routing attributes to an inner element

A passthrough root around a native control, such as a `<label>` wrapping an
`<input type="checkbox">`, can send some of the consumer's attributes to the
control. One element below the root sets `passthrough` to an object naming
them:

<!-- example: types-routed-attributes -->
```ts
children: [
  {
    type: 'element',
    tag: 'label',
    passthrough: true,
    children: [
      {
        type: 'element',
        tag: 'input',
        passthrough: { attributes: ['aria-*', 'on*', 'required', 'form'] },
        attributes: { type: 'checkbox' },
      },
      { type: 'slot' },
    ],
  },
],
```

An entry is `'*'` (every attribute but `class`, `style` and `data-*`),
`'aria-*'` (every ARIA attribute), `'on*'` (every event handler, which
legacy Svelte does not route) or an HTML attribute name in its HTML
spelling, such as `tabindex` or `autocomplete`, which each target matches
in its own spelling. The listed attributes land on the input, and
everything else, `class`, `style` and `data-*` included, lands on the
label, which also keeps the DOM handle. The input's own attributes win over
the consumer's, and an event the input handles runs the consumer's routed
handler first, then its own. React, Vue and Svelte runes type the routed
names after the input and the rest after the label.

An ID list the input sets itself (`aria-describedby`, `aria-labelledby`,
`aria-controls`, `aria-owns` or `aria-details`) doesn't replace the
consumer's: the two join, the input's IDs first, each once. A field's own
description and a hint elsewhere on the page both describe the input.

`handle: 'routed'` moves the DOM handle to the input as well, for an input
whose ref a form library registers or `focus()` moves to:

<!-- example: types-routed-handle -->
```ts
passthrough: { attributes: ['*'], handle: 'routed' },
```

React's `ref`, typed after the input and composed with a `ref` the template
sets there, Vue's `$el` and Svelte's `bind:element` then reach the input.
Vue also exposes the input as `element`, typed
`HTMLInputElement | null` where Vue types `$el` as `any`, so
`field.value?.element?.focus()` type-checks.
The default, `handle: 'root'`, keeps the handle on the label. A routed handle
may not sit inside an iteration.

One element per component may route, with an intrinsic static tag, below a
single passthrough root with a static tag. A list naming `class`, `style` or
`ref` is a validation error. A declared name in the list is skipped, as under
the wildcards; bind it on the element.

### Discriminated surface root

A root that varies between **element shapes with different prop surfaces and
content roles** - a look-alike `<div>` versus an interactive `<input>` - is a
discriminated surface root: a single root `conditional` whose every branch
renders one `passthrough` element, each typically a different intrinsic tag. The
branch condition is the discriminant.

A conditional branch may carry its own **`props`**, scoped to that branch. They
assemble with the component's shared props into a discriminated union: each
branch contributes its element's typed surface plus its branch props. A name
that is content in one branch and a native attribute in another (a textbox's
`value`) stays a shared prop, bound explicitly where it is native.

The discriminant is declared in branch props, never in the shared props, and
comes in two kinds:

- **A literal discriminant** is a bare prop name declared in every branch,
  typed as truthy literals in the branch it picks and falsy ones in the
  branches after it: `visual: true` in one, `visual?: false` in the other, as
  below. A literal prop picks one branch; for more than two branches, give
  each its own boolean discriminant.
- **A presence discriminant** picks its branch when the prop is given. Write
  `href !== undefined`. The branch it picks requires the prop, with a type
  that has no `undefined`, `null` or boolean member; the others leave it out
  or type it `undefined`. Every target tests `href !== undefined`, so an
  empty string picks the branch too. React types `href?: undefined` on the
  other branches, so a string `href` on a `<button>` branch is a type error
  while `href={undefined}` still passes.

Any other condition is a validation error: a bare name typed anything else
(`href: string`, `flag: boolean`), which would test truthiness and which
React can't narrow its props union on; a loose `href != null`; a comparison
such as `visual === true`; a presence test on a boolean prop; or a literal
that a later branch could also match. For the first two, the error suggests
what fits the type: literal `true`/`false` types for a prop with a boolean
member, dropping the falsy member of a literal union such as `'a' | ''`, and
`href !== undefined` or literal `true`/`false` types for anything else.

<!-- example: types-discriminated -->
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

A presence discriminant renders a link or a button by whether `href` is given:

<!-- example: types-discriminated-presence -->
```ts
{
  type: 'component',
  name: 'Button',
  props: { text: { type: 'string', required: true } },
  children: [
    {
      type: 'conditional',
      conditions: [
        {
          statement: 'if',
          condition: 'href !== undefined',
          props: { href: { type: 'string', required: true } },
          children: [
            {
              type: 'element',
              tag: 'a',
              passthrough: true,
              attributes: { href: { $expression: 'href' }, role: 'button' },
              children: [{ type: 'text', expression: 'text' }],
            },
          ],
        },
        {
          statement: 'else',
          props: {
            type: { type: "'submit' | 'button' | 'reset'", default: 'submit' },
          },
          children: [
            {
              type: 'element',
              tag: 'button',
              passthrough: true,
              attributes: { type: { $expression: 'type' } },
              children: [{ type: 'text', expression: 'text' }],
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
binding `$attrs`; Svelte emits `{#if}` branches each spreading its rest;
the HTML rendering previews every branch.

### Conditional passthrough root

A root that renders **one element or nothing**, such as a menu panel shown only
while its menu is open, wraps its passthrough element in an `if` with no
`else`. While the condition is false the component renders nothing, so the
closed panel's items are not in the DOM:

<!-- example: types-conditional-passthrough -->
```ts
{
  type: 'component',
  name: 'DropdownMenuContent',
  props: { open: { type: 'boolean', default: false } },
  children: [
    {
      type: 'conditional',
      conditions: [
        {
          statement: 'if',
          condition: 'open',
          children: [
            {
              type: 'element',
              tag: 'div',
              passthrough: true,
              attributes: { role: 'menu' },
              children: [{ type: 'slot' }],
            },
          ],
        },
      ],
    },
  ],
}
```

While it renders, the element is the component's passthrough root, with the
same props, forwarding and handle as a root that always renders. React returns
`null` while the condition is false, and the forwarded `ref` is `null` then.
Vue puts `v-if` on the element, and a template ref's `$el` is not the element
while nothing renders (a comment or empty text node). Svelte wraps the element in `{#if}`, and `element` becomes
`null` when the element unmounts, so it is typed `HTMLDivElement | null |
undefined`. The HTML rendering shows the element inside its `if` comment.

The condition can be any expression, since it doesn't pick between surfaces,
and the branch declares no `props`. The `if` branch renders the passthrough
element alone. An `else` that renders nothing is allowed; an `else` that
renders another element is a discriminated surface root, so its element sets
`passthrough` too. Attributes can't be routed to an element inside a
conditional root.

## JSON Schema

Templates are JSON-serializable by construction. The package ships a JSON
Schema generated from these types for validating the JSON transport form:

<!-- example: types-schema -->
```typescript
import templateSchema from '@js-template-engine/types/schema/template.schema.json';
```

## License

MIT
