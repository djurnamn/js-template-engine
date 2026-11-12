# Changelog

All notable changes to JS Template Engine are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.0] - 2026-11-12

A minor release. A template that rendered on 2.2.1 renders on 2.3.0 unless
one of these names it; each changes output or newly rejects a template, and
each has its entry under Changed or Fixed. Read them before upgrading:

- React and Vue components export their props interface.
- Typing on a passthrough root changed in React, Vue and Svelte: declared props
  keep their own type, a component without a default slot takes no
  `children`, and Vue types the attributes it hands on.
- A discriminated surface root's discriminant is validated, so a template
  shape that used to render is now an error.
- React no longer widens `CSSProperties` in a consumer's project; code of
  your own that relied on that needs the declaration it used to get for free
  (see the entry).
- On a passthrough root, React runs the consumer's handler as well as the
  template's instead of the template's alone, and Vue keeps the template's
  own attributes over a consumer's.
- Where a template's event meets a consumer's handler for the same event, the
  consumer's handler runs first, and the template's is skipped when the
  consumer calls `event.preventDefault()`. Vue and Svelte runes mode used to
  run the template's first. Legacy Svelte's `on:` directives still run
  beside the spread: a consumer's handler there is not ordered first and
  cannot cancel the template's.
- React's `composeEventHandlers` is typed by the event it composes, so a
  handler of your own passed beside it that was typed loosely (a parameter
  of `Event` where React passes its synthetic event, say) can now fail your
  `tsc`.
- A generated modifier wrapper calls a handler given by name through a
  generated `invokeHandler(onSubmit, event)`, so an unset optional handler
  prop does nothing where it used to throw, and a handler declaring fewer
  parameters than the listener passes type-checks.
- A Svelte root whose tag may be a component leaves `element` undefined while
  a component renders, and in legacy mode passes its events to that component
  as `on*` props, which a component that only forwards `on:` events doesn't
  receive.
- HTML output contains no script any more, and the `scripting` option, the
  `--scripting-*` flags and a kit's `scripting*` keys have no effect.
- Vue components destructure their props from `defineProps`, which needs Vue
  3.5 or later. A Vue script that declares a prop's name still shadows the
  prop, which is left out of the destructure, or takes an alias there where
  a two-way value or a declared id reads it.
- A `$spread` on a passthrough root merges with the consumer's class, style
  and handlers in every target, where it replaced them.
- Svelte output needs Svelte 5 or later in both modes. A legacy component whose
  root tag may vary and that handles an event with a key guard types the
  event parameter in its markup, which Svelte 4 does not compile.
- A node that spreads `rest` and handles an event now runs the consumer's
  handler as well as its own in React and Svelte runes mode.
- An expression no longer reads a named slot where a parameter or local
  variable of the same name shadows it, and no longer rewrites an object
  key named like a slot.
- A generated `data-jte-node` value carries the component's name
  (`StatGrid-0` where it was `0`); CSS of your own that matched the old value
  needs the new one.
- A prop, slot or loop variable named after a binding the generated
  component declares itself, such as `bem`, or `props` in a build with
  React, is now a validation error.
- A slot rendered in several places that exposes other binding names or sets
  another `scopeRequired` in one of them is now a validation error.
- A key a node doesn't take, such as a `description` on an element or a
  `style` written beside `tag`, is now a validation error, and a type error
  at the key under `defineTemplate`.
- A prop `default` that is an expression, or not a value of the prop's type,
  and a `style` that is not a style object (a string, say) are now
  validation errors.
- Optional props are typed `?: T | undefined` in the generated props of
  every scripted target.
- A key modifier filters before `prevent` and `stop` in React and Svelte,
  so `['prevent', 'enter']` prevents Enter alone, as Vue already did.
- Tailwind's `output: 'styles'` now refuses `max-w-auto`, `max-h-auto`,
  `basis-min`, `basis-max`, `basis-fit` and an arbitrary value that calls
  `theme()` or `--spacing()`, each of which converted before.
- Tailwind's converted CSS comes out in a different order: rules follow
  Tailwind's variant order rather than class order, the later of two
  overlapping utilities wins, your own style keys keep their written order,
  shadows compose `box-shadow` through `--tw-shadow`, and a stylesheet that
  reads Tailwind's composed custom properties ends with `@property` rules.
- A styling extension's class comes first among an element's attributes in
  every target.
- Two nodes sharing a class get its rule once, and each selector in a
  comma-separated style key collapses on its own, so a stylesheet can lose
  a repeated rule or a compound selector it had.
- React's in-file stylesheet constant is `componentStyles`, where it was
  `styles`.
- A consumer's `style` wins over the style of a node spreading `rest`, and
  over a passthrough root's own declarations, in every target.
- Line breaks the generated code adds for reading no longer render as a
  space between siblings in Svelte and the html target; only authored text
  puts a space between siblings. Text there can lose a space it showed
  before without authoring it. Vue no longer turns a text-only element's
  line breaks into spaces either.
- The html target writes a bound `value` on a `<select>` as comments on its
  options: `<!-- if 'a' === value: selected -->` above each `<option>`, and
  on a `multiple` select `<!-- if [picks].flat().includes('a'): selected -->`,
  where it wrote `value="{{ value }}"` on the `<select>`.
- Under `styling.language: 'scss'` with a `layer.order`, the `@layer`
  statement moves into a generated `_layer-order.scss`, loaded first with
  `@use './layer-order' as *;`: by each separate-file stylesheet, written
  beside it, and by the style block a Vue or Svelte component file keeps
  under `in-file` and `inline`, written beside the component. Keep the
  module beside the file that loads it.
- `class: null` in a target's `attributes` override also removes the classes
  the node's `conditionalAttributes` entries add, BEM runtime modifiers
  included.
- Tailwind's `font-[var(--x)]` converts to `font-weight`, as Tailwind 4
  reads it, where it converted to `font-family`. Write
  `font-[family-name:var(--x)]` for a typeface.
- An event modifier outside the supported set, a slot named `default` (or a
  `default` key in `slots`), and a
  `conditionalAttributes` style with no class beside it are now validation
  errors. Each rendered wrong before.
- A prop definition that isn't an object with a `type`, and a component
  extension override that isn't an object or has a shared key of the wrong
  shape (`imports` a string, say), are now validation errors.
- An `imports` entry that doesn't parse as TypeScript (or TSX) is now a
  validation error naming the entry and the line the parser stopped at,
  where it used to be written into every target's component file. The
  check runs where the `typescript` package is installed.
- A template that breaks several rules throws one `TemplateError` listing
  them all, whose own `nodePath` is empty; each violation's path is on its
  `errors`.
- A prop whose name isn't a valid variable name is read in expressions by its
  camel-cased alias in every target: `aria-pressed` as `ariaPressed`, and a
  reserved word with `Prop` added, `for` as `forProp` and `class` as
  `classProp`. Legacy Svelte rejects a hyphenated one.
- Vue's exported props interface declares a hyphenated prop under its
  camelized key (`ariaPressed?:` where it was `'aria-pressed'?:`), the key
  Vue sets; code that reads the interface by the old key needs the new one.
- A React passthrough root whose tag reads a declared prop, such as `as`,
  now makes a generic component, typed by the tag or component that prop
  holds (see the entry under Added). For those components only:
  - `NameProps` is a type alias rather than an interface, so it can't be
    extended by declaration merging.
  - Derive the props from `NameProps`, or `NameProps<'a'>` for one tag,
    not `ComponentProps<typeof Name>`: that resolves the tag to every tag
    allowed, so it keeps only the props they share, or nearly any props
    when the tag is `componentValued`.
  - Without `componentValued`, an `as` typed `any` or `string` now accepts
    tag names only.
  - Passing explicit type arguments to the component pins the tag to its
    default unless the tag is one of them.
- A prop you move to a two-way `bindable` object (see the entry under Added)
  reports each change in Svelte through its change prop, such as
  `onValueChange`, in both modes, and dispatches no event. If the component
  sent the change with `createEventDispatcher` before, its Svelte consumers'
  `on:valueChange` listeners hear nothing; they pass the prop
  (`onValueChange={handle}`) or bind the value (`bind:value`) instead.

### Added

- **A two-way prop relayed to its owner.** A prop's `bindable` object takes
  a second form, `{ given, report, changeProp }`, for a value whose owner
  holds it - a state-machine driver or a native input, which handles being
  controlled or uncontrolled itself - beside the copy form
  `{ current, setter }`, which is unchanged. The component keeps no copy:
  the template forwards the value the consumer gives under `given` and
  hands the owner `report`, the same text in every target, and `report`
  calls `changeProp` with each new value, every call passing through. React
  reads the prop, with no state, hook or `'use client'`; Vue reads it as a
  `computed`, `modelValue` first when `extensions.vue.model` names the
  prop, and emits `update:<prop>` (and `update:modelValue`) after the
  change prop; Svelte, in both modes, reads it through an echo guard
  inlined in the component, so with nothing given and nothing bound the
  owner keeps its own state, and assigns the prop before calling the change
  prop, so a consumer's `bind:` follows it. A relay names no `defaultProp`
  and sets no `default`: what the owner starts from is an ordinary prop the
  template forwards. `given` and `report` are reserved names like `current`
  and `setter`, and a write to `given` is an error naming `report`. Types:
  `BindableDefinition` is the union of `CopiedBindableDefinition` and
  `RelayedBindableDefinition`; `@js-template-engine/core` exports
  `relayedBindingsOf` and `RelayedBinding`, and its emitter entry
  `relayedReportLines`, `relayedComment`, `echoGuardName`,
  `isRelayedBindableDefinition` and `isCopiedBindableDefinition`.

- **`styling.placement` names where a component's styles go.** It takes
  `'inline'`, `'in-file'` or `'separate-file'`, typed `StylesheetPlacement`,
  and a target extension declares the placements it cannot write with
  `unsupportedPlacements`. The CLI's `--stylesheet-placement` sets it.

- **Target extensions.** React, Vue and Svelte are target extensions:
  `TargetExtension`, `kind: 'target'` and `isTargetExtension` in
  `@js-template-engine/core`, and `TARGET_NODE_OVERRIDE_KEYS` in
  `@js-template-engine/core/emitter`. A `process()` call without one renders
  the html target. The CLI's `render --target <name>` takes `react`, `vue`,
  `svelte` or `html`; left out, it renders html as before. The CLI exports
  `targetNames` and `TargetName`, which include `html`.

- **An extension declares the peers its output needs.**
  `Extension.peerDependencies` maps each package a target extension's
  components import or compile against to the version range they need:
  `react()` declares `react: '^19.0.0'`, `vue()` `vue: '^3.5.0'`, and
  `svelte()` `svelte: '^5.0.0'`, or `'^5.20.0'` in runes mode. A package of
  generated components takes them as its peers.
- **A compound names its parts.** A component template's `parts` lists the
  components that make up a compound, by name, such as
  `parts: ['DialogTrigger', 'DialogContent']`. Rendering ignores it; a
  kit's tooling reads it to place a part beside its compound and copy the
  compound whole. Validation rejects an entry that is not a non-empty
  string, the component's own name, and a name listed twice, and the JSON
  Schema takes the field.
- **Sass importers.** `styling.sassImporters` passes Dart Sass importers to
  every compile the engine runs under `'css'` output, beside `loadPaths`,
  such as one resolving a package's own `pkg:` URLs. A preamble that loads a
  `pkg:` URL is resolved even without load paths.

- **A slot can require its scope.** `scopeRequired: true` on a slot with
  `exposes` says its content must take the values it exposes, as a trigger
  that has to spread the props it is given. React types the slot's prop as
  the render function alone, `trigger?: ((scope: { triggerProps:
  Record<string, unknown> }) => ReactNode) | undefined`, so
  `<Dialog trigger={<Button label="Open" />} />` fails `tsc` instead of
  rendering a button that opens nothing, and renders only a function: the
  fallback, or nothing, otherwise. Svelte runes mode already types the
  snippet as a function of the scope. Vue and legacy Svelte can't refuse
  content that ignores the scope, so there the key documents the slot, and
  HTML output is unchanged. `scopeRequired` on a slot without `exposes` is a
  validation error.
- **A passthrough root can render conditionally.** Wrap the passthrough
  element in an `if` with no `else`, or with an `else` that renders nothing,
  and the component renders nothing while the condition is false: a menu
  panel shown only while its menu is open leaves no items in the DOM when
  closed. React returns `null`, Vue uses `v-if`, Svelte wraps the element in
  `{#if}` in both modes, and the HTML rendering shows the `if` comment. While
  it renders, the element takes the consumer's props, class, style and
  handle, as a root that always renders does. The handle is released while
  nothing renders: React's ref is `null`, Svelte's `element` becomes `null`
  and is typed so, and Vue's `$el` is not the element while nothing renders
  (a comment or empty text node). The condition can read any prop. An `else` that renders another
  element is a validation error, since that root is a discriminated surface
  root, whose every branch sets `passthrough`.
- **A discriminated surface root can pick its branch by whether a prop is
  given.** A Button that renders an `<a>` when `href` is set and a `<button>`
  otherwise declares `href: { type: 'string', required: true }` in the link
  branch and writes the condition as `href !== undefined`; the other branches
  leave `href` out or type it `undefined`. Every target tests
  `href !== undefined`, so an empty `href` still renders the link.
  React narrows its props union on that test and types `href?: undefined` on
  the other branches, so the button branch's own props type-check under
  `tsc --strict` and a string `href` on the button is a type error, while
  `href={undefined}` is accepted, also under `exactOptionalPropertyTypes`.
  Vue and Svelte take `href` as an optional prop and branch on the same test.
  A presence test on a prop with a boolean member is a validation error,
  since Vue reads a boolean prop that is left out as `false`.
- **React's attribute names, exported.** `@js-template-engine/extension-react`
  exports `REACT_ATTRIBUTE_NAMES`, the React name of each HTML and SVG
  attribute React renames by its HTML name (`tabindex` as `tabIndex`, `for`
  as `htmlFor`, `stroke-width` as `strokeWidth`, `xlink:href` as
  `xlinkHref`), and `attributeName(name)`, which looks one up and returns
  any other name unchanged. The React output spells every such attribute a
  template gives as React does, `formnovalidate`, `enterkeyhint`,
  `accept-charset` and `http-equiv` among them.
