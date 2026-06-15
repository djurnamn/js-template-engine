# Changelog

All notable changes to JS Template Engine are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-06-14

A major release. Components are defined once as typed data — TypeScript objects
that are fully JSON-compatible — and rendered to vanilla HTML/CSS/JS or to
React, Vue, and Svelte, with BEM and Tailwind available as styling extensions.

> **Breaking:** 2.0.0 is not backward compatible with 1.x. The template format,
> the extension interface, and the command-line tool are all new. There is no
> automatic migration from 1.x templates; author them against the 2.0 format.

### Added

- **Data-defined components.** Eight node types — component, element, text,
  conditional, iteration, slot, fragment, and comment — describe a whole
  component as serializable data. Dynamic values are JavaScript expressions
  carried as opaque strings, emitted into each target's syntax and never
  evaluated by the engine.
- **HTML-first rendering.** `process(template)` produces working HTML, CSS, and
  JavaScript with no extensions involved — a zero-dependency baseline that every
  framework target follows for consistent semantics.
- **Framework targets.** `@js-template-engine/extension-react` (TypeScript
  function components, `.tsx`), `@js-template-engine/extension-vue` (single-file
  components), and `@js-template-engine/extension-svelte`. Extensions are passed
  directly — no registry, no string keys, no auto-detection — and the core holds
  zero framework knowledge, so third-party extensions plug in through the same
  interface.
- **Styling extensions.** `@js-template-engine/extension-bem`
  (`block__element--modifier` semantic classes with block inheritance) and
  `@js-template-engine/extension-tailwind` (utility-class contribution).
- **Unified output strategies.** Styles and scripts share one vocabulary —
  `inline`, `in-file`, `separate-file` — so one template can produce a single
  self-contained file or separate `.css`/`.js` artifacts.
- **Tailwind ↔ CSS conversion.** The Tailwind extension converts utilities into
  CSS style objects (`output: 'styles'`) and authored CSS style objects into
  Tailwind utilities (`convertStyles: true`), in both directions, against the
  bundled Tailwind v4 default theme — including variants, arbitrary values, and
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
  `{ $expression, default }` for polymorphic components — one component that
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
