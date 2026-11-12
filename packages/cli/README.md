# js-template-engine

The command-line interface for the JS Template Engine. Renders UI components
defined as plain, typed data to React, Vue, and Svelte components or to
annotated HTML and CSS - with styling methodologies (BEM, Tailwind) applied
as extensions.

```bash
npx js-template-engine render button.json --target react
```

## Installation

```bash
npm install --save-dev js-template-engine
# or globally:
npm install --global js-template-engine
```

## Commands

### `render <source>`

Renders a template file - or every template in a directory - and writes the
generated files.

```bash
# Annotated HTML and CSS (the default):
js-template-engine render button.json

# A React component with BEM classes:
js-template-engine render button.json --target react --styling bem

# Every template in src/components, as Svelte components, into dist/svelte:
js-template-engine render src/components --target svelte --output-directory dist/svelte
```

| Option | Default | |
|---|---|---|
| `--target <name>` | `html` | `react`, `vue`, `svelte`, or `html` for annotated HTML and CSS |
| `--styling <names>` | - | comma-separated styling extensions (`bem`, `tailwind`), applied in order |
| `-o, --output-directory <path>` | `./output` | directory generated files are written to |
| `-n, --component-name <name>` | filename | component name for templates that declare none |
| `--stylesheet-placement <placement>` | `in-file` | where the styles go: `inline` style attributes, `in-file` in the component, or `separate-file` in a stylesheet of their own |
| `--styling-language <language>` | `css` | `css`, or `scss` for nested output; the react and html targets require `--stylesheet-placement separate-file` under `scss` |
| `--stylesheet-link <mode>` | `component` | `component`, or `none` to emit the `separate-file` stylesheet and link it from nowhere - no import, no `<style src>` block, no `<link>`; requires `--stylesheet-placement separate-file` |
| `--styling-layer <name>` | - | cascade layer emitted stylesheet rules are wrapped in; omitted emits them unlayered |
| `--styling-layer-order <names>` | - | comma-separated layer order declared ahead of the wrapper, e.g. `kit.reset,kit.components` |
| `--load-path <path>` | - | sass load-path directory for resolving `@use`/`@include` in component styles under `--styling-language css`; repeatable |
| `--scripting-strategy <strategy>` | - | deprecated and has no effect: no output contains a script; prints a warning, removed in 3.0.0 |
| `--scripting-language <language>` | - | deprecated and has no effect, like `--scripting-strategy` |
| `--bem-element-separator <separator>` | `__` | separator between BEM block and element |
| `--bem-modifier-separator <separator>` | `--` | separator before a BEM modifier |
| `--bem-mode <mode>` | `literal` | `literal` emits BEM class strings; `runtime` emits `use-bem` `bem(...)` calls for the react, vue and svelte targets (the html target keeps the literal classes) |
| `--bem-import-source <package>` | `use-bem` | package the `use-bem` helper is imported from under `--bem-mode runtime` |
| `--tailwind-output <output>` | `classes` | `classes` passes utilities through for Tailwind's build; `styles` converts them into the generated CSS |
| `--tailwind-dark-selector <selector>` | - | with `--tailwind-output styles`, the selector `dark:` utilities follow instead of `prefers-color-scheme` (`':root[data-mode="dark"] &'`, `'.dark'`) |
| `--tailwind-convert-styles` | off | convert each element's authored `style` into Tailwind utility classes |
| `--svelte-mode <mode>` | `legacy` | `legacy` emits classic Svelte components; `runes` emits Svelte 5 runes components (`$props()`, snippets, event attributes) |

`--framework` and `--styling-strategy` are deprecated aliases of `--target`
and `--stylesheet-placement`: they print a warning and are removed in 3.0.0.

Warnings are printed to stderr; written files are listed on stdout. When a
template in a directory fails, each of its errors is printed on its own
line, the remaining templates still render and the command exits non-zero.

### `validate <source>`

Validates a template file - or every template in a directory - against the
template format, without writing anything. A template is checked for every
target the CLI renders with, so a name the React, Vue or Svelte output
declares itself cannot name a prop, slot or binding.

```bash
js-template-engine validate src/components
```

Each valid template is confirmed on stdout; each invalid one is reported on
stderr, one line per violation with the path of the offending node. The
command exits non-zero when any template is invalid.

## Template files

A template is plain serializable data, so the CLI accepts it in several
forms:

- **`.json`** - the transport form.
- **`.ts`, `.js`, `.mjs`, `.cjs`** - a module whose default export is the
  template. TypeScript files are loaded directly; no build step is needed.

<!-- example: cli-button -->
```ts
// button.ts
import { defineTemplate } from '@js-template-engine/types';

export default defineTemplate({
  type: 'component',
  name: 'Button',
  script: "function handleClick() {\n  console.log('clicked');\n}",
  children: [
    {
      type: 'element',
      tag: 'button',
      attributes: { class: ['button'] },
      events: [{ name: 'click', handler: 'handleClick' }],
      children: [{ type: 'text', content: 'Click me' }],
    },
  ],
});
```

```bash
js-template-engine render button.ts --target vue
# wrote output/Button.vue
```

When a directory is given, every template file directly inside it is
rendered; subdirectories are not searched.

## Component names

The name decides the generated file names (`Button.tsx`, `Button.vue`, ...)
and the component identifier inside them. It is resolved in order:

1. the template's own `name`, when it has a `component` root;
2. the `--component-name` flag;
3. the source filename, PascalCased (`icon-badge.json` → `IconBadge`).

## Programmatic use

The CLI is a thin shell over `@js-template-engine/core`. For build scripts
and tooling, use the engine directly - extensions are passed as objects, no
name mapping involved:

<!-- example: cli-process -->
```ts
import { process } from '@js-template-engine/core';
import { react } from '@js-template-engine/extension-react';
import { bem } from '@js-template-engine/extension-bem';

const result = process(template, { extensions: [react(), bem()] });
// result.files → [{ path: 'Button.tsx', content: '...' }]
```

The CLI's `--target` and `--styling` flags cover the published
extensions.
