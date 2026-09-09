# @js-template-engine/core

The template engine core. Processes components defined as plain, typed data
into working HTML, CSS, and JavaScript - no extensions required - and
delegates to framework extensions for other targets.

```ts
import { process } from '@js-template-engine/core';
import { defineTemplate } from '@js-template-engine/types';

const template = defineTemplate({
  type: 'component',
  name: 'Button',
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

HTML output is a static rendering: a zero-dependency preview and the
semantic baseline for every framework target. Dynamic concepts render as
static previews - expressions become `{{ expression }}` placeholders,
conditionals render every branch between `<!-- if -->` comments, iterations
render their children once between `<!-- for -->` comments, and slots render
their fallback content.

## Output strategies

Styles and scripts share one strategy vocabulary, configured independently
through `options.styling` and `options.scripting`:

| Strategy | Styles | Scripts |
|---|---|---|
| `inline` | `style="..."` attributes | `onclick="..."` attributes |
| `in-file` (default) | a `<style>` block | a `<script>` block |
| `separate-file` | `Button.css` + link | `Button.js` + script tag |

Under `separate-file`, `styling.stylesheetLink: 'none'` emits the stylesheet
and links it from nowhere - no import, no `<style src>` block, no `<link>` -
leaving how the styles are loaded to whoever consumes the output:

```ts
process(template, {
  styling: { outputStrategy: 'separate-file', stylesheetLink: 'none' },
});
```

## Cascade layers

`styling.layer` wraps collected stylesheet rules in a cascade layer, so a
component holds the same cascade position however its styles are taken - from
an aggregate stylesheet or from the per-component one beside it:

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
applies under every output strategy wherever rules reach a stylesheet; inline
`style="..."` declarations carry none. Under `styling.language: 'scss'` the
component-level preamble's `@use` and `@forward` loads stay above the layer
block, where sass requires them.

## Validation

`process()` validates the template first and throws a `TemplateError`
carrying a node path (such as `children[2].conditions[0]`) on the first
structural violation. `validateTemplate` is exported for standalone use.

## Extensions

Extensions are passed directly - no registry, no string-key lookup:

```ts
process(template, { extensions: [react(), bem()] });
```

Framework extensions implement the `FrameworkExtension` interface exported
from this package and take over rendering entirely; the core stays free of
framework knowledge.