- **Two-way props generate their controlled and uncontrolled value.** A
  prop's `bindable` takes an object, `{ current, setter, defaultProp?,
  changeProp? }`, beside `true`. The template reads the value under
  `current` and changes it only by calling `setter`, with the next value or
  an updater `(current) => next`. The value is the given prop when it isn't
  `undefined` (`null` included) and otherwise the component's own copy,
  started from `defaultProp`, or from the prop's own `default` when there is
  none. Every scripted target generates the protocol its consumers expect:
  - React keeps the copy in `useState`, reads a given prop over it and
    starts the file with `'use client'`.
  - Vue declares the prop explicitly beside a typed `update:<prop>` emit,
    rather than with `defineModel`, so `v-model:<prop>` binds a plain
    `ref(false)`.
  - Svelte declares `$bindable()` in runes mode and reads the value through
    `$derived`; legacy Svelte reads it through `$:`. Either way `bind:`
    follows it.

  The component's `script` reads the value under `current` as well, written
  once for every target: `setOpen(!isOpen)` works as written in React, Vue
  and Svelte. In Vue, where the value is a `computed`, the output reads each
  free `isOpen` in the script as `isOpen.value`, leaving a parameter or local
  of the same name, a member such as `menu.isOpen`, an object key, a class
  field and a regular expression alone; `selected.value` reads a value's own
  `value` field in every target. A `vue` script override is Vue's own code
  and reads `isOpen.value` itself. A script, event handler or other
  template expression that assigns or increments the value is a validation
  error naming the setter.

  The setter skips a value that hasn't changed and calls `changeProp` with
  every new value, before Vue's emit. Calls in one handler build on each
  other, so two toggles leave the value where it was. A value given with no handler writing
  changes back stays as given in React and Vue, while Svelte takes the
  change locally and, until its first change, an uncontrolled value follows
  a new default. HTML output names where the value comes from in a comment
  at the head of the markup, and `renderInstance` reads the given value or
  its default. The new Vue component override `extensions.vue: { model:
  '<prop>' }` lets a bare `v-model` bind one two-way prop, through
  `modelValue` and `update:modelValue`. Validation checks the object: the
  default and change props are declared props of the right kind, the default
  prop declaring the two-way prop's type (or that type with `| undefined`;
  whitespace, union order, quote style, `boolean` against `true | false` and
  `T[]` against `Array<T>` aside), and the
  names the targets generate (`current`, `setter`, the own copy, Vue's
  `emit`) are taken by no prop, slot, loop variable or top-level script
  declaration (a declaration inside a function or block may shadow one
  there, and a renamed destructuring key, as in `const { isOpen: open } =
  state`, declares only `open`). `bindable: true` keeps its meaning. `PropDefinition.bindable` is now typed
  `boolean | BindableDefinition`, and the types package exports
  `BindableDefinition`; code of your own that reads the field as a boolean
  needs the wider type. Core exports `twoWayBindingsOf`, which lists a
  component's two-way props, and `isEventType`, which tells an event prop's
  type.

- **Derived values, written once.** A component's `derived` map names values
  computed from its props and two-way values, each with its expression, in
  the order they read each other: `derived: { matches:
  'items.filter((item) => item.includes(search))', count: 'matches.length'
  }`. The template and the component's `script` read each by name, and every
  scripted target keeps it in step with what it reads:
  - React declares `const matches = ...;` after the props and two-way
    values, ahead of the script.
  - Vue declares `const matches = computed(() => ...)`. Its expression and
    the shared `script` read each two-way and derived value through
    `.value`, as the script already reads a two-way value, so a script
    written once hands a consumer the value, not the ref. The template
    reads the names bare.
  - Svelte declares `const matches = $derived(...)` in runes mode and `$:
    matches = ...` in legacy mode.

  HTML output lists each derived value and its expression in a comment at
  the head of the markup, after the two-way values, and `renderInstance`
  evaluates each in order, calling the helpers the `imports` lines declare,
  so an instance shows the filtered list and its count. An expression reads
  props, two-way values, derived values declared
  before it and what the `imports` lines declare, such as a sorting helper.
  Validation rejects an expression reading a name only the component
  `script` declares (it names the function and points to `imports` for a
  pure helper or constant, to `ids` for a generated id, and to keeping the
  value in the script for one read per instance from a context), a
  two-way setter, a name a target generates for a two-way value
  (`ownOpen`, `latestOpen`, `emit`) or a derived value declared after it,
  a cycle (named with its path), an expression that assigns a prop, two-way
  value or derived value, a top-level `,` or `;`, a script, event handler or
  other template expression assigning or incrementing a derived value, a
  derived
  name that a prop, slot, two-way value, loop variable or script or
  `imports` declaration already takes, and `derived` on a discriminated
  surface root. Reads and writes inside a template literal's `${...}` count
  like any other, so a script assigning a two-way value inside one is now
  rejected as well. `renderInstance` evaluates an expression as JavaScript,
  so a derived value written with a cast or `!` stays unset at rest; type
  the helper it calls instead. Core exports `derivedValuesOf`, and the
  types package's `ComponentNode` has the `derived` field.

- **Ids per instance, declared once.** A component's `ids` map declares the
  ids it needs for wiring such as `aria-controls`, `aria-labelledby`, a
  label's `for` or a radio group's `name`: `ids: { listId: 'command' }`, or
  `ids: { inputId: { prefix: 'field', prop: 'id' } }` to let a string prop
  the consumer gives replace the generated id. The template, the component's
  `script` and derived values read each by name, like a prop, and every
  scripted target generates it once per instance, after the prefix:
  - React calls `useId()` once and builds each id from it.
  - Vue does the same with `useId()` (Vue 3.5 or later); an id with a
    `prop` is a `computed`, which the shared `script` reads through
    `.value`.
  - Svelte runes mode takes `$props.id()` (Svelte 5.20 or later); legacy
    mode numbers instances from one counter on `globalThis` that every
    component shares, so two components with the same prefix never render
    the same id. An id following a prop is set at the instance script's top
    level in legacy mode too.

  HTML output writes `command-1` wherever an expression reads only ids
  (`` `${listId}-label` `` becomes `command-1-label`), so the copied
  markup's aria references resolve and a radio group's inputs share one
  `name`, and names each id in a comment at the head. `renderInstance` and a
  preview story's html number each prefix through the page, so two
  instances get `command-1` and `command-2`, and use the consumer's prop
  value when one is given. React's ids hold characters a CSS selector
  doesn't take as they are (React 19.2 renders `_R_1_`, earlier versions
  `:` or `«»`), so an id needs `CSS.escape()` before it goes into a
  selector, and legacy Svelte's counter does not match between server
  rendering and hydration.
  Validation rejects an id name a prop, derived value, slot, loop variable
  or script or `imports` declaration already takes, an empty prefix or one
  that is not a literal of letters, digits, `-` and `_`, two ids sharing a
  prefix, a `prop` the component does not declare or does not type
  `string`, a two-way prop as the `prop`, a script or handler assigning an
  id, a declaration of `generatedId` or `nextGeneratedId` beside `ids` (an
  override's `imports` lines included), a read of either, an id named after
  what the targets import (`useId`, `computed`, `shallowRef`, `useState`,
  `useRef`), and `ids` on a discriminated surface root. Core exports
  `declaredIdsOf` and the `DeclaredId` type, and the types package's
  `ComponentNode` has the `ids` field and exports `DeclaredId`.

- **A passthrough root can send some of the consumer's attributes to an
  element inside it.** An element below a `passthrough: true` root sets
  `passthrough: { attributes: [...] }` to name what it receives instead of
  the root: `'*'` for every attribute but `class`, `style` and `data-*`,
  `'aria-*'` for every ARIA attribute, `'on*'` for every event handler, and
  HTML attribute names in their HTML spelling (`required`, `tabindex`), which
  each target matches in its own spelling (in Vue, a render function's
  camel-case `ariaDescribedby` matches `aria-describedby` too). A `<label>` root around a
  native checkbox then passes a field's `aria-describedby`, `required` and
  the consumer's handlers to the input, where a blur handler runs (focus
  events don't bubble to the label in Vue or Svelte) and a click handler
  runs once per press, while `class`, `style`, `data-*` and the DOM handle
  stay on the label. The element's own attributes win over the consumer's
  and its events run the consumer's handler first, then its own, as on the
  root. An ID list the element sets itself (`aria-describedby`,
  `aria-labelledby`, `aria-controls`, `aria-owns`, `aria-details`) joins the
  consumer's instead, the element's IDs first, each once, through a
  generated `authoredAndConsumer` helper (a condition-gated one too, and in
  Vue the consumer's camel-case `ariaDescribedby` as well), so a field's own description and a
  hint elsewhere on the page both describe the input. The join applies on
  every passthrough surface: an ID list a passthrough root sets itself joins
  the consumer's the same way, with or without a routed element below it
  (on a routing root, for the lists that stay in the root's share), and
  the html target's comment and `renderInstance` follow.

  `handle: 'routed'` beside `attributes` moves the DOM handle to the
  element as well, for an input whose ref a form library registers or
  `focus()` moves to. React forwards `ref` to it, typed after its tag and
  composed with a `ref` the template sets there. Vue exposes it as `$el`
  (typed `any`, as Vue types every instance's) and as `element`, typed
  after its tag, so `field.value?.element?.focus()` type-checks; both merge
  into the script's own `defineExpose` call, and an `element` the script
  exposes stays its own, with a warning. Svelte binds it to `element`,
  typed after its tag, in both modes. `handle: 'root'` is the default. A
  routed handle may not sit inside a loop.

  - React types the props as the root's attributes without the routed keys
    plus the routed element's for them, through a `<Name>RoutedKeys` alias,
    and splits the undeclared props into `rest` and `routedRest` with a
    generated `consumerAttributes` helper. A listed HTML name matches its
    prop case-blind, so `formnovalidate` types `formNoValidate`.
  - Vue's props interface extends two `@vue-ignore` bases, and the two
    elements bind `consumerAttributes($attrs, 'root')` and
    `consumerAttributes($attrs, 'routed')`.
  - Svelte spreads the two shares of `restProperties` (`$$restProps` in
    legacy) and keeps `bind:element` on the root unless the handle is
    routed; legacy Svelte routes no handlers.

  Under `'*'` the types follow what lands where: the root is typed with
  only its class, style and handle, and the routed element with its tag's
  whole attribute surface.

  HTML output comments the element with what it receives, and
  `renderInstance` splits a consumer's attributes the same way. Validation allows one routing element per component, with an
  intrinsic static tag, below a passthrough root with a static tag, and
  rejects a list naming `class`, `style`, `ref` or a camel-case name. A
  declared name in the list is skipped, as under the wildcards; bind it on
  the element. Routing `id` or `autofocus` into a loop warns. The names
  `consumerAttributes`, `authoredAndConsumer`, `routedRest`,
  `routedElement`, `vRoutedElement`, `invokeHandler` and
  `surfaceProperties` are reserved,
  so a prop, slot or loop variable can't take them. The types package
  exports `PassthroughRouting`, and `ElementNode.passthrough` is typed
  `boolean | PassthroughRouting`; code of your own that reads it as a
  boolean needs the wider type.

- **A Svelte script per mode.** The component's `extensions.svelte` override
  takes `legacy` and `runes` blocks, each with the override's own keys
  (`script`, `imports`, `style`, `props` and their strategies), applied only
  when the extension emits that mode, on top of the override's shared keys.
  A legacy `$: doubled = count * 2` and its runes form
  `const doubled = $derived(count * 2)` now live in one template that builds
  in both modes. Templates without the blocks render as before. Both blocks
  are checked whichever mode you build: a malformed one is an error naming
  its path, and a key a block doesn't read is a warning. The override type is
  exported as `SvelteComponentOverride`. A target extension may set the new
  optional `resolveComponentOverrides`, so the check for component
  references not in scope reads the same component its render does: a
  component a `runes` block imports is in scope in runes output.

- **An override key the extension doesn't read is a warning.** Each
  extension declares the keys it reads from its override blocks, through the
  new optional `overrideKeys` on `Extension` (`node` for an element's
  `extensions.<key>`, `component` for the component's), and processing warns
  about any other key with its path: `extensions.vue.omitProps` used to be
  ignored without a trace. The target extensions, BEM and Tailwind declare
  theirs. Blocks of extensions outside the build stay unchecked.

- **Tailwind's `output: 'styles'` reports every utility it cannot convert
  in one run,** one line each with its node, instead of stopping at the
  first. A styling extension records such an error through the new optional
  `error(message)` on its context, and processing fails once the whole
  component has been visited. The combined `TemplateError` lists each
  error on its `errors`, with its message and node path.
- **Tailwind's `output: 'styles'` warns about utilities it leaves as class
  names.** A class in `conditionalAttributes`, or a word in a string literal
  of a class expression (other than one compared against, as in
  `variant === 'primary'`), that reads as a Tailwind utility is not converted
  and has no CSS behind it; the build now says so for each node, and
  suggests a `conditionalAttributes` entry that pairs a class of your own
  with a style, which becomes that class's rule.
- **Tailwind's `output: 'styles'` can write `dark:` under a selector.**
  `tailwind({ output: 'styles', darkSelector: '[data-mode="dark"]' })`
  writes each `dark:` utility under `:where(:root:is([data-mode="dark"]))`,
  which adds no specificity, instead of `@media (prefers-color-scheme:
  dark)`, so converted dark styles
  follow a class or attribute on `<html>`, including the one a kit
  preview's color-mode option sets. A selector holding `&` is used as
  written, as in Tailwind's `@custom-variant dark (...)`, with the
  specificity it spells; a list takes `&` in every member or in none, and
  the exported `isDarkSelector` tells whether a value is accepted. The CLI
  takes it
  as `--tailwind-dark-selector`. With `convertStyles: true`, a style key
  spelling the composed selector converts back to `dark:`.
- **Tailwind's `output: 'styles'` converts `aria-*` and `data-*`
  variants** to attribute selectors on the node, as Tailwind 4 defines them:
  `aria-checked:` selects `[aria-checked="true"]`, `data-active:` selects
  `[data-active]`, and a bracketed attribute such as `data-[state=open]:` or
  `aria-[sort=ascending]:` selects it with its value quoted. They stack with
  other variants, so `hover:aria-checked:` and `dark:data-[featured=true]:`
  convert too. Binding an attribute and styling it with these variants gives
  a condition its styles without a conditional class.
- **Tailwind's `output: 'styles'` converts `user-invalid:` and
  `user-valid:`** to `:user-invalid` and `:user-valid`, so a form field
  turns red only once someone has changed it, not while a required field is
  still empty. Their rules sort where Tailwind 4 puts them, after `invalid:`
  and before `read-only:`, and with `convertStyles: true` the two
  pseudo-classes convert back.
- **Tailwind's `output: 'styles'` converts more utilities,** each to the CSS
  Tailwind 4 writes for it: outline width, style, color and offset
  (`outline-hidden` included), `line-clamp`, `text-wrap`/`text-balance`/
  `text-pretty`, the numeric variants (`tabular-nums`, `slashed-zero`, ...),
  viewport sizes (`min-h-dvh`, `h-svh`, `w-lvw`) and `lh`, `max-w-prose`
  and the breakpoint widths (`max-w-screen-md`), fractions for the `min-`
  and `max-` sizes (`max-w-1/2`), `place-content`/
  `place-items`/`place-self`, `decoration-` thickness, style and color,
  `underline-offset`, `columns`, `fill`, `stroke`, `accent`, `caret`,
  `resize` (`resize-none`, `resize-x`, `resize-y`), `field-sizing`
  (`field-sizing-content`, `field-sizing-fixed`), `scroll-m*`/`scroll-p*`, scroll-snap alignment and stop, `antialiased`,
  and arbitrary custom and prefixed properties (`[--gutter:1rem]`,
  `[-webkit-line-clamp:2]`). Outline widths and the numeric variants read
  Tailwind's own custom properties, which the converted CSS registers
  itself (see Changed).

- **Tailwind's `output: 'styles'` converts `group-*` and `peer-*` variants
  and rings,** as Tailwind 4 writes them. `group-hover:` becomes
  `:is(:where(.group):hover *)` and `peer-checked:`
  `:is(:where(.peer):checked ~ *)`, over any supported pseudo-class,
  `aria-*`, `data-*` or bracketed selector (`group-[.is-open]:`), with
  named groups (`group-hover/item:`); the `group` and `peer` marker classes
  stay on their elements. A compound over a variant outside the subset,
  such as `group-has-checked:`, says so in its error. `ring`, `ring-<n>`,
  `inset-ring`, `inset-ring-<n>`, ring and inset ring colors,
  `ring-offset-*` and `ring-inset` compose `box-shadow` through Tailwind's
  custom properties, as shadows now do, so a ring and a shadow on one node
  draw together. Shadow colors (`shadow-indigo-500/50`, `shadow-[#4f46e5]`,
  `shadow-(color:--glow)`) set the color the shadow reads. In Svelte, the
  marked element must be in the same component as the node its variant
  styles.

