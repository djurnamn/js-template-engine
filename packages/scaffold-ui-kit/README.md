# scaffold-ui-kit

Scaffold framework-agnostic UI kits powered by
[js-template-engine](https://www.npmjs.com/package/js-template-engine):
define components once as typed data templates and build them for React,
Vue, Svelte, and vanilla HTML — with BEM and Tailwind styling as
configurable extensions.

A kit created by scaffold-ui-kit is an npm package with a single source of
truth in `src/components/`, built output per target in `dist/<target>/`,
and a consumer CLI that copies built components into consuming projects —
no engine dependency ever reaches a consumer.

## Create a kit

```bash
npx scaffold-ui-kit my-ui-kit
cd my-ui-kit
npm install
npm run build
```

`init` asks for the targets (`react`, `vue`, `svelte`, `html`), the
styling extensions (`bem`, `tailwind`, or none), and whether to include
the example components. Every choice can also be passed as a flag for
non-interactive use:

```bash
npx scaffold-ui-kit init my-ui-kit --targets react,vue --styling bem --no-examples
```

## Define components

Components are data templates in `src/components/` — TypeScript modules
default-exporting a template (with full autocompletion via
`defineTemplate`), or plain JSON:

```ts
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
      events: [{ name: 'click', handler: 'handleClick' }],
      children: [{ type: 'text', expression: 'label' }],
    },
  ],
});
```

## Build

```bash
npm run build   # runs scaffold-ui-kit build
```

`build` renders every template once per configured target:

```
dist/
├── react/
│   ├── Button.tsx
│   ├── Card.tsx
│   └── index.ts
├── vue/
│   ├── Button.vue
│   ├── Card.vue
│   └── index.ts
├── svelte/
│   ├── Button.svelte
│   ├── Card.svelte
│   └── index.ts
└── html/
    ├── Button.html
    └── Card.html
```

Configured styling extensions (BEM, Tailwind) contribute their classes to
every target's output. Targets, styling, and output strategies live in
`scaffold-ui-kit.config.json`:

```json
{
  "name": "my-ui-kit",
  "targets": ["react", "vue", "svelte", "html"],
  "styling": ["bem"]
}
```

Optional keys: `stylingStrategy` and `scriptingStrategy`
(`inline` | `in-file` | `separate-file`, default `in-file`),
`stylingLanguage` (`css` | `scss`, default `css`) — `scss` emits nested
SCSS; the `react` and `html` targets need `stylingStrategy: 'separate-file'`
under it — `scriptingLanguage` (`javascript` | `typescript`, default
`javascript`) — `typescript` types the generated prop consts; it affects
the `html` target only and needs `scriptingStrategy: 'separate-file'` there —
`bemElementSeparator` / `bemModifierSeparator`, `tailwindOutput`
(`classes` | `styles`, default `classes`) — set it to `styles` to convert
the Tailwind utilities to plain CSS at build time, so the output needs no
Tailwind build of its own — and `tailwindConvertStyles` (`true` | `false`,
default `false`), the inverse: convert each component's authored `style`
into Tailwind utility classes.

## Publish and consume

```bash
npm publish
```

The published kit ships its built `dist/` and a consumer CLI. Consumers
copy components into their project without installing anything else:

```bash
npx my-ui-kit add button --target react
npx my-ui-kit add                # interactive
npx my-ui-kit add --list         # what's available
```

`add` copies the built component files (plus any separate stylesheets)
into `./src/components/ui` by default; `--output-directory` overrides the
destination. Existing files prompt before being overwritten.

Kits are also usable as regular packages — each framework target gets an
`index.ts` barrel re-exporting its components.

## Commands

| Command | Purpose |
|---|---|
| `scaffold-ui-kit init [project-name]` | Scaffold a kit project (default command) |
| `scaffold-ui-kit build` | Render every template into `dist/<target>/` |

`init` flags: `--targets <names>`, `--styling <names|none>`,
`--examples` / `--no-examples`, `-d, --directory <path>`.

## License

MIT
