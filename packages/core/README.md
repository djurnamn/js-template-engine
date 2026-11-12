# @js-template-engine/core

The template engine core. Processes components defined as plain, typed data
into annotated HTML and CSS - no extensions required - and delegates to
target extensions for the other targets.

<!-- example: core-process -->
```ts
import { process } from '@js-template-engine/core';
import { defineTemplate } from '@js-template-engine/types';

const template = defineTemplate({
  type: 'component',
  name: 'Button',
  script: "function handleClick() {\n  console.log('clicked');\n}",
  children: [
    {
      type: 'element',
      tag: 'button',
      attributes: { class: ['button'], type: 'button' },
      events: [{ name: 'click', handler: 'handleClick' }],
      children: [{ type: 'text', content: 'Save' }],
    },
  ],
});

const result = process(template);
// result.files → [{ path: 'Button.html', content: '...' }]
```

## HTML output

HTML output is a reference template: zero-dependency markup to copy into any
framework, server template or static page and adapt from there. It contains
no script. Expressions become `{{ expression }}` placeholders, and everything
plain HTML cannot express is written as a comment where it sits:
conditionals render every branch between `<!-- if -->` comments, iterations
render their children once between `<!-- for -->` comments, slots render
their fallback between `<!-- slot -->` comments, and component references,
events, conditional attributes, spreads and dynamic tags each get a comment
naming them. A boolean attribute bound to an expression, such as `checked`,
is written as a condition, `<!-- if isChecked: checked -->`, since a browser
reads the attribute as on whatever its value, and a DOM property with no
attribute, such as an input's `indeterminate`, as
`<!-- property indeterminate: isMixed -->`:

```html
<!-- on click: handleClick -->
<button class="button" type="button">Save</button>
```

One kind of expression is evaluated here rather than written as a
placeholder: one that reads the component's declared `ids` and nothing
else, such as `` `${listId}-label` ``, whose value the markup knows at
rest (`list-label`). It runs as JavaScript, as every expression does in
`renderInstance`, so a template is code the build runs, not data it only
reads - in every target, a JSON template included. Process templates you
trust, as you would run their script.

## Rendering one instance

`renderInstance` renders the markup one set of props produces, at build time:
for a documentation page that shows a component's HTML beside its framework
source. Expressions are evaluated, only the branch a conditional takes
renders, loops expand, and the components a template references render
inline.

<!-- example: core-render-instance -->
```ts
import { renderInstance } from '@js-template-engine/core';
import { tailwind } from '@js-template-engine/extension-tailwind';

const { markup, warnings, unresolved } = renderInstance(card, {
  props: { title: 'Hello', tone: 'loud' },
  children: '<p>Body</p>',
  slots: { footer: '<a href="/more">More</a>' },
  resolveComponent: (tag) => (tag === 'Badge' ? badge : undefined),
  extensions: [tailwind()],
});
// markup → <article class="card rounded-lg p-4 card--loud"><h2>Hello</h2>...
```

Options, all optional:

| Option | Effect |
|---|---|
| `props` | The instance's prop values; a declared prop left out takes its default. A value that is not a declared prop is an attribute the consumer passes, landing on a passthrough root or in `rest`. |
| `children`, `slots` | Content for the default slot and for named slots: an HTML string, inserted as given, or template nodes. Nodes given as `{ content, slotScope }` read the values a scoped slot exposes. |
| `resolveComponent` | `(tag) => template`, so a component reference renders inline. For a component written by hand per target, return `{ rendersAs: 'content' }` (it renders only the content passed into it) or `{ rendersAs: template, props?, slots? }` (it renders that template); either sits inside one comment saying its behavior is not included. |
| `extensions` | The styling extensions the kit builds with, such as `bem()` or `tailwind()`. Leave them out and the classes they contribute are missing from the markup. |
| `scope` | Values every expression can read by name, such as the helpers a template imports from the kit's own modules. |
| `placement` | The stylesheet placement the kit's stylesheets were built with, which decides where a `data-jte-node` marker is written. Defaults to `'in-file'`. |
| `componentName` | The name used when the template has no `component` node. |

The result is `{ markup, warnings, unresolved }`. `markup` has no script and
assumes the kit's stylesheet: static styles stay there, and only styles
computed from expressions are written inline. An expression that can't be
evaluated without running the component, such as one naming a value its
script defines, is left out with a warning whose `kind` is `'unevaluated'`.
The declarations on the template's own `imports` lines run once before its
expressions, so a derived value or an attribute can call a helper or read a
constant declared there. Their TypeScript types are erased with the
`typescript` package where it is installed; without it, only a declaration
written as plain JavaScript runs. A declaration that can't run at build
time, such as a context made with an imported `createContext`, binds
nothing, and an expression reading it is left out with a warning naming the
reason. A composed component whose prop was given by an expression that
can't be evaluated reads that prop as unset too, so an attribute built from
it, such as `` `${inputId}-description` ``, is left out with a warning
rather than written as `undefined-description`.
A value a scoped slot exposes is evaluated only when the content reads it,
so one the content ignores never warns. A component reference that
`resolveComponent` doesn't resolve is left out and listed in `unresolved`,
with a warning whose `kind` is `'unresolved'`; while that list is not empty,
the markup is not the whole instance. A styling extension's warnings carry
no `kind`.

## Stylesheet placement

`options.styling.placement` decides where styles go:

| Placement | Styles |
|---|---|
| `inline` | `style="..."` attributes |
| `in-file` (default) | a `<style>` block |
| `separate-file` | `Button.css` + link |

`styling.outputStrategy` is a deprecated alias of `styling.placement`: it
takes the same values, adds a warning, and is removed in 3.0.0. Passing both
with different values is an error.

The `scripting` option is deprecated and has no effect: no output contains a
script for it to place. Passing it adds a warning, and it is removed in 3.0.0.

Under `separate-file`, `styling.stylesheetLink: 'none'` emits the stylesheet
and links it from nowhere - no import, no `<style src>` block, no `<link>` -
leaving how the styles are loaded to whoever consumes the output:

<!-- example: core-stylesheet-link -->
```ts
process(template, {
  styling: { placement: 'separate-file', stylesheetLink: 'none' },
});
```

## Cascade layers

`styling.layer` wraps collected stylesheet rules in a cascade layer, so a
component holds the same cascade position however its styles are taken - from
an aggregate stylesheet or from the per-component one beside it:

<!-- example: core-layer -->
```ts
process(template, {
  styling: {
    layer: { name: 'kit.components', order: ['kit.reset', 'kit.components'] },
  },
});
```

`order` declares the full layer order ahead of the wrapper, in every emitted
stylesheet: cascade-layer order is fixed by first declaration, and a
per-component stylesheet may be the first thing a consumer loads. The layer
applies under every stylesheet placement wherever rules reach a stylesheet; inline
`style="..."` declarations carry none. Under `styling.language: 'scss'` the
component-level preamble's `@use` and `@forward` loads stay above the layer
block, where sass requires them, and the order is stated through a
generated module instead of in the styles: `_layer-order.scss`, emitted
beside the stylesheet, or beside the Vue or Svelte component file whose
style block loads it, and holding only the
`@layer` order statement, which the stylesheet loads ahead of its other
loads (`@use './layer-order' as *;`, taking no namespace, so a module of
your own named `layer-order` loads beside it). Sass allows nothing before a
stylesheet's loads and emits each loaded module's CSS ahead of the
stylesheet's own, so an order written in the stylesheet would compile after
what its modules emit, and a module emitting rules inside one of the layers
would declare that layer first; loaded first, the order module puts the
statement first in the compiled CSS. Keep the module beside the file that
loads it wherever that is compiled. A `layer` that is not an object with a `name`, such as a bare string,
is a processing error.

## Validation

`process()` validates the template first and throws a `TemplateError`
carrying a node path (such as `children[2].conditions[0]`) when it breaks a
structural rule. A template that breaks several gets one `TemplateError`
listing every violation, one per line, with each message and path also on
its `errors`. `validateTemplate` is exported for standalone use, and takes
the build's extensions the way `process()` does:
`validateTemplate(template, { extensions: [react()] })`. A node
missing a field its type requires, or carrying a key its type does not take
(`style` beside `tag` rather than inside `attributes`), is one of those
errors, with the field's path and, for a misplaced key, where it goes.

An extension's override block (`extensions.vue` on an element or the
component) is checked against the keys that extension reads: a key it does
not read, such as a misspelled one, is a warning naming its path. Blocks for
extensions not in the build are left alone.

A name the generated component declares itself - a helper, an import, a
local - cannot name a prop, slot, loop variable, id or derived value, since
the output would declare it twice. The engine's own names (`bem`, the
dynamic-tag locals `RootTag` and `Tag`, the surface helpers) are reserved in
every build. A name a target's output generates is reserved in builds that
include that target: each extension declares its names (`reservedNames`),
so a template built only for React may use a name only the Vue output
declares. Validated without extensions, a template is checked against the
template format and the engine's own names. To keep a template buildable
for targets a build does not render, name them in `reserveNamesOf` (on
`process()` and `validateTemplate` alike): their names are reserved too,
and a prop's alias (`use-attrs` read as `useAttrs`) steers clear of them, so
it is the same in every target's build. Each extension's README lists the
names it reserves.

## Extensions

Extensions are passed directly - no registry, no string-key lookup:

<!-- example: core-extensions -->
```ts
process(template, { extensions: [react(), bem()] });
```

Target extensions implement the `TargetExtension` interface exported from
this package (`kind: 'target'`) and take over rendering entirely; the core
stays free of framework knowledge. A target extension that declares a
stylesheet placement it cannot produce lists it in `unsupportedPlacements`.
`FrameworkExtension`, `isFrameworkExtension`, `kind: 'framework'` and
`unsupportedStrategies.styling` are deprecated aliases, accepted until 3.0.0. Beside the keys it reads (`overrideKeys`), an extension
may declare the names its output generates (`reservedNames`), the override
blocks of the shared shape it nests inside its component override
(`overrideBlocks`), and a check of its own (`validateOverrides`) whose
violations validation reports with its own.

### The emitter toolkit

`@js-template-engine/core/emitter` holds the helpers the first-party
target extensions build their output with: prop aliases, two-way value
plumbing (the component's own copy, its setter lines and seed), expression
scanning, passthrough routing and its helper declarations, sibling line
layout, class-list and handler code. It is the toolkit for writing a
target extension; templates, kit tools and `process()` callers need only
the main entry point. Both entry points ship CommonJS with type
declarations and resolve from ESM and CommonJS alike.

The toolkit follows what the first-party extensions need, so it may change
in any minor release; the main entry point is the one covered by semantic
versioning. An extension built on the toolkit pins core's exact version.