- **`visitNodes` in `@js-template-engine/core`** walks a template's nodes
  with their paths. `TargetExtension` gains `builtInComponents`, the
  capitalized tags a target renders without an import, and
  `globalComponentRegistration`, for a target that resolves globally
  registered components.
- **A toolkit for target extensions at `@js-template-engine/core/emitter`.**
  The helpers the React, Vue and Svelte extensions build their output with -
  prop aliases, two-way value plumbing, expression scanning, passthrough
  routing, sibling line layout, class-list and handler code - are exported
  from this subpath, for writing a target extension. It may change in any
  minor release, so an extension built on it pins core's exact version.
  Templates, kit tools and `process()` callers need only the main entry
  point, which semantic versioning covers.
  Its `scriptDeclarations` reads only a script's top-level declarations,
  imports and legacy `$: name =` included, and only the names a
  destructuring pattern binds: a declaration inside a function, block or
  callback is that scope's own, and a renamed key or a default declares
  nothing.
- **A name a target's output generates is reserved in builds that include
  that target.** An extension declares the names its output declares itself
  through the new optional `reservedNames` on `Extension`, and validation
  reserves the names of the extensions it is given: `process()` those of
  its build, `validateTemplate(template, { extensions })` those passed, so a
  component built only for React may name a prop after a helper only the
  Vue output declares. The engine's own names (`bem`, `RootTag`, `Tag`, the
  surface helpers) stay reserved in every build. Two more optional fields
  let an extension check what only it reads: `overrideBlocks`, override
  blocks of the shared shape nested in its component override, which
  validation checks and scans as the override, and `validateOverrides`, a
  check whose violations validation reports with its own. The scaffolder
  and the CLI's `validate` command check a template for every scripted
  target, so a kit stays buildable for all of them.
- **A prop's alias steers clear of the names the build reserves.** A prop
  whose name is not an identifier (`use-attrs`) is read by an alias clear
  of the names the build's extensions reserve, and of those of the
  extensions named in the new `reserveNamesOf` option of `process()` and
  `validateTemplate`, which reserves the names of targets a build does not
  render. The scaffolder and the CLI reserve every scripted target's names,
  so a prop reads by the same alias whichever target renders it.

- **A prop can document a default it applies without declaring.** A prop's
  `documentedDefault` holds the default as code a consumer reads, such as
  `"'start'"`, for a default that comes from elsewhere (an absent value the
  component treats as the default, a CSS fallback). Each scripted target
  writes it as the `@defaultValue` of the prop's description comment, so it
  shows only on a prop that has a `description`, and the generated code is
  the same as without it. A prop sets `default` or `documentedDefault`, not
  both.

- **A component can carry a description.** A template's `description` says
  what the component is for, in markdown, and each scripted target writes it
  as the generated component's doc comment, so an editor shows it on hover
  over the component's import and its tag: a TSDoc comment in React, the doc
  comment of a plain `<script lang="ts">` block beside `<script setup>` in Vue,
  and a `<!-- @component -->` comment in Svelte. HTML output carries none.

- **One instance of a template renders to static markup.** Core's
  `renderInstance(template, { props, children, slots, resolveComponent })`
  renders the markup one set of props produces, at build time, for
  documentation beside the React, Vue and Svelte source: expressions
  evaluated, the branch taken, loops expanded, styling extensions' classes
  applied in the order every target uses, and referenced components rendered
  inline through `resolveComponent`. It has no script and assumes the kit's
  stylesheet. A component written by hand for each target renders as
  `resolveComponent` describes it - the content passed into it, at rest:
  closed, with its placeholder showing, or the template it renders - inside
  one comment saying its behavior is not included. A component it cannot
  resolve is left out and listed in the result's `unresolved`, and an
  expression it cannot evaluate is left out, with a warning. A prop a
  referenced component is given through such an expression stays unset in
  that component too, so an id built from it (`` `${inputId}-description` ``)
  is left out with a warning rather than written as `undefined-description`.
  A prop the referenced component types as a function alone (optional or
  nullable allowed), such as an `onRemove` callback, does nothing at rest,
  so one it cannot evaluate is left out without a warning.
  The declarations on a template's own `imports` lines, such as a helper or a
  constant, run before its expressions, their TypeScript types erased with
  the `typescript` package where it is installed; one that can't run at
  build time, such as a context made with an imported `createContext`, warns
  only when an expression reads it. For that, core has an optional peer
  dependency on `typescript`, which `renderInstance` uses to evaluate typed
  `imports` declarations; without it, only declarations written as plain
  JavaScript run. A warning's new
  optional `kind` tells the two apart (`'unresolved'`, `'unevaluated'`) from
  a styling extension's, which carry none. Slot content
  passed as `{ content, slotScope }` reads the values the slot exposes,
  each evaluated only when the content reads it, and
  a form control's value is written as markup: the selected option, a
  textarea's text.
- **A dynamic tag can sit on any element.** A heading whose rank is a prop,
  or a tag picked per loop item, no longer needs one conditional branch per
  tag: ``tag: { $expression: '`h${level}` as const', default: 'h2' }`` works on
  any element, inside a loop or a scoped slot included. Vue renders
  `<component :is>` and Svelte `<svelte:element this>` where the element
  sits. React binds the tag in the nearest scope that encloses it, under the
  next name in the file (`Tag`, `Tag2`, ...): the component body, or a loop
  callback or scoped-slot function, which then takes a block body so the
  expression can read the item. A dynamic root keeps its `RootTag`, and
  `componentValued` stays root-only.
- **A prop can be bindable.** `bindable: true` makes a Svelte runes component
  declare the prop with `$bindable`, so a consumer's `bind:value` compiles
  and follows the component. Legacy Svelte binds every prop already; React
  and Vue ignore the flag.
- **A prop can carry a description.** `description` on a prop definition is
  written as a TSDoc comment above the generated prop in React, Vue and both
  Svelte modes, with a `@defaultValue` from the declared default, so a
  consumer's editor shows it on hover. Markdown is kept. Tooling reads it from
  the template.
- **A component declares where its leftover attributes land.** `rest: { tag }`
  gathers the attributes a consumer passes that are not declared props into
  one value named `rest`, typed as that tag's attributes, for the template to
  spread with `$spread` on any node, inside a scoped slot included. It is the
  route for a compound whose root is a driver and whose surface sits in the
  driver's slot, where `passthrough` cannot reach. React extends
  `Omit<ComponentPropsWithRef<tag>, ...>` and gathers `...rest` (the `ref`
  rides in it); Vue sets `inheritAttrs: false` with `const rest = useAttrs()`;
  Svelte runes gathers `...rest`, and legacy mode declares
  `$: rest = $$restProps`. There is no handle, and `class` and `style` are not
  merged. `rest` excludes `passthrough`, and the name is reserved against
  props, slots, slot scopes and iteration bindings.
- **A component can be generic.** `typeParameters: ['Item']` (or
  `{ name, constraint, default }`) declares type parameters that prop types
  and scoped-slot types may reference, so a list's item type is the
  consumer's: `items={people}` makes the slot's `item` a person. React emits
  `function List<Item>(props: ListProps<Item>)`, Vue
  `<script setup lang="ts" generic="Item">`, and Svelte `generics="Item"` in
  both modes; HTML output ignores them. Each name is an identifier, declared
  once, and not the component's own name or its props type's.
- **A wrapper can render in some targets only.** A `fragment` whose
  `extensions.react` (or `vue`, `svelte`) block names a `tag` renders that
  element or component around its children in that target, with the block's
  `attributes` and `events`, and its children alone everywhere else, the
  HTML output included. A compound root's context provider is
  `{ type: 'fragment', extensions: { react: { tag: 'FieldContext',
  attributes: { value: { $expression: 'id' } } } }, children }`, which adds
  nothing in Vue, Svelte or HTML. A portal is React's `Portal` and Vue's
  `Teleport`, while Svelte renders no wrapper and puts `use:portal` on the
  child it moves. In a conditional or a loop the wrapper takes the `v-if`,
  `v-for` or React `key` as a lone element does. The block takes only `tag`,
  `attributes` and `events`, and needs the `tag`; a class goes in its
  `attributes`, and a `style` there is a validation error.
- **An override can remove an attribute in one target.** A key set to
  `null` in `extensions.react.attributes` (or `vue`, `svelte`) removes the
  node's attribute of that name in that target alone. `class: null`
  removes the node's class there, BEM runtime calls included, and a
  component left with no such call sets up no BEM helper in that target.
- **A bound `indeterminate` works in every target.** `indeterminate` is a
  DOM property with no attribute, and React has no prop for it. Bound on an
  `<input>`, Vue and Svelte set it as a property, and React sets it from a
  small generated ref, `ref={indeterminateRef(mixed)}`, composed with any
  other ref the input takes. Every target writes it when the input mounts
  and when the value changes, so a click that clears a mixed box keeps it
  cleared until the value changes, per row in a loop too, and an unset
  value clears it. In React, one in a conditional entry joins the entry's
  condition (`indeterminateRef(open && mixed)`), and a dynamic tag whose
  `default` is `input` takes the ref as well. The HTML rendering writes it
  as a comment before the input, `<!-- property indeterminate: mixed -->`,
  since markup can't set a property, and a rendered instance leaves it out.
  The React build warns about a static `indeterminate` that isn't `true` or
  `false`.
- **A React component can be a client module.** `extensions.react.client:
  true` on the component emits `'use client';` as the file's first statement,
  so a compound that hands a function child to a client component renders
  under the Next.js App Router. Other targets ignore it.
- **An element can silence Svelte warnings in Svelte output only.**
  `extensions.svelte.ignore: ['a11y_click_events_have_key_events', ...]`
  emits a `<!-- svelte-ignore ... -->` comment directly before the element in
  both Svelte modes and nothing in any other target, for a warning the markup
  cannot avoid. A `comment` node cannot do this: it renders everywhere, and in
  a React iteration it would sit in the row `.map` returns.
- **`VOID_ELEMENTS`.** `@js-template-engine/core` exports the set of HTML
  void elements it renders self-closed, for tools that write markup beside
  the engine's.
- **A polymorphic React component is typed by what it renders as.** When a
  passthrough root's dynamic tag reads a declared prop, written as the bare
  name or with a fallback tag (`as`, `as ?? 'button'`), React generates a
  generic component: `<Button as="a" href="/docs">` takes an anchor's props
  and ref, `href` without `as` is a type error, and leaving `as` out keeps
  the `default` tag's props. With `componentValued` on the tag, `as={Link}`
  takes `Link`'s props. The prop's own type still limits what `as` accepts,
  together with the default tag. Derive the props from `NameProps`, not
  `ComponentProps<typeof Name>`. No runtime code is added.

### Changed

