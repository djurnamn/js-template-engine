# JS Template Engine

Define UI components **once, as typed data** — and render them to vanilla
HTML/CSS/JS or to React, Vue, and Svelte components, with styling
methodologies (BEM, Tailwind) applied as pluggable extensions.

```ts
// button.ts
import { defineTemplate } from '@js-template-engine/types';

export default defineTemplate({
  type: 'component',
  name: 'Button',
  props: {
    label: { type: 'string', required: true },
    variant: { type: "'primary' | 'secondary'", default: 'primary' },
  },
  children: [
    {
      type: 'element',
      tag: 'button',
      attributes: { class: ['button'], type: 'button' },
      conditionalAttributes: [
        {
          condition: "variant === 'primary'",
          attributes: { class: ['button--primary'] },
        },
      ],
      events: [{ name: 'click', handler: 'handleClick' }],
      children: [{ type: 'text', expression: 'label' }],
    },
  ],
});
```

```bash
npx js-template-engine render button.ts                    # → Button.html
npx js-template-engine render button.ts --framework react  # → Button.tsx
npx js-template-engine render button.ts --framework vue    # → Button.vue
npx js-template-engine render button.ts --framework svelte # → Button.svelte
```

The React output, for a taste:

```tsx
interface ButtonProps {
  label: string;
  variant?: 'primary' | 'secondary';
}

export function Button(props: ButtonProps) {
  const { label, variant = 'primary' } = props;

  return (
    <button
      className={'button' + (variant === 'primary' ? ' button--primary' : '')}
      type="button"
      onClick={handleClick}
    >
      {label}
    </button>
  );
}
```

## Why data instead of code?

Tools like [Mitosis](https://github.com/BuilderIO/mitosis) occupy the
"write once, compile everywhere" space by compiling a restricted JSX
dialect. This engine takes the opposite approach:

| | Mitosis | js-template-engine |
|---|---|---|
| Authoring surface | Code (a static JSX subset) | **Data** (typed TS objects / JSON) |
| Intermediate format | Internal, not an authoring format | The data **is** the format |
| Styling | Out of scope | First-class: BEM, Tailwind, output strategies |
| Default output | Framework targets | **Vanilla HTML/CSS/JS, zero extensions required** |

Because templates are plain serializable data, any program can assemble,
merge, validate, and transform them — a generator, a CMS, a design tool, or
an LLM — far more naturally than it could synthesize JSX source. That is
what makes [scaffold-ui-kit](packages/scaffold-ui-kit) possible: maintain one
source of truth, ship component libraries for every framework.

## Packages

| Package | Purpose |
|---|---|
| [`js-template-engine`](packages/cli) | The CLI: `render` and `validate` |
| [`scaffold-ui-kit`](packages/scaffold-ui-kit) | Scaffold and build framework-agnostic UI kits |
| [`@js-template-engine/core`](packages/core) | The engine: validation, HTML/CSS/JS output, extension contract |
| [`@js-template-engine/types`](packages/types) | The template format: TypeScript types + JSON Schema |
| [`@js-template-engine/extension-react`](packages/extension-react) | React function components (`.tsx`) |
| [`@js-template-engine/extension-vue`](packages/extension-vue) | Vue single-file components (`.vue`) |
| [`@js-template-engine/extension-svelte`](packages/extension-svelte) | Svelte components (`.svelte`) |
| [`@js-template-engine/extension-bem`](packages/extension-bem) | BEM class contribution (`block__element--modifier`) |
| [`@js-template-engine/extension-tailwind`](packages/extension-tailwind) | Tailwind utility-class contribution |

## How it works

**HTML-first.** `process(template)` produces working HTML, CSS, and
JavaScript with no extensions involved — a zero-dependency rendering that
doubles as the semantic baseline every framework target follows.

**Extensions are passed directly.** No registry, no string keys, no magic:

```ts
import { process } from '@js-template-engine/core';
import { react } from '@js-template-engine/extension-react';
import { bem } from '@js-template-engine/extension-bem';

const result = process(template, { extensions: [react(), bem()] });
// result.files → [{ path: 'Button.tsx', content: '...' }]
```

The core has zero framework knowledge; framework support lives entirely in
extensions, and third-party extensions plug in through the same interface.

**Concepts live on nodes.** Events, conditions, iterations, slots, and
styling are embedded in the template nodes themselves — eight node types
cover the whole format. Dynamic values are JavaScript expressions carried
as opaque strings; the engine emits them into the target syntax and never
evaluates them.

**Unified output strategies.** Styles and scripts share one vocabulary —
`inline`, `in-file`, `separate-file` — so the same template can produce a
single self-contained file or separate `.css`/`.js` artifacts.

## Quick start

```bash
# Render a template from the command line:
npx js-template-engine render button.ts --framework react --styling bem

# Or scaffold an entire multi-framework component library:
npx scaffold-ui-kit my-ui-kit
```

The **[getting-started guide](docs/getting-started.md)** walks through the
template format — props, expressions, conditionals, iteration, slots,
events, styles — and every render target.

## License

MIT
