# Changelog

All notable changes to JS Template Engine are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