- **Svelte output needs Svelte 5 in both modes.** A legacy component whose
  root tag may vary and that handles an event with a key guard writes a typed
  arrow in its markup, which Svelte 4 does not compile.

- **A passthrough root's `$spread` merges with the consumer's attributes
  in every target.** A record spread on a passthrough root used to replace
  the consumer's handlers in React and Svelte and lose its own class, while
  Vue replaced the consumer's `class`, `style` and listeners. Every target
  now combines them alike: classes join, the consumer's first; styles
  merge, the record's declarations winning; a handler both carry runs both,
  the consumer's first; and a record's `class`, `style` or handler that is
  `undefined` or `null` leaves the consumer's. React and Svelte bind the
  combination as `restAndSpread` through a generated `consumerAndSpread`
  helper. Vue binds `mergeProps($attrs, record)`, also on a discriminated
  branch, on an element that takes its share of the attributes through
  `consumerAttributes`, and on a node spreading `rest`. `mergeProps` is a
  reserved name in a build with `vue()`.

- **A legacy Svelte prop named `default` is a processing error** that points
  to runes mode: a legacy component cannot export a prop by that name.

- **Indentation never renders between siblings, in any target.** The line
  breaks each target's output carries for reading rendered as a space in
  Svelte and the html target, so a component could read `★ Label` there and
  `★Label` in React and Vue. Only authored text nodes put a space between
  siblings now: a line break never sits next to text, and Svelte and the
  html target move it inside the previous tag. Svelte writes an authored
  space at a content edge as `{' '}`, since its compiler trims edges.
  React keeps an authored space before a line break, and Vue no longer turns
  a text-only element's line breaks into spaces.

- **Tailwind's `font-[var(--x)]` converts to `font-weight`.** It matches how
  Tailwind 4 reads an arbitrary `font-` value; it converted to `font-family`
  before. Write `font-[family-name:var(--x)]` for a typeface.

- **Every place a slot renders agrees on its bindings.** A slot rendered in
  more than one place, such as both branches of a conditional, has to expose
  the same binding names in each place, give a binding the same `type`
  wherever it declares one, and set the same `scopeRequired`. A slot that
  breaks this is now a validation error. Each place can still compute the
  values from its own expressions, and React now renders each place with its
  own values, as Vue and Svelte already did.
- **Tailwind's converted CSS registers Tailwind's custom properties.** A
  component whose converted utilities read Tailwind's composed custom
  properties (shadows, rings, outline widths, numeric variants) ends its
  stylesheet with the `@property` rules Tailwind emits for them, so they
  start at their initial values and don't inherit from an ancestor. Under
  `placement: 'inline'` no rules are added: the properties fall back to
  their `var()` defaults and inherit, so an ancestor's ring or shadow can
  reach a descendant that draws its own. A styling extension can add such rules
  through `contributeComponentCss`, which receives every style it
  contributed to a component and returns CSS emitted once after the
  component's rules, outside its cascade layer (not under `inline`).

- **Tailwind's `output: 'styles'` writes shadows the way Tailwind does.**
  `shadow-md` sets `--tw-shadow` and a `box-shadow` composed from it and the
  ring properties, where it used to set `box-shadow` alone, so it combines
  with a ring on the same node. The shadow still draws without any reset.
  With `convertStyles: true`, a `box-shadow` on the scale still becomes its
  `shadow-*` utility.

- **Legacy Svelte passes a root's events to the component it renders as
  props.** On a root whose tag may be a component, the component branch
  writes the template's events as composed `on*` props
  (`onclick={composeEventHandlers($$restProps.onclick, toggle)}`) instead of
  `on:` directives. The component you pass must spread its rest props onto an
  element, as a passthrough component does, or declare the `on*` prop. A
  Svelte 4 style component that forwards `on:click` without either received
  the event before and doesn't now. A legacy consumer passes its own handler
  as a prop too, `onclick={...}`, to have it run first: `on:click` on the
  component reaches neither branch.
- **A consumer's handler runs first, and can cancel the template's.** Where a
  template's event meets a consumer's handler for the same event - on a
  passthrough root, on an element that routes the consumer's attributes, or
  on a node that spreads `rest` - the consumer's handler runs first, and the
  template's runs only if the consumer did not call
  `event.preventDefault()`. That lets a consumer stop a switch from toggling
  or a tab from activating, as headless component libraries do. An event
  value without `defaultPrevented`, such as a component's event payload,
  always runs the template's handler. React and Svelte runes mode compose
  the two through `composeEventHandlers(consumerHandler, templateHandler)`,
  which is generic over the event, so an inline template handler keeps the
  element's event type (`KeyboardEvent<HTMLDivElement>`) and a misspelled
  member fails the type check. Vue binds the template's listener after the
  consumer's attributes, through a generated
  `(...args) => unlessDefaultPrevented(handler, ...args)` that hands on every
  argument the listener receives; a `capture` listener composes with the
  consumer's `onClickCapture`. On such a listener Vue applies `prevent`,
  `stop`, `self` and `once` in generated code after the check, so `.prevent`
  no longer cancels the template's own handler and a one-shot listener is
  used up only when the template's handler runs, claimed per element through
  a generated `claimOnceListener`. Svelte runes mode does not attach such a binding
  with `{@attach}`, which would run before the consumer's handler: a
  `passive` one composes as an ordinary, non-passive event attribute, and a
  `once` one merged with a same-name event keeps its one-shot state inside
  the merged handler. `touchstart` and `touchmove` stay passive, as Svelte
  attaches them by default, so a consumer's `preventDefault()` on them has no
  effect. In both Vue and Svelte runes mode a key-guarded `once` checks its
  key first, so another key leaves it armed. On a component tag Vue shares a
  composing `.once` per component instance. Vue and Svelte runes mode used to run the template's
  handler first. Legacy Svelte's `on:` directives still attach beside the
  spread, so there a consumer's handler is not ordered first and cannot
  cancel the template's.

- **A generated modifier wrapper calls a named handler optionally.** React's
  wrapper for `prevent`, `stop`, `self` or a key guard, Svelte's in both
  modes and Vue's on a composing listener used to call a handler given by
  name or as an expression with `handler(event)`, which threw, and failed a
  strict type check, for an unset optional handler prop. They now call it
  through a generated `invokeHandler(handler, event)` helper, which does
  nothing for an unset handler and infers the arguments from the listener,
  so a handler typed `() => void` type-checks too, and binds a method named
  by a path to its object, `handlers.save?.bind(handlers)`, so `this` holds; a function literal is
  called as before. Svelte runes' generated `once` helper takes an unset
  handler too, and Vue's merged same-name handlers and key-guarded bindings
  go through the same helper.

- **Validation reports every violation in one run.** `validateTemplate` and
  `process()` used to stop at a template's first broken rule. They now go on
  through the whole template and throw one `TemplateError`: a single
  violation as before, several listed one per line under a count, each with
  its message and node path on the error's `errors`. The CLI prints each one
  on its own line under `render` and `validate`.

- **A class shared by two conditional entries applies under either
  condition.** A variant map written as one `conditionalAttributes` entry per
  variant lost a class two variants share, such as `shadow-xs`, from the
  later variant in every target, because conditional classes were
  deduplicated against each other. A conditional class is now dropped only
  when a static or styling-extension class already carries it; a class
  repeated across entries is written once and applies whenever any of its
  conditions holds (`(variant === 'outline') || (variant === 'secondary')`).
  A BEM runtime-mode modifier repeated across entries joins its conditions
  the same way.

- **A styling extension's class comes first among an element's attributes,**
  where hand-written markup puts it, in every target: `<input
  class="Checkbox__input" type="checkbox">` rather than after the other
  attributes. A literal `class` the template places elsewhere keeps its
  place, and a class made only of conditional classes leads the authored
  attributes too.

- **React and Vue components export their props interface.** A component with
  declared props now emits `export interface ButtonProps` where it emitted
  `interface ButtonProps`, and a React component whose only props are its
  passthrough surface, or whose props are a discriminated union, emits
  `export type ButtonProps = ...`. A module that
  re-exports the component with `export *` then carries its props type, so a
  consumer writes `import type { ButtonProps } from './Button'` instead of
  deriving it. Svelte components type their props inline and are unchanged.
- **A passthrough root's declared props keep their own type.** React's props
  extend `Omit<ComponentPropsWithRef<tag>, declared and slot names>` and
  Svelte runes' `Omit<SvelteHTMLElements[tag], ...>`, so a declared
  `onChange(value: string)` or `value` no longer intersects with the native
  attribute into a type no consumer can satisfy. A component without a default
  slot no longer accepts `children` on the surface either.
- **A Vue passthrough or `rest` component types the attributes it hands on.**
  The props interface extends the element's attributes, without the declared
  names, behind `@vue-ignore`: `export interface TextInputProps extends /*
  @vue-ignore */ Omit<IntrinsicElementAttributes['input'], 'value' |
  'onChange'>`. A consumer's `disabled`, `name` or `@blur` type-checks under
  `strictTemplates`, and the runtime props list is unchanged. A component
  whose root is one of several elements extends each element's attributes.
  The interface also admits any `data-*` attribute, so a consumer's
  `<TextInput data-testid="email">` type-checks without a `dataAttributes`
  setting. On an `<input>` root, `autocomplete` is taken out of the inherited
  attributes and typed as a string, through `Partial<Record<'autocomplete',
  string>>`: Vue types it as a union of every autofill token, too complex for
  `defineProps` to infer the props through. A declared `autocomplete` prop
  keeps its own type.
- **Svelte types and binds a passthrough root by its element.** `element` is
  typed after the root's element in both modes
  (`HTMLElementTagNameMap['input']`, `SVGElementTagNameMap['svg']`, the branch
  union on a discriminated root), and the runes rest surface follows React's
  per tag. On a `componentValued` root the component arm no longer binds
  `bind:this`, which held the component instance: `element` holds the DOM node
  while a string tag renders and is `undefined` while a component does.
- **React composes a template's handler with the consumer's on a passthrough
  root.** A template event whose handler is not the same-name declared prop
  used to overwrite the consumer's handler for that event; it now composes
  with it through a generated `composeEventHandlers` helper, the consumer's
  first (see "A consumer's handler runs first"), and attaches nothing when
  neither side supplies a handler, so a server component can render the
  element. An inline template handler keeps the element's event type. A
  template whose handler depends on an optional prop writes the handler in
  its conditional form, `onChange ? (event) => onChange(event) : undefined`,
  through a React `events` override, so the composed handler is `undefined`
  while the prop is unset, and keeps the plain arrow for the other targets.
- **React types a CSS custom property without augmenting React.** A style
  object with a `--*` key used to come with a `declare module 'react'` block
  that widened `CSSProperties` in every project importing the component. The
  style is now written as `({ ... } satisfies StyleWithCustomProperties) as
  CSSProperties`, with the type declared in the file: standard properties are
  still checked, and nothing leaks into the consumer's types. A project whose
  own style objects relied on the old widening now gets a type error on a
  `--*` key; declare it where the project wants it:
  ``declare module 'react' { interface CSSProperties { [key: `--${string}`]:
  string | number | undefined } }``, or type the object the same way the
  component does.
- **A spread of exactly `rest` onto a node with its own class or style warns**
  in React and Svelte, where the authored class or style would replace the
  consumer's; Vue merges the two and never warns. A node whose class override
  for the target reads the consumer's class (`rest.className` in React,
  `rest.class` in Svelte), or whose style override reads `rest.style`, keeps
  it and is not warned about either. A helper call is not inspected.
- **A discriminated surface root's discriminant is validated.** Each `if` and
  `else-if` condition is declared in branch `props`, never among the shared
  props, and is a literal discriminant (the bare prop name, typed as truthy
  literals such as `true` in its branch and falsy ones such as `false` after
  it) or a presence test written `href !== undefined` (see Added). A bare
  name of another type (`href` on a `string`, which tests truthiness), a
  loose `href != null`, a compound condition, a shared discriminant or a
  literal a later branch could also match used to render, then emit React
  whose props union didn't narrow; each is now a validation error, reported
  at the branch whose condition it is. For a bare name or `!= null`, the
  error suggests `href !== undefined`, literal `true`/`false` types for a
  prop with a boolean member, or dropping the falsy member of a literal
  union such as `'a' | ''`. For a chain of more than two branches, give each
  branch a boolean discriminant of its own.
- **React's in-file stylesheet constant is `componentStyles`.** It was
  `styles`, which a prop of that name shadowed; `styles` is free as a prop
  name now.
