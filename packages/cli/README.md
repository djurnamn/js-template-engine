# js-template-engine

The command-line interface for the JS Template Engine. Renders UI components
defined as plain, typed data to vanilla HTML/CSS/JS or to React, Vue, and
Svelte components - with styling methodologies (BEM, Tailwind) applied as
extensions.

```bash
npx js-template-engine render button.json --framework react
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
# Vanilla HTML/CSS/JS (the default):
js-template-engine render button.json

# A React component with BEM classes:
js-template-engine render button.json --framework react --styling bem

# Every template in src/components, as Svelte components, into dist/svelte:
js-template-engine render src/components --framework svelte --output-directory dist/svelte
```

| Option | Default | |
|---|---|---|
| `--framework <name>` | - | `react`, `vue`, or `svelte`; omitted renders HTML |
| `--styling <names>` | - | comma-separated styling extensions (`bem`, `tailwind`), applied in order |
| `-o, --output-directory <path>` | `./output` | directory generated files are written to |
| `-n, --component-name <name>` | filename | component name for templates that declare none |
| `--styling-strategy <strategy>` | `in-file` | `inline`, `in-file`, or `separate-file` |
| `--styling-language <language>` | `css` | `css`, or `scss` for nested output; react and HTML require `--styling-strategy separate-file` under `scss` |
| `--load-path <path>` | - | sass load-path directory for resolving `@use`/`@include` in component styles under `--styling-language css`; repeatable |
| `--scripting-strategy <strategy>` | `in-file` | `inline`, `in-file`, or `separate-file` |
| `--scripting-language <language>` | `javascript` | `javascript`, or `typescript` to type the generated prop consts; affects HTML mode only and requires `--scripting-strategy separate-file` (writing `<Name>.ts`) |
| `--bem-element-separator <separator>` | `__` | separator between BEM block and element |
| `--bem-modifier-separator <separator>` | `--` | separator before a BEM modifier |
| `--bem-mode <mode>` | `literal` | `literal` emits BEM class strings; `runtime` emits `use-bem` `bem(...)` calls for framework targets (HTML keeps the literal classes) |
| `--bem-import-source <package>` | `use-bem` | package the `use-bem` helper is imported from under `--bem-mode runtime` |
| `--tailwind-output <output>` | `classes` | `classes` passes utilities through for Tailwind's build; `styles` converts them into the generated CSS |
| `--tailwind-convert-styles` | off | convert each element's authored `style` into Tailwind utility classes |

Warnings are printed to stderr; written files are listed on stdout. When a
template in a directory fails, the remaining templates still render and the
command exits non-zero.

### `validate <source>`

Validates a template file - or every template in a directory - against the
template format, without writing anything.

```bash
js-template-engine validate src/components
```

Each valid template is confirmed on stdout; each invalid one is reported on
stderr with the path of the offending node. The command exits non-zero when
any template is invalid.

## Template files

A template is plain serializable data, so the CLI accepts it in several
forms:

- **`.json`** - the transport form.
- **`.ts`, `.js`, `.mjs`, `.cjs`** - a module whose default export is the
  template. TypeScript files are loaded directly; no build step is needed.

```ts
// button.ts
import { defineTemplate } from '@js-template-engine/types';

export default defineTemplate({
  type: 'component',
  name: 'Button',
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
js-template-engine render button.ts --framework vue
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

```ts
import { process } from '@js-template-engine/core';
import { react } from '@js-template-engine/extension-react';
import { bem } from '@js-template-engine/extension-bem';

const result = process(template, { extensions: [react(), bem()] });
// result.files → [{ path: 'Button.tsx', content: '...' }]
```

Third-party extensions plug in through that API; the CLI's `--framework`
and `--styling` flags cover the published extensions.
