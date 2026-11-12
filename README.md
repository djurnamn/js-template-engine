# JS Template Engine

Define UI components *once*, as typed data, and render them to React, Vue,
and Svelte components or to annotated HTML and CSS, with styling
methodologies (BEM, Tailwind) applied as pluggable extensions.

<!-- example: readme-button -->
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
  script: "function handleClick() {\n  console.log('clicked');\n}",
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
npx js-template-engine render button.ts                 # → Button.html
npx js-template-engine render button.ts --target react  # → Button.tsx
npx js-template-engine render button.ts --target vue    # → Button.vue
npx js-template-engine render button.ts --target svelte # → Button.svelte
```

The React output, for a taste:

```tsx
export interface ButtonProps {
  label: string;
  variant?: 'primary' | 'secondary' | undefined;
}

export function Button(props: ButtonProps) {
  const { label, variant = 'primary' } = props;

  function handleClick() {
    console.log('clicked');
  }

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
| Styling | Out of scope | First-class: BEM, Tailwind, stylesheet placement |
| Default output | Framework components | **Annotated HTML and CSS, zero extensions required** |

Because templates are plain serializable data, any program can assemble,
merge, validate, and transform them - a generator, a CMS, a design tool, or
an LLM - far more naturally than it could synthesize JSX source. That is
what makes [scaffold-ui-kit](https://github.com/djurnamn/scaffold-ui-kit)
possible: maintain one source of truth, ship component libraries for every
framework.

## Packages

| Package | Purpose |
|---|---|
| [`js-template-engine`](packages/cli) | The CLI: `render` and `validate` |
| [`@js-template-engine/core`](packages/core) | The engine: validation, HTML and CSS output, extension contract |
| [`@js-template-engine/types`](packages/types) | The template format: TypeScript types + JSON Schema |
| [`@js-template-engine/extension-react`](packages/extension-react) | React function components (`.tsx`) |
| [`@js-template-engine/extension-vue`](packages/extension-vue) | Vue single-file components (`.vue`) |
| [`@js-template-engine/extension-svelte`](packages/extension-svelte) | Svelte components (`.svelte`) |
| [`@js-template-engine/extension-bem`](packages/extension-bem) | BEM class contribution (`block__element--modifier`) |
| [`@js-template-engine/extension-tailwind`](packages/extension-tailwind) | Tailwind utility-class contribution |

## How it works

**HTML-first.** `process(template)` produces annotated HTML and CSS with no
extensions involved, a zero-dependency rendering that doubles as the semantic
baseline every other target follows.

**Extensions are passed directly.** No registry, no string keys, no magic:

<!-- example: readme-process -->
```ts
import { process } from '@js-template-engine/core';
import { react } from '@js-template-engine/extension-react';
import { bem } from '@js-template-engine/extension-bem';

const result = process(template, { extensions: [react(), bem()] });
// result.files → [{ path: 'Button.tsx', content: '...' }]
```

The core has zero framework knowledge; React, Vue and Svelte support lives
entirely in target extensions. The target and styling extensions are the
project's own: the interface they implement is not yet a stable public
surface for extensions written elsewhere.

**Concepts live on nodes.** Events, conditions, iterations, slots, and
styling are embedded in the template nodes themselves. Eight node types
cover the whole format. Dynamic values are JavaScript expressions carried
as opaque strings; the engine emits them into the target syntax. The html rendering
evaluates only an expression that reads declared `ids` alone, and
`renderInstance` evaluates them all.

**Stylesheet placement.** One option - `inline`, `in-file`,
`separate-file` - decides where a component's styles go, so the same template
can produce a single self-contained file or a component with its `.css`
beside it.

## Quick start

```bash
# Render a template from the command line:
npx js-template-engine render button.ts --target react --styling bem
```

The **[getting-started guide](documentation/getting-started.md)** walks through the
template format - props, expressions, conditionals, iteration, slots,
events, styles - and every render target.

## Building UI kits

[scaffold-ui-kit](https://github.com/djurnamn/scaffold-ui-kit) is a separate
project built on this engine. It scaffolds a multi-framework component library
from a single set of data templates, builds each target, and ships a consumer
CLI that copies components into projects with no engine dependency:

```bash
npx scaffold-ui-kit my-ui-kit
```

## License

MIT