- **A name the generated component declares itself is a validation error.**
  A prop named `bem` on a component using the BEM runtime declared `bem`
  twice in React and Vue. No prop, slot, `slotScope` entry or loop `item` or
  `index` may now take a name a scripted target declares in the component:
  `props`, `componentStyles`, `bem`, `useBem`, `createBem`, `Fragment`,
  `RootTag`, `Tag` (and `Tag2`, `Tag3`, ...), `authoredOrConsumer`,
  `composeEventHandlers`, `consumerAttributes`, `routedRest`,
  `surfaceProperties`, `definedProperties`, `unlessDefaultPrevented`,
  `usedOnceListeners`, `claimOnceListener`, `useAttrs`,
  `serializeStyleObject`, `consumerStyleValue` and `restProperties`. `once` and `on` are taken only
  in a component whose events use the `once` or `passive` modifier,
  `onceRan` where one uses `once`, `listenerElement` where one uses
  `passive` or `once`, and
  `rest` only on a passthrough component. Two props whose names Vue would
  declare under one key, such as `aria-pressed` and `ariaPressed`, are an
  error too. The error names the binding the
  name clashes with. The engine's own names (`bem`, `RootTag`, `Tag`,
  `authoredOrConsumer`, `authoredAndConsumer`, `composeEventHandlers`,
  `consumerAttributes`, `invokeHandler`) are taken in every build; a name
  only one target's output declares, such as React's `props` or Svelte's
  `restProperties`, is taken in a build that includes that target (see "A
  name a target's output generates is reserved" under Added). The scaffolder
  and the CLI reserve every scripted target's names, so a kit builds the
  same for all of them.
- **`ResolvedStylingOptions` has `placement` and `sassImporters`.** Both are
  required fields of the resolved options a target extension's `render`
  receives. An extension of your own that builds `ResolvedProcessingOptions`
  by hand, in its tests say, fills them in: `placement` with a
  `StylesheetPlacement` and `sassImporters` with an array, empty when none.
- **A scripted target's build warns about a component it can't find.** A capitalized
  tag that no import, `script` declaration, prop or binding of the component
  names failed only when the generated file was compiled. React, Vue and
  Svelte builds now warn, naming the tag and the target, so a missing import
  of a composed component shows at build time. Vue's warning allows for a
  component registered globally, such as `RouterLink`; importing it through
  `extensions.vue.imports` quiets the warning. Vue's own components
  (`Transition`, `Teleport`, `KeepAlive` and the rest) need no import, and
  HTML output, which writes a reference as a comment, doesn't warn.
- **A key a node doesn't take is a validation error.** `style` written
  beside `tag` instead of inside `attributes` passed validation and the CSS
  was dropped without a word. A key an element, text, comment, fragment,
  slot, conditional, iteration or component node doesn't take, or one on a
  conditional branch, a `conditionalAttributes` entry, an event, a named
  slot, a dynamic tag, a prop definition or a `bindable` object, is now an
  error naming its path, and for a key in the wrong place it says where the
  key goes (`attributes` for `style`, the dynamic tag object for
  `componentValued`, `fallback` for a slot's `children`). The JSON
  Schema already rejected these keys. `defineTemplate` reports them too, as a
  type error at the key, in the objects written in place at any depth; a node
  held in a value typed as the whole `TemplateNode` union, and an array that
  mixes one in, are left to validation. What an element's or the
  component's `extensions` block holds stays open, and `html` is reserved
  there: it names the HTML output, not an extension.
- **An unknown event modifier is a validation error.** `modifiers: ['prevent',
  'home']` validated, then React and Vue prevented every key and Svelte
  didn't compile. A modifier must now be `prevent`, `stop`, `once`, `self`,
  `capture`, `passive` or one of the key guards, on the node and in an
  extension override's `events`; the error names the modifier and lists the
  supported ones. Guard any other key inside the handler.
- **A slot named `default` is a validation error, declared or filled.** React
  read a `default` slot as a `default` prop and dropped the children, and
  Svelte refused the name. The default slot is the one without a `name`, and
  a component reference fills it through its children (with `slotScope` for a
  scoped one), not through a `default` key in `slots`; each error says so.
- **A `conditionalAttributes` style needs a class in the same entry.** The
  style renders as the stylesheet rule of the entry's first class, which the
  condition toggles, so a style with no class had no selector and every
  target dropped it without a word. Such an entry is now a validation error.
- **HTML output is an annotated reference with no script.** It is markup to
  copy into any framework, server template or static page, and everything
  plain HTML cannot express is now written as a comment where it sits: slots
  (`<!-- slot: icon -->`), component references and the content projected
  into them (`<!-- component: Row size="small" -->`), events
  (`<!-- on click (prevent): save -->`), conditional attributes and the
  modifier classes they carry (`<!-- if open: class="dialog--open" -->`),
  spreads, a passthrough root and a dynamic tag. A bound `value` on a
  `<select>` is a comment on each option saying when it is selected.
  Loop comments name the index
  and key, and text inside a comment is escaped so it cannot end the comment.
  These used to be dropped, some with a warning and some silently, and a
  component reference rendered as a literal `<Row>` tag. The `<script>` block,
  the separate `.js` or `.ts` file, `on*` attributes and the `data-jte-node`
  markers that only events needed are gone; `data-jte-node` stays where a
  style needs a selector.
- **Optional props are typed `?: T | undefined`** in the generated props of
  every target: React's props interface or type (polymorphic and
  discriminated surfaces included), Vue's `defineProps` interface, and the
  Svelte runes `Props`, along with its `class`, `style`, `element` and
  snippet props. A consumer compiling with `exactOptionalPropertyTypes` can
  pass `undefined` explicitly, as it does when it forwards an optional prop
  of its own (`<Frame border={border}>`). A type that already admits
  `undefined`, `any` and `unknown` included, is kept as written (`as?: any`),
  and a function type is wrapped first:
  `onChange?: ((value: string) => void) | undefined`. In Vue such a member
  is declared to the runtime without a type check, so only Vue's
  development-mode prop type warning goes; a boolean keeps its casting.

### Deprecated

- **`styling.outputStrategy`**, read as `styling.placement` with a warning;
  passed beside a different `placement`, it is an error. The
  `OutputStrategy` type from `@js-template-engine/types`, a target extension's `unsupportedStrategies.styling`
  and the CLI's `--styling-strategy` flag go with it, as do the CLI's
  `RenderCommandOptions.stylingStrategy`. All are removed in 3.0.0.

- **`FrameworkExtension`, `kind: 'framework'` and `isFrameworkExtension`**,
  in favor of the target names. An
  extension of your own declaring `kind: 'framework'` keeps working through
  2.x. The CLI's `--framework` flag, `frameworkNames`, `FrameworkName` and
  `RenderCommandOptions.framework` are read as their target counterparts,
  the flag with a warning. All are removed in 3.0.0.

- **`parenthesizeClassExpression`** from `@js-template-engine/core`. No
  scripted target embeds a class expression in a guard that repeats it any
  more, so nothing calls it; it is removed in 3.0.0.

- **The `scripting` option.** It has no effect, since no output contains a
  script for it to place, and passing it adds a warning. The same goes for
  the CLI's `--scripting-strategy` and `--scripting-language` flags and a
  kit's `scriptingStrategy` and `scriptingLanguage` keys, which print one
  warning per run. A target extension's `unsupportedStrategies.scripting`
  and the third parameter of `planTargets` are ignored. All of them are
  removed in 3.0.0.

- **`normalizeSlotName` from `@js-template-engine/extension-react`.** Import
  it from `@js-template-engine/core/emitter`; the extension's export is
  removed in 3.0.0.

### Fixed

- **A slot named like a DOM property no longer breaks legacy Svelte in a
  Svelte 5 consumer.** A snippet filling a named slot reaches the component
  as a prop of the slot's name, and it was spread onto a passthrough root:
  `title` got the function's source, and a development build threw
  `snippet_without_render_tag`. The spread now leaves slot content out. A
  `title` attribute a consumer passes still reaches the element.
- **A `defaultValue` list on a `multiple` select selects its options in Vue
  and Svelte.** A list was compared with each option, so none matched: server
  render, submission and hydration all came up empty.
- **A scope binding called `name` works.** On Vue's `<slot>`, `:name` replaced
  the slot's own name, and legacy Svelte's output would not compile. Both now
  pass the binding so a consumer reads it under `name`.
- **A selector that cannot match an element without a class warns.** `&--brand`
  on an element with no class wrote a rule matching nothing and said nothing;
  it now warns, and the `#{...}` warning no longer suggests the `scss`
  language for such an element, where Sass would stop instead.
- **Vue keeps a space its compiler would remove.** A text node holding only
  whitespace at the start or end of an element's, a conditional branch's, a
  slot's or a component's content, or beside a comment, was removed by Vue's
  whitespace condensing, so `Change` and a name beside it ran together for a
  screen reader. Vue now writes it as `{{ ' ' }}`.
- **A Vue select with a `value` shows its option before hydration.** Vue's
  server render wrote the value as an attribute of the `<select>`, which
  browsers ignore, so a page showed the first option. Each option is now
  marked `selected` when it matches. The client's selection still follows
  the value; a `form.reset()` now returns to the bound option.
- **A Vue `multiple` select bound to a list selects its options.** Vue wrote
  the list as one string, which matched no option, so nothing was selected on
  the client. Each option now binds its `selected` property from the list.
- **Svelte output no longer fails svelte-check on a comparison.** A bound
  `indeterminate` no longer adds `?? false` after a comparison, a negation, a
  boolean literal or a `Boolean(...)` call, which TypeScript reports as an
  unreachable right operand.
- **The rest-class warning recognizes `consumerClass(rest)`** and
  `mergeRootProps(..., rest)` in a class override, and suggests `consumerClass`
  first.
- **The `unwrap` warning names what to write instead:** a fragment with a
  per-target `tag`.
- **A selector holding Sass interpolation warns when no Sass compile reads
  it.** Under the `css` styling language a selector still holding `#{...}`
  reaches the stylesheet as written and matches nothing.
- **A cascade layer order comes first in a compiled SCSS stylesheet.** Under
  `scss` the order statement came after what the stylesheet's `@use`d modules
  emitted, so a module emitting rules inside one of the layers declared that
  layer first and reversed the cascade. Each separate-file stylesheet, and
  the style block a Vue or Svelte component file keeps, now loads the
  generated `_layer-order.scss` ahead of its other loads, without a
  namespace, so a module of the kit's own named `layer-order` loads beside
  it. Under `css` the statement still precedes the wrapper. Core exports
  `layerOrderModuleFiles`, which returns the module for the styles that
  load it.

- **Content of `<pre>` and `<textarea>` keeps a leading line break.** The
  html, Vue and Svelte output write a second line break ahead of content that
  begins with one, since a browser and Vue's compiler drop the first;
  `renderInstance` does the same for an evaluated `defaultValue`. React
  writes static text holding a line break inside either element as a string
  expression, where JSX text would trim it across the break.

- **Escaping in Vue and Svelte output.** A Vue interpolation whose expression
  holds two adjacent closing braces is written so Vue reads all of it; a
  comment containing `-->` is escaped in Vue and Svelte, as in html; and a
  static Svelte attribute value containing `{` is written `&#123;` in both
  modes.

- **React typing and composition.** A whole-object `style` literal declaring
  a `--*` property is checked against `StyleWithCustomProperties`, so the file
  type-checks; a template `react` import with a default or namespace binding
  stays as written, and the generated import leaves out the members it already
  binds; a hyphenated event on a passthrough root or a `rest` node renders its
  handler alone, where reading `rest.onMy-event` threw at render.

- **`class: null` removes every class a node renders**, the ones its
  `conditionalAttributes` entries add and a folded BEM runtime modifier
  included; an entry's other attributes stay under their condition.

- **`styling.layer` is validated.** A bare string or an object without a
  `name` is a processing error, where it emitted `@layer undefined`.

- **Generated Svelte event wrappers on a dynamic tag type their event.** In
  legacy mode a key guard or a `prevent`, `stop` or `self` wrapper on a
  `<svelte:element>` or a component-valued root annotates `event` with its
  DOM event type, so the component passes `svelte-check`.

- **A Vue optional or two-way `aria-*` prop type-checks in either
  spelling.** A consumer may write `aria-pressed` or `ariaPressed` on a
  component that declares the prop, under `strictTemplates`. A required
  `aria-*` prop is satisfied by the camelized spelling, `ariaLabel="Close"`.

- **Tailwind's `output: 'styles'` tells a Tailwind v4 name it leaves out
  from a typo.** Variants and utilities Tailwind v4 defines but the
  conversion doesn't cover, such as `nth-3:`, `*:`, `starting:`,
  `forced-colors:`, `@md:` and the other container queries, `@container`,
  `scheme-dark`, `float-left` and `text-shadow-sm`,
  used to be reported as unknown. Their error now says they are outside
  the supported conversion subset.

- **An `events` override that leaves out an event the element declares
  warns.** The override replaces the element's whole event list in its
  target, so an override giving React's controlled input `change` for
  `input` also dropped the input's `keydown` and `blur` there, silently.
  The build now names each event left out, and says how to replace one. An
  override event of another name counts as a left-out event's replacement
  when it takes the same handler, and `change` counts as `input`'s
  replacement whatever its handler reads, in every target (outside React,
  `change` fires on commit). An empty list still drops the
  events without a warning.

- **A prop default that is an expression, or not a value of its type, is a
  validation error.** A default is a literal the targets write as the
  prop's fallback, so `default: { $expression: '...' }` used to come out as
  an object literal typed as the prop's type. Validation now rejects it,
  pointing to a fallback written where the value is read or a `derived`
  value. A default that is not a value of a type built from `string`,
  `number`, `boolean`, `null` and literals (`'lg'` for `'sm' | 'md'`) is
  rejected too.

- **Two nodes sharing a class get its rule once, and warn when they style
  it differently.** Column and row headers that are both `table__header`
  with the same style repeated the rule in the stylesheet. Identical rules,
  declarations in any order, are now emitted once, at the last one's place.
  When two nodes give one selector different declarations, each node's
  rule styles the other too, and the build warns. A rule only one node has
  warns too when it can also match the other node, such as `&:first-child`
  or `&:hover` on one of the two headers: its selector names no class the
  other node lacks. A rule keyed on a modifier only that node carries is no
  conflict. So does the shared class inside `@media` on one of two nodes
  that both style it. Each warning names both nodes by their tag, classes and other
  attributes (`<th class="table__header" scope="row">`), and by their path.

- **Each selector in a comma-separated style key collapses on its own.** A
  key such as `'&.table__cell--numeric, &.table__header--numeric'` was
  collapsed by its first selector only, so it dropped the base class from
  every selector in the list or from none. Each selector now collapses only
  when it is the node's own modifier. A selector naming a modifier of
  another element of the node's block is dropped, since no node of that
  element carries it: a style object shared by `table__cell` and
  `table__header` nodes gives `.table__cell--numeric` on one and
  `.table__header--numeric` on the other, and no
  `.table__cell.table__header--numeric`. A node whose class can come from
  elsewhere (a class expression, a target's `attributes` override)
  keeps the compound. Other selectors stay compound. An
  empty selector from a trailing comma is dropped, and a list nested in a
  list gives every combination in CSS output too. In a list where some
  selector holds `&`, a selector without one nests as a descendant, as in
  Sass (`'&:disabled, a.link'` gives `&:disabled, & a.link`), while a bare
  pseudo-class such as `:focus-visible` still attaches.

- **A Vue key-modified event with an unset handler does nothing instead of
  throwing.** Vue's key guard reads its handler while it renders, and where
  Vue's compiler doesn't wrap the handler itself (one reading a loop or slot
  variable, such as `option.onPick`, or one on a component) an unset handler
  threw. A handler given by name behind a key modifier now binds through the
  generated `invokeHandler` helper, `@keydown.enter="(...args) =>
  invokeHandler(option.onPick?.bind(option), ...args)"`, so the guard always receives a
  function and an unset handler does nothing. A handler that takes fewer
  arguments than the listener, such as `() => void`, still type-checks.

- **A consumer's `style` wins over the style of a node spreading `rest` in
  every target.** A node's expression-valued properties, such as
  `'--stack-gap': { $expression: 'gap' }`, beat the consumer's style: in
  React they replaced a consumer's `--stack-gap` that a style override
  merged in, in Svelte their `style:` directives outranked it, and the html target
  wrote them after it. A React style override whose expression reads
  `rest.style` beside such properties now gets the consumer's style last,
  `{ '--stack-gap': gap, ...rest.style }`, and reads it once: an object
  literal such as `{ ...styles, ...rest.style }` keeps its other members
  ahead of the properties, `{ ...styles, '--stack-gap': gap, ...rest.style }`. Each Svelte `style:` directive
  takes the consumer's value when the consumer's style declares the
  property, as on a passthrough root, a Svelte override's static inline
  declarations come before its expression carrying `rest.style`, and
  `renderInstance` merges the consumer's style after the node's own.
- **The warning about a `rest` node's own style fires only for a style that
  replaces the consumer's.** A static style the stylesheet carries leaves
  the element with no `style` attribute, and in Svelte an expression-valued
  property is a `style:` directive that keeps the consumer's style, yet both
  were warned about. The class check reads the target's class override as
  the style check reads its style override, so an override class that
  leaves out the consumer's is warned about too. A node's class and style
  warnings now come in the same build, so fixing one no longer reveals the
  other.
- **A Svelte style override that hands `rest.style` on as a string is not
  warned about.** The warning about a spread or `Object.assign` breaking the
  consumer's style string fired whenever `Object.assign` and `rest.style`
  appeared in the same expression. It now fires for a spread of
  `rest.style` or for `rest.style` passed to `Object.assign` as an argument
  of its own, cast with `as` or `satisfies`, in parentheses or as either arm
  of a conditional included, and not for one inside an array entry or a
  parser call.
- **A generated setter's locals never shadow a declared prop.** A second
  two-way prop's setter declared `const value`, hiding a `value` prop beside
  it, which a `no-shadow` lint rule rejects. Each name is now chosen on its
  own: the parameter is `nextValue` when the component declares a prop named
  `next`, and the local `updated` when it declares one named `value`.
- **Svelte's element branch of a `componentValued` root type-checks with a
  static attribute.** With `as` typed `any`, the `<svelte:element>` branch
  typed its attributes as no particular tag's, so `type="button"` failed
  `svelte-check`. The branch now reads its tag as an HTML tag name,
  `this={RootTag as keyof HTMLElementTagNameMap}`, so its attributes check
  against the HTML elements' attributes, an `href` beside a `type` included,
  and a value of the wrong type still fails.
- **Tailwind's `output: 'styles'` matches Tailwind on a few more
  utilities.** A bracketed `aria-*` or `data-*` variant whose body doesn't
  open with the attribute's name, such as `data-[a_b]:`, is reported
  instead of writing an invalid selector, as Tailwind writes none.
  `shadow-inner` and the `open:` variant (`group-open:`, `peer-open:`)
  convert, and the leading `!` (`hover:!p-1`) is read as `!important`
  like the trailing one.

- **React writes `focusin` and `focusout` as `onFocus` and `onBlur`.** They
  rendered as `onFocusin` and `onFocusout`, props React doesn't have, so the
  handler never ran. React's `onFocus` and `onBlur` listen for those bubbling
  events, so they map there now. Every DOM event React has a prop for maps to
  it, including the props React declares for one element (`onClose` and
  `onCancel` on `<dialog>`, `onResize` on `<video>`). An event name React has
  no prop for, on an HTML or SVG element, now emits a warning naming the event
  and the tag instead of rendering silently, as does a capture binding React
  attaches but doesn't type.
- **Legacy Svelte runs a template's event when a root that may be a component
  renders one.** On a `componentValued` root, the component branch wrote the
  template's events as `on:` directives, which a component only receives when
  it forwards them, so `<PopoverTrigger as={Button}>` never ran its click
  handler. The component branch now passes them as event props composed with
  the consumer's handlers (`onclick={composeEventHandlers($$restProps.onclick,
  toggle)}`), as runes mode does. The consumer's handler runs first, and
  `event.preventDefault()` in it skips the template's.
- **A consumer's `style` wins over a passthrough root's own declarations in
  Svelte and the html target, as in React and Vue.** Svelte wrote the root's
  expression-valued style properties as `style:` directives, which outrank
  the `style` attribute carrying the consumer's string, so a consumer's
  `--checkbox-color` lost to the component's. Each such directive now takes
  the consumer's value when the consumer's style declares the property,
  `style:--checkbox-color={consumerStyleValue(style, '--checkbox-color') ??
  color}`, so styles set on the element by an action stay in place when a
  prop changes. `renderInstance` put the consumer's style first; it now
  merges it after the root's own.
- **A consumer's `style` wins over the style of a Vue node spreading
  `rest`.** The node's own `:style` and `:class` bound after `v-bind="rest"`,
  so its declarations replaced the consumer's. They now bind before it: the
  node's own class still comes first, and the consumer's style wins per
  property.
- **A Svelte style override can read `rest.style`.** A consumer's `style` is
  a string in Svelte, and the generated style serializer read it as an
  object, writing `0: c; 1: o; ...`. The serializer now passes a string
  through and serializes an array entry by entry, so `rest.style` works
  alone, and `[{ gap }, rest.style]` keeps the node's own declarations under
  the consumer's. A Svelte override that spreads `rest.style` or passes it
  to `Object.assign` is now warned about, naming the array form.
- **`{ ...rest.style }` in a React style override counts as reading the
  consumer's style.** A node spreading `rest` with a style of its own still
  warned when its override spread `rest.style` into the object; only
  `Object.assign(..., rest.style)` silenced it.
- **The HTML comment on a passthrough root that routes attributes names what
  stays on it.** Under a `'*'` routing it said the consumer's other
  attributes apply on the root, when only class, style and `data-*` do. It
  now reads `the consumer's class, style and data-* apply here, the rest on
  the <input>`, and with a routing list it names the routed element too.
- **Tailwind's `output: 'styles'` orders converted rules as Tailwind does.**
  Rules followed class order, and a stacked `dark:` utility joined the first
  `dark:` block, so `dark:hover:bg-indigo-500` (or `dark:focus-visible:`,
  `dark:data-[featured=true]:`) came before the plain `hover:` rule and lost
  to it in dark mode, where Tailwind's own stylesheet lets it win. Converted
  rules now follow Tailwind's variant order whatever the class order:
  `hover:` before `focus:` before `aria-*` and `data-*`, the breakpoints
  smallest first, then `dark:`, and a stacked rule after each of its
  variants alone. A template now renders alike with `output: 'classes'` and
  `output: 'styles'`, except between utilities with the same variants that
  set the same or overlapping properties (`p-2 px-4`). Utilities with the
  same variants keep their declared order, and the later of two
  overlapping ones now wins: `px-4 p-2 px-8` ends with `padding-inline`
  last, where `padding` used to win. Converted CSS can come out in a different order than before, and a
  stacked rule that cannot join an earlier block without moving ahead of
  another rule is emitted as a second rule for the same selector.

- **Tailwind's `output: 'styles'` refuses sizing utilities Tailwind does not
  define.** `max-w-auto` and `max-h-auto` wrote `max-width: auto`, which is
  not valid CSS, and `basis-min`, `basis-max` and `basis-fit` converted
  though Tailwind gives them no CSS. Each is now reported as an unsupported
  value, as other utilities outside the supported subset are.

- **An expression that reads a browser global works in Vue.** A Vue template
  sees only a short list of globals, such as `Math`, `Date` and `JSON`, so a
  handler calling `document.getElementById(...)`, or a binding reading
  `navigator.language`, built and compiled cleanly and then threw in Vue
  alone. The Vue component now declares each browser global its template
  reads in `<script setup>`, `const document = globalThis.document;`, and the
  template reads it as written. A window function such as `setTimeout` is
  declared bound to the window, so it works in Vite's development server
  too. A prop, a script declaration or a loop
  variable of the same name is not a global and keeps its meaning. A global
  whose value changes with the page, such as `scrollY` or `innerWidth`, is
  not declared: the build warns and names the form that works,
  `window.scrollY`.
- **Vue components type-check under strict vue-tsc in two more shapes.** A
  passthrough root that routes attributes to an inner element, on a
  component with a description or type parameters, failed with `TS1184:
  Modifiers cannot appear here`; its `<Name>RoutedKeys` type is now exported
  beside the props interface. A listener composing with the consumer's on a
  dynamic root tag (`<component :is>`), which Vue gives no event type,
  failed with `TS7019`; its parameters are now typed there, while on any
  other element the element's event still types an inline handler.
- **A double quote in an expression type-checks in Vue.** A bound attribute,
  class, style, event handler or condition whose expression held a
  double-quoted string reached the Vue template as `&quot;`, which Vue
  compiles but vue-tsc rejects (`TS1003: Identifier expected`). Vue now writes
  such an expression in single quotes (`:aria-label='open ? "Close" :
  "Open"'`), and one holding both kinds of quote with its double-quoted
  strings rewritten single-quoted. Only a `"` outside any string, in a
  regular expression or a comment, is still written `&quot;`.
- **React imports from `react` once.** A template's own `import { ... } from
  'react'` lines were written below the import the component generates from
  `react`. They now join it, each member keeping its `type` modifier
  (`import { type ReactNode, createContext } from 'react';`). An import with a
  default or namespace binding, or a comment, stays as written.
- **A Svelte root whose tag may be a component takes conditional classes.** A
  `componentValued` root with `conditionalAttributes` classes failed the
  Svelte build in both modes, because the component arm can't take a
  `class:` directive. Its conditional classes now join the `class` attribute
  on both arms (`class="button{variant === 'solid' ? ' button--solid' :
  ''}"`), as React and Vue already rendered them.
- **Tailwind's `output: 'styles'` keeps your style keys in the order you
  wrote them.** A hand-written nested style block that shared its selector
  with a converted utility, such as a dark block beside a `dark:` utility,
  was emitted with the converted utilities, ahead of style keys written
  before it, so a later dark override lost the cascade. A hand-written
  declaration could also land before a converted shorthand and lose to it.
  The converted CSS now keeps its own order, your styles keep
  the order you wrote them in, and each of your declarations comes after
  any converted one it overrides. Where merging a block would break that
  order, your block is emitted as a second rule for the same selector.
- **A function parameter named like a slot reads the parameter.** Beside a
  slot named `option`, `options.find((option) => option.value)` had its
  parameter rewritten to the slot's presence check in React, Vue and legacy
  Svelte, which did not parse. A name an expression binds itself (an arrow or
  `function` parameter, plain, destructured, defaulted or rest, a `catch`
  binding, or a `const`, `let` or `function` in a block body) now keeps its
  meaning inside its own scope, and the slot is read everywhere else. An
  object key named like a slot stays a key, and a shorthand property
  (`{ option }`) keeps its key.
- **An event beside a `rest` spread keeps the consumer's handler.** A node
  that spreads `rest` and handles `click` replaced the consumer's `onClick` in
  React and Svelte runes mode. The template's handler and the consumer's now
  both run, the consumer's first, through the same `composeEventHandlers`
  helper a passthrough root uses. Vue, which already ran both, runs them in
  the same order (see "A consumer's handler runs first").
- **A Vue script can declare a name a prop has.** A script declaring `const
  value = computed(...)` beside a `value` prop failed vue-tsc, because the
  props destructure declared `value` as well. The prop is now left out of
  the destructure, so the script's binding keeps the name and the template
  reads it, as Vue reads a script binding over a prop; where a two-way
  value or a declared id reads the prop, it is destructured under an alias
  (`value: valueProp`).
- **React writes a numeric attribute given as a string as a number.**
  `tabindex: '0'` rendered `tabIndex="0"`, and `colspan`, `rowspan`,
  `maxlength`, `size` and `rows` the same, which a strict `tsc` rejects
  because React types those props as numbers. On an element, a numeric
  string for a prop React types as a number only now renders the number
  (`tabIndex={0}`, `colSpan={2}`), in `conditionalAttributes` too. Svelte
  writes the number inside a conditional attribute's expression, where
  svelte-check rejected the string.
- **A component's own `ref` no longer replaces the consumer's.** In React, a
  node that spreads `rest` and also takes a ref of the component's own
  dropped the consumer's `ref`, which stayed
  `null`. React now hands the element to both through a small generated
  `composeRefs` helper. A ref of the component's own on a passthrough root,
  which wrote two `ref` attributes and failed `tsc`, composes with the
  consumer's the same way.

- **A malformed props override failed with a TypeError.** `null`, `false` or
  any other non-object in a component's `extensions.vue.props` (or another
  target's) made `process()` throw a raw TypeError with no path. A prop
  definition must now be an object with a non-empty string `type`, wherever
  it is declared, and a component override's shared keys must have their
  shapes; anything else is a `TemplateError` naming its path, such as
  `extensions.vue.props.open`.

- **Tailwind's `output: 'styles'` reads an arbitrary value's type.**
  `text-[length:var(--size)]` wrote `color: length:var(--size)`,
  `bg-[length:...]` a background color, `text-[clamp(...)]` a color, and
  `w-[calc(100%-2rem)]` invalid CSS. A type hint now picks the property
  (`text-[length:...]` a font size, `bg-[length:...]` a background size,
  `border-[length:...]` a border width), an unhinted value is inferred as
  Tailwind infers it, a value with no inferable type such as a bare `var()`
  takes Tailwind's fallback (`text-[var(--ink)]` is a color), and math
  functions get spaces around their operators (`calc(100% - 2rem)`).
  Underscores stay as written inside `url()` and a `var()`'s property name,
  and the `bg-(--brand)` shorthand converts. Tailwind's theme functions
  (`theme()`, `--spacing()`), which need a Tailwind build, are processing
  errors.

- **A prop whose name isn't a valid variable name works in every target.**
  A prop named `aria-pressed`, `for` or `class` produced React that doesn't
  parse, a Vue component that never received a hyphenated prop and left out
  one without a default, and Svelte that doesn't compile. Each such prop now
  has one camel-cased alias that expressions read in every target:
  `aria-pressed` is `ariaPressed`, and a reserved word gains `Prop`, so `for`
  is `forProp` and `class` is `classProp`, with or without a default. A
  consumer still passes `aria-pressed` or `for`. Legacy Svelte can export a
  prop only under a plain name, so it rejects `aria-pressed` with an error
  that points to runes mode; reserved words work there too.
- **Svelte compiles a conditional class a directive cannot carry.** A
  conditional Tailwind utility such as `hover:bg-primary/90`,
  `data-[state=open]:bg-accent` or `has-[>svg]:px-3` was written as a
  `class:` directive, which Svelte rejects or reads wrong in both modes. Such
  a class now joins the `class` attribute as a guarded interpolation, while
  names a directive can carry stay directives.
- **A ternary class expression type-checks and is evaluated once.** A class
  `$expression` such as `on ? 'switch--on' : 'switch--off'` was written into
  React and Svelte twice, once as its own condition, which strict TypeScript
  rejects as always truthy. A class list carrying an expression other than a
  plain reference is now an array joined after its empty entries are
  dropped, so each expression is evaluated once and never stands as a
  condition.
- **A conditional class's condition keeps its meaning when it is a ternary.**
  A `conditionalAttributes` condition such as `open ? pressed : false` was
  written unparenthesized as the test of the generated ternary, which then
  read `open ? pressed : false ? ' ok' : ''`. A condition whose top level is
  a ternary, a comma, an arrow function or an assignment is now
  parenthesized wherever it gates a class.
- **Class names keep `&`, `>` and quotes as written.** A class such as
  `[&_svg:not([class*='size-'])]:size-4` was written with `&amp;`, `&gt;` or
  escaped quotes, so Tailwind's scanner, which reads the generated source,
  produced no CSS for it. Every target now writes class names verbatim:
  markup escapes only an `&` that would start a character reference and the
  delimiting quote, and a string literal takes a delimiter the names do not
  contain.

- **Two components' generated CSS no longer styles each other's elements.**
  An element that needs a selector but has no class is marked with
  `data-jte-node`, and the value was a counter that started at `0` in every
  component. React's `css`, Vue's unscoped `<style>` and HTML output's CSS
  apply to the whole page, so `[data-jte-node="0"]` from one component matched
  the first marked element of every other. The value is now the component's
  name and the counter, `data-jte-node="StatGrid-0"`, in the markup and the
  selector alike. A template without a component node uses the component name
  it is processed under (`Component` unless one is given). An instance render
  marks a component it renders inline under that component's name, and a
  template without a component node under the tag that references it; the
  preview's html source names such a template by its file, as the kit's
  build does.

- **A named slot read in an attribute expression is the slot.** An
  attribute's expression that names a declared named slot, such as
  `suffix !== undefined` or `describe(suffix)`, reads the slot in every
  target, as a condition does: React's prop, Vue's `$slots`, Svelte's
  `$$slots`, and in Svelte's runes mode the slot's prop even where a
  forwarded snippet of the same name would hide it. A loop item or index, or
  a `slotScope` binding, of the slot's name hides the slot inside its loop or
  scoped content, so `option.label` there reads the loop's `option`.

- **Vue and Svelte document a discriminated surface's branch props.** A prop
  only the branches declare carries its description and its declared or
  documented default in Vue's props interface and Svelte's props, as React's
  branches do, where every branch that declares it agrees. For the
  description, a branch that gives the prop a value speaks over one typing
  it `undefined`, so a link button's `href` keeps its description beside
  the button branch's "leave out" note, and a branch without a description
  doesn't object. A branch prop's
  declared default now applies in Vue and Svelte as it does in React.

- **A Vue component binding `defaultChecked` type-checks.** Vue's element
  types have no `defaultChecked`, `defaultValue` or `defaultSelected`, so a
  strict consumer's template check failed on them. An input's
  `defaultChecked` and `defaultValue` and an option's `defaultSelected` are
  now written as the attribute each one reflects (`:checked.attr`,
  `:value.attr`, `:selected.attr`), which means the same: the starting
  state. A `false` `defaultChecked` or `defaultSelected` leaves the
  attribute out, so the input starts unchecked. A textarea's `defaultValue`
  is now its text, `<textarea>{{ note }}</textarea>`, which the user's edits
  outlast as they do a browser's default.
- **HTML output writes default-value properties as markup does.** An input's
  `defaultChecked` and `defaultValue` were written as attributes of those
  names, which HTML doesn't have. An input's `defaultValue` is now its
  `value`, a textarea's its text, and a select's marks the matching option
  `selected`, a bound `value` beside it read first
  (`{{ value ?? defaultValue }}`). `defaultChecked` and an option's
  `defaultSelected` are the bare `checked` or `selected` attribute when
  `true`; bound to an expression, they
  are a comment before the element, `<!-- if defaultChecked: checked -->`.
  `renderInstance` also writes an option's `defaultSelected` as `selected`.
- **Svelte's server-rendered markup shows a control's default.** Svelte's
  server render left out `defaultChecked` and `defaultValue`, so a
  server-rendered checkbox or field started empty until the page hydrated.
  Svelte now writes an input's `defaultChecked` as `checked` and an input's
  or textarea's `defaultValue` as `value`, keeping the default beside it so
  a form reset still returns to it, and a bound `checked` or `value` beside
  the default reads it when unset (`checked={checked ?? defaultChecked}`).
- **A select's `defaultValue` preselects its option in Svelte and Vue.** A
  select has no default-value property, so the value was written as an
  attribute that selects nothing. The option it matches is now marked
  `selected`, by a comparison on each option where the values are bound.
- **An option's `defaultSelected` preselects it in React and Svelte.** React
  dropped it with a warning and a strict `tsc` rejected it, and Svelte wrote
  an attribute no browser reads. Svelte now writes `selected`. In React, a
  select whose preset options are its own takes a `defaultValue` that picks
  among them, `defaultValue={featured ? 'featured' : undefined}`; an option
  React can't reach that way, such as one in a loop, writes `selected`, which
  preselects it with React's development warning.
- **A modifier on a handler that takes no arguments type-checks.** A handler
  such as `() => choose(1)` with `prevent`, `stop`, `self` or a key modifier
  was called with the event in the generated React and Svelte wrapper,
  `(() => choose(1))(event)`, which a strict `tsc` rejects. A function literal
  that declares no parameters is now called without it, and a handler given
  by name typed with fewer parameters type-checks through the generated
  `invokeHandler`.
- **In Vue, a DOM property bound to an unset value stays unset.** A
  checkbox binding both `checked` and `defaultChecked` rendered unchecked in
  Vue when only `defaultChecked` was given: Vue wrote `checked = false`. On
  an element, `checked`, `value`, `selected`, `indeterminate` and `muted`
  are now bound through a small generated helper that leaves an `undefined`
  value out, so an unset binding stays unset, as in React and Svelte.
- **A `style` that is not a style object is an error.** `style:
  'padding-left: 2ch'` passed validation and every target read the string as
  an object of characters, writing a rule of `0: p; 1: a; ...`. A string,
  array or other non-object `style` is now rejected with the node's path.
- **An optional function prop in Svelte's legacy mode is optional.**
  `export let onChange: (value: string) => void | undefined = undefined`
  made the return type optional rather than the prop; a function or
  conditional type is now parenthesized before `| undefined` is added.
- **A React loop over an expression with an operator maps the whole
  expression.** `items: 'list.items ?? items'` emitted
  `list.items ?? items.map(...)`, which maps `items` alone; an items
  expression that is not a plain member chain is now parenthesized before
  `.map`.
- **Content inside a `<pre>` or `<textarea>` keeps exactly what the template
  says.** Generated markup indents every element's children, and Vue, Svelte
  and a browser keep all whitespace inside a literal `<pre>`, so a code block
  rendered with a leading newline and spaces. Such an element's content now
  renders with nothing added in Vue, Svelte and the html target; React already
  ignored it.
- **A Vue component's generated `data-jte-node` passes a strict type check.**
  A node whose styles need a generated selector carries the attribute, which
  Vue does not type, so `strictTemplates` rejected it. Such a component now
  declares that one attribute for Vue; no other `data-*` attribute on an
  element is widened.
- **A Vue passthrough root keeps its own attributes over a consumer's.** A
  consumer attribute such as `aria-label` replaced the root's in Vue only.
  The root now binds the consumer's attributes before its own, as React and
  Svelte do; `class` and `style` still merge, the root's own class first and
  the consumer's style winning.
- **An authored attribute with no value leaves the consumer's in place.** On
  a passthrough root, an attribute bound to an expression that resolves to
  `undefined` or `null`, such as `aria-labelledby` from an unset optional
  prop, removed the consumer's attribute of the same name. It now falls back
  to the consumer's value on every target.
- **A discriminated root's component script reaches React.** It was dropped;
  it now runs once at the top of the component, ahead of the branches.
- **Vue quotes a prop name that is not an identifier**, such as
  `onUpdate:modelValue`, so the props interface stays valid TypeScript.
- **Vue no longer repeats an attribute, which its compiler rejects.** Two
  same-name events with the same modifiers merge into one handler that runs
  both in declared order, and an element's spreads into one
  `v-bind="{ ...a, ...b }"`, a later key winning.
- **Vue calls a handler expression that yields a handler.** An expression
  that is neither a member path nor a function literal (`onSave ? (event) =>
  onSave(event) : undefined`) was compiled by Vue as a statement, creating the
  handler without calling it; it is now emitted as `(<handler>)?.($event)`.
- **A Vue component's script reads its props by name.** The props were
  declared with a bare `defineProps` call that bound nothing, so a script
  function reading a prop, as it does in React and Svelte, type-checked and
  then threw a `ReferenceError`. The props are now destructured from
  `defineProps` with their defaults inline (`const { label, variant =
  'primary' } = defineProps<ButtonProps>();`), which Vue 3.5 compiles to
  reactive reads of the live props.
- **A Vue array or object prop default is fresh per instance.** A default such
  as `features: []` was one value every instance of the component shared, so
  a change to it in one showed in all. Vue now creates it per instance.
- **A key modifier filters before `prevent` and `stop` in every target.** An
  event with `['prevent', 'enter']` called `preventDefault()` before checking
  the key in React and Svelte, so every key was prevented, while Vue's
  `@keydown.prevent.enter` prevents only Enter. React and both Svelte modes
  now check the key first, and the other modifiers apply only to the guarded
  key.
- **A Svelte directive override compiles on a passthrough root.** A directive
  such as `bind:value` authored as a Svelte attribute override on a
  passthrough root was wrapped in the `authoredOrConsumer(...)` fallback,
  which Svelte rejects. Directives are now written as authored; only
  attributes fall back to the consumer's value.
- **Svelte closes empty elements explicitly in both modes.** The legacy mode
  wrote a childless non-void element self-closed (`<span class="icon" />`),
  which Svelte 5 warns about. It now writes `<span class="icon"></span>`, as
  the runes mode does; void elements, components and `<svelte:element>` keep
  the self-closing form.
- **A React passthrough root without an authored class renders no empty
  class.** React wrote `className={className || ''}`, so a consumer that
  passed no class got `class=""`. The consumer's class is now bound as it
  is, `className={className}`, and an absent one renders no attribute.
- **A React scoped slot accepts plain content.** A slot that exposes
  bindings was typed and called as a render prop only, so
  `<Checkbox>Accept</Checkbox>` failed to type-check and crashed at runtime.
  The slot's prop is now `ReactNode | ((scope) => ReactNode)`, for the
  default slot and named slots alike: a function is called with the scope
  and any other content renders as it is, as in Vue and Svelte.
- **A bound boolean attribute reads as off in the HTML output.**
  `checked: { $expression: 'isChecked' }` was written as
  `checked="{{ isChecked }}"`, which a browser reads as checked whatever the
  value. Every HTML boolean attribute bound to an expression, such as
  `checked`, `selected`, `disabled`, `readonly`, `required`, `multiple`,
  `open` or `hidden`, on an element HTML makes it boolean on, is now an `if`
  comment before the element with the attribute left out (`<!-- if
  isChecked: checked -->`), in a loop too; in a `conditionalAttributes` entry
  the comment joins the entry's condition and the binding (`<!-- if strict &&
  !item.enabled: required -->`). A bound `checked` beside a bound
  `defaultChecked` is one comment, `<!-- if checked ?? defaultChecked:
  checked -->`. A custom element's attributes stay values.
  `renderInstance` now evaluates a bound value in a `conditionalAttributes`
  entry, which it used to leave out.
- **A malformed node is reported with its path.** A conditional written as
  `condition` and `then`, or a node missing its `children`, made validation
  throw "Cannot read properties of undefined" with no path. A node missing a
  field its type requires, or holding one of the wrong kind, such as a
  conditional's `conditions`, an element's `tag`, a fragment's or an
  iteration's `children` or an event's `name`, is now a `TemplateError`
  naming the field's path. A text node whose `content` is written as
  `{ $expression: 'label' }` is told to use `expression: 'label'` instead.
- **A declaration among a component's imports is shared by its instances
  in Vue and Svelte.** A declaration written on an `imports` line beside the
  import statements, such as an id counter, a context or a constant, was
  written into Vue's `<script setup>` and Svelte's instance script, so each
  instance created it again. Such declarations are now emitted at module
  scope, as in React: in Vue's plain `<script>` block, and in Svelte's module
  script (`<script context="module">`, or `<script module>` in runes mode).
  Import statements keep their place, and exported types stay exported.
  Code that needs props or instance state belongs in `script`.

## [2.2.1] - 2026-09-10

A patch release. Every existing output is byte-identical except where the fix
below names it.

### Fixed

- **A custom property name keeps its capital letters.** The style serializers
  (the extracted stylesheet, the Svelte `style:` directives and generated
  `serializeStyleObject` helper, the HTML `style` attribute) converted every
  capital in a property name to its kebab-case form, so a custom property such
  as `--kit-component--Badge--size` came out as `--kit-component---badge--size`.
  Custom property names are case-sensitive, so a name starting with `--` now
  passes through untouched; a camelCase property still converts.

## [2.2.0] - 2026-09-09

A minor release. Every change is additive and backward compatible with 2.1.0 -
existing templates render unchanged, and every existing output is byte-identical
unless a fix below names it. The additions bring a Svelte 5 runes dialect,
finer control over emitted stylesheets, and a component-valued root tag.

### Added

- **Svelte runes mode.** `svelte({ mode: 'runes' })` renders the same templates
  as Svelte 5 runes components: a typed `Props` interface destructured from
  `$props()`, snippet props rendered with `{@render}` in place of `<slot>` and
  `let:` (a scoped slot's exposes bundled into one object parameter, as in the
  React render-prop shape), `<name> !== undefined` slot presence, and `onevent`
  attributes with generated wrappers for the event modifiers. Same-name events
  merge into one handler in declared order. A file with no rune of its own opts
  in with `<svelte:options runes={true} />`. The default, `mode: 'legacy'`,
  emits the classic dialect exactly as before. The CLI gains `--svelte-mode`.
- **Stylesheet emitted without its link.** `styling.stylesheetLink: 'none'`
  emits the `separate-file` stylesheet and links it from nowhere: no `import` on
  React and Svelte, no `<style src>` block on a Vue SFC, no `<link>` in HTML
  mode. The default, `'component'`, keeps the link as before. Pairing `'none'`
  with a strategy that emits no separate stylesheet is an error. The CLI gains
  `--stylesheet-link`.
- **Cascade layers.** `styling.layer: { name, order? }` wraps emitted stylesheet
  rules in `@layer <name> { ... }` under every output strategy, so a component
  holds one cascade position however its styles are taken. `order` declares the
  full layer order ahead of the wrapper in every emitted stylesheet, because
  cascade order is fixed by first declaration and a per-component stylesheet may
  be the first one a consumer loads. Under `scss`, `@use` and `@forward` loads
  and a leading `@layer` statement are hoisted above the block. The CLI gains
  `--styling-layer` and `--styling-layer-order`.
- **Component-valued dynamic root tag.** A dynamic root `tag` whose expression
  may resolve to a component value (the polymorphic `as={Link}` pattern)
  declares `componentValued: true`. React and Vue accept both values as they
  are; Svelte, whose `<svelte:element>` renders tag names only, emits a `typeof`
  branch with a string arm and a component arm, with element-only custom
  property `style:` directives rewritten to the component form on the
  component arm.

### Changed

- **Slot-presence references resolve anywhere in an expression.** A reference
  to a declared named slot resolves to that slot's per-target presence form
  wherever it appears as a free identifier - bare, negated (`!icon`), or in a
  compound expression - and in attribute and class expressions as well as
  `conditional` conditions, including a `conditionalAttributes` condition
  folded into a runtime BEM call. A slot name inside a string literal or as a
  member-access tail is left untouched. Previously only a bare identifier in a
  `conditional` condition resolved.

### Fixed

- **Svelte runes composes a declared event with the passthrough spread.** On a
  passthrough root, a declared `events` binding was emitted as a plain
  attribute after the rest spread, so it overwrote a handler the consumer's
  spread carried for the same event, and erased it when the declared handler
  prop was unset. Both handlers now run in order, declared first, and no
  listener is attached when neither is supplied. Legacy mode was unaffected.
- **Svelte runes aliases a snippet prop shadowed by a same-named projection.**
  A component projecting its own named slot, with a fallback, into a composed
  child's slot of the same name emitted a `{#snippet}` that shadowed the
  destructured snippet prop, so the fallback guard tested the snippet itself
  and rendered it from within its own body. The prop now destructures under an
  alias and every generated reference reads it; the `Props` interface keeps
  the public name.
- **Vue emits the parity `undefined` default for boolean-containing union
  props.** An optional prop whose union type includes `boolean` or a literal
  `true`/`false` (`false | 'soft' | 'hard'`) was cast to `false` when absent on
  Vue only, breaking a `prop === false` sentinel. Such a prop now carries the
  same explicit `undefined` default as a plain optional boolean.
- **React and Svelte parenthesize a compound `class` expression.** A `class`
  `$expression` part whose top level carried `&&`, `||`, `??`, or a ternary
  reassociated inside the presence guard and rendered the wrong value. Such a
  part is now parenthesized before it is embedded; simpler parts are emitted
  verbatim as before.
- **Svelte style serializer drops a nullish entry.** A whole-object `style`
  entry whose runtime value is `null` or `undefined` was serialized as the text
  `undefined`, which a CSS custom property stores as a valid value. The
  generated helper now omits such an entry, matching React and Vue.

## [2.1.0] - 2026-06-28

A minor release. Every change is additive and backward compatible with 2.0.0 -
existing templates render unchanged. The additions extend slot composition,
styling, and the fidelity of the generated output across targets.

### Added

- **Scoped and named slots.** A slot can expose runtime values to its projected
  content through an `exposes` record, and a composing component reference reads
  them by naming the bindings in a `slotScope` field. A composing node can also
  fill a child's named slots through a `slots` map, beside the default slot its
  `children` already fill. Each target renders these in its own idiom: React
  render props, Vue `v-slot` and `<template #name>`, Svelte `let:` and
  `<svelte:fragment slot>`.
- **Object spread (`$spread`).** A reserved `$spread` attribute key spreads a
  named runtime object's own properties onto an element or a composed component
  reference - React `{...x}`, Vue `v-bind="x"`, Svelte `{...x}`. Its value is an
  expression binding, or an array of bindings to spread several objects in
  order; authored attributes, classes, and styles follow and override per key.
- **Per-target `tag` override.** A framework extension's node override can carry
  a `tag` that replaces the node's element for that target alone - the route for
  one composition node that emits a different element per framework, such as a
  React `Portal`, a Vue `Teleport`, or another framework-specific wrapper. A
  capitalized value renders as a component reference.
- **Mixed runtime and static styles.** A `style` object's whole-object
  `$expression` may now sit beside static properties, nested selectors, and
  per-property expressions on the same element. The whole-object expression
  renders through each target's dynamic style mechanism as the base layer;
  static and nested rules route to the stylesheet, with later layers overriding
  earlier ones.
- **Engine Sass resolution.** Under `styling.language: 'css'` (or the `inline`
  strategy) the engine resolves Sass itself: `@include` mixins, SCSS functions,
  and `$variables` compile to flat CSS against the new `styling.loadPaths`
  directories, with a component-level preamble supplying in-component `@use` and
  mixin definitions. The same template that passes Sass through verbatim under
  `language: 'scss'` now renders to any css or inline target. The CLI gains a
  repeatable `--load-path`, and a kit may declare `loadPaths` in its config.
- **`@include` at-rule include vocabulary.** Sass includes are authored as
  `@include` at-rule keys: `'@include name': true` emits a bare `@include name;`,
  and `'@include name': { ... }` emits a content block. Includes emit
  interleaved with sibling declarations in authored order, so an include
  followed by an overriding declaration cascades as written.
- **Slot-presence conditions.** A `conditional` whose condition is a bare
  identifier naming a declared slot resolves to that slot's per-target presence
  check - React `props.<name>`, Vue `$slots.<name>`, Svelte `$$slots.<name>` -
  the wrapper-when-slot-filled pattern. A compound expression that only contains
  a slot name is emitted verbatim.
- **Discriminated surface root.** A component root may be a single `conditional`
  whose branches are different element shapes, each with its own props, content,
  and DOM handle, chosen by a discriminant prop. A branch carries an optional
  `props` record, and `passthrough` may live on the intrinsic-tag element of
  each branch. React emits a discriminated union with per-branch ref typing; Vue
  and Svelte emit two roots that forward attributes; HTML renders every branch
  as a static preview.
- **BEM runtime mode.** `bem({ mode: 'runtime' })` renders a component's BEM
  classes as [`use-bem`](https://www.npmjs.com/package/use-bem) `bem(...)` calls
  for the framework targets in place of literal class strings, with an
  `importSource` option for the call's origin. Statically determinable classes -
  the stylesheet, selector targeting, and HTML mode - are unchanged. The CLI
  gains `--bem-mode` and `--bem-import-source`.

### Deprecated

- **The `$include` style key**, superseded by `@include` at-rule keys (see
  Added). It still works and is accepted in any style block, and now emits a
  deprecation warning; author new includes as `@include`.

### Fixed

- **React parenthesizes a compound conditional condition.** A `conditional`
  whose condition mixed `||` or `??` with the rendered children
  (`inlineLabel || description`) was emitted into React's `&&` short-circuit
  without grouping, so operator precedence rendered the wrong branch. The
  condition is now wrapped in parentheses when its top level is looser than
  `&&`. Vue and Svelte already evaluated the condition as a unit.
- **Optional boolean props are `undefined` when absent on every target.** Vue's
  Boolean prop casting coerced an absent optional boolean to `false`, unlike
  React and Svelte. The Vue extension now gives such a prop an explicit
  `undefined` default, so a controlled/uncontrolled sentinel behaves the same
  across all three frameworks. Svelte no longer doubles `| undefined` on a prop
  whose declared type already admits it.
- **Generated React output type-checks as a typed import.** Two latent type
  defects surfaced when a consumer's `tsc` checks the generated `.tsx`: an
  inline `style` carrying a CSS custom property, and a dynamic root tag on a
  passthrough surface. Both now type-check, with no change to runtime or
  rendered output.
- **Svelte style serializer tolerates a nullish value.** A whole-object `style`
  whose expression can evaluate to `null` or `undefined` no longer throws at
  runtime; the generated helper returns an empty string, matching React and Vue.
- **SVG presentation attributes render React-idiomatic casing.** An SVG authored
  in its canonical DOM form - kebab presentation attributes such as
  `stroke-width` plus the camelCase set such as `viewBox` - now renders valid
  SVG on React, which previously carried the kebab DOM-property names and
  triggered a development warning.

## [2.0.0] - 2026-06-14

A major release. Components are defined once as typed data - TypeScript objects
that are fully JSON-compatible - and rendered to vanilla HTML/CSS/JS or to
React, Vue, and Svelte, with BEM and Tailwind available as styling extensions.

> **Breaking:** 2.0.0 is not backward compatible with 1.x. The template format,
> the extension interface, and the command-line tool are all new. There is no
> automatic migration from 1.x templates; author them against the 2.0 format.

### Added

- **Data-defined components.** Eight node types - component, element, text,
  conditional, iteration, slot, fragment, and comment - describe a whole
  component as serializable data. Dynamic values are JavaScript expressions
  carried as opaque strings, emitted into each target's syntax and never
  evaluated by the engine.
- **HTML-first rendering.** `process(template)` produces working HTML, CSS, and
  JavaScript with no extensions involved - a zero-dependency baseline that every
  framework target follows for consistent semantics.
- **Framework targets.** `@js-template-engine/extension-react` (TypeScript
  function components, `.tsx`), `@js-template-engine/extension-vue` (single-file
  components), and `@js-template-engine/extension-svelte`. Extensions are passed
  directly - no registry, no string keys, no auto-detection - and the core holds
  zero framework knowledge, so third-party extensions plug in through the same
  interface.
- **Styling extensions.** `@js-template-engine/extension-bem`
  (`block__element--modifier` semantic classes with block inheritance) and
  `@js-template-engine/extension-tailwind` (utility-class contribution).
- **Unified output strategies.** Styles and scripts share one vocabulary -
  `inline`, `in-file`, `separate-file` - so one template can produce a single
  self-contained file or separate `.css`/`.js` artifacts.
- **Tailwind ↔ CSS conversion.** The Tailwind extension converts utilities into
  CSS style objects (`output: 'styles'`) and authored CSS style objects into
  Tailwind utilities (`convertStyles: true`), in both directions, against the
  bundled Tailwind v4 default theme - including variants, arbitrary values, and
  arbitrary properties.
- **SCSS output.** A `styling.language: 'scss'` option emits nested SCSS,
  including `@include` pass-through, a component-level preamble for
  `@use`/variables/mixins, and BEM-aware modifier nesting.
- **TypeScript or JavaScript script output** for the vanilla target via
  `scripting.language`.
- **Surface contract.** A `passthrough` element forwards a consumer's arbitrary
  props/attributes, merges a consumer `className`/`class` and `style`, and
  exposes a DOM handle (React ref-as-prop, Vue `$el`, Svelte bindable element).
- **Dynamic root tag.** A root element's `tag` accepts
  `{ $expression, default }` for polymorphic components - one component that
  renders as a `<button>`, an `<a>`, or any tag at runtime.
- **Expression pass-through** on `class` and `style`, **key-event modifiers**,
  **slots**, **conditional attributes**, and **keyed iteration**, each rendered
  idiomatically per target.
- **Command-line tool.** The `js-template-engine` CLI with `render` and
  `validate` commands, framework and styling flags, and configurable output
  strategies.
- **`scaffold-ui-kit`.** Scaffold a multi-framework component library
  (`npx scaffold-ui-kit`), build every component for each configured target, and
  ship a consumer `add` command so downstream projects pull prebuilt components
  with no engine dependency.
- **`@js-template-engine/types`.** The template format as TypeScript types plus
  a generated JSON Schema for validation in any toolchain.

### Changed

- The entire engine, extension API, template format, and CLI are new in 2.0.0
  and replace their 1.x counterparts.

## [1.0.0] - 2024

Initial public release.
