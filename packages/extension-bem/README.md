# @js-template-engine/extension-bem

The BEM styling extension. Contributes `block__element--modifier` classes to
components defined as plain, typed data - alongside any framework extension,
or on the engine's built-in HTML output.

```ts
import { process } from '@js-template-engine/core';
import { bem } from '@js-template-engine/extension-bem';
import { defineTemplate } from '@js-template-engine/types';

const template = defineTemplate({
  type: 'component',
  name: 'Card',
  children: [
    {
      type: 'element',
      tag: 'article',
      extensions: { bem: { block: 'card' } },
      children: [
        {
          type: 'element',
          tag: 'h2',
          extensions: { bem: { element: 'title', modifiers: ['centered'] } },
          children: [{ type: 'text', content: 'Hello' }],
        },
      ],
    },
  ],
});

const result = process(template, { extensions: [bem()] });
// <article class="card">
//   <h2 class="card__title card__title--centered">Hello</h2>
// </article>
```

## Node overrides

Each element node opts in through its `extensions.bem` block:

| Key | Type | Effect |
|---|---|---|
| `block` | `string` | The BEM block. Declared blocks are inherited by descendants. |
| `element` | `string` | The BEM element, joined to the effective block: `block__element`. |
| `modifiers` | `string[]` | One class per modifier, appended to the base: `base--modifier`. |

The contributed classes are appended after the node's static
`attributes.class` list, with duplicates dropped (the first occurrence
wins). Block, element, and modifier names are author space - the extension
joins them with the configured separators and never validates naming.

## Block inheritance

A node without its own `block` uses the nearest ancestor element's declared
`block`, so a component usually declares its block once at the root and its
descendants declare only `element`. Inheritance flows through fragments,
conditional branches, iteration bodies, and slot fallbacks. A node
declaring only `element` does not pass a block on to its descendants.

An override whose `element` or `modifiers` has no effective block - none
declared on the node, none inherited - contributes nothing and emits a
warning in `ProcessResult.warnings`.

## Options

```ts
bem({ elementSeparator: '__', modifierSeparator: '--' })
```

| Option | Default | |
|---|---|---|
| `elementSeparator` | `'__'` | Joins block and element. |
| `modifierSeparator` | `'--'` | Joins base class and modifier. |
| `mode` | `'literal'` | `'literal'` contributes BEM class strings. `'runtime'` renders them as `bem(...)` calls for framework targets (see below). |
| `importSource` | `'use-bem'` | The package the runtime helper is imported from in `'runtime'` mode. |

## Runtime mode

```ts
bem({ mode: 'runtime' })
```

In `'runtime'` mode the BEM classes render as [`use-bem`](https://www.npmjs.com/package/use-bem)
`bem(...)` calls for the React, Vue, and Svelte targets, instead of literal
class strings. Each component emits one helper setup line - `useBem('Block')`
from `use-bem/react` in React, `createBem('Block')` from `use-bem` in Vue and
Svelte - and each node renders its classes as `bem('element', modifiers)`. A
condition-gated modifier folds into the call's record argument; an
out-of-vocabulary conditional class stays as ordinary conditional rendering.

The literal classes are unchanged everywhere they are statically determinable:
the generated stylesheet, selector targeting, and HTML mode all render the same
class strings as `'literal'` mode - only the framework markup swaps them for
calls. A kit using runtime mode ships `use-bem` as a peer dependency; one
block per component is required (a second declared block is an error).

## Styling

BEM classes are semantic: when a node has no static class, generated CSS
(nested styles such as `':hover'` blocks) targets the node through its
first BEM class instead of a generated `data-jte-node` attribute.

Conditional modifiers have no dedicated concept - a condition-gated class
belongs in the node's `conditionalAttributes`, which carries the condition
explicitly.

## Modifier specificity

When you style a node's own modifier with a self-compound selector
(`&.block--modifier`), `bem()` collapses it to the single-class form on
emission, so the rule keeps a hand-written modifier's specificity (`0,1,0`)
instead of the doubled `0,2,0` compound:

```ts
extensions: { bem: { block: 'card' } },
attributes: {
  style: {
    padding: '0.25rem 0.5rem',
    '&.card--featured': { color: '#fff' },
    '&.is-open': { outline: '1px solid' },
  },
}
// .card { padding: 0.25rem 0.5rem; }
// .card--featured { color: #fff; }   ← collapsed (0,1,0)
// .card.is-open { outline: 1px solid; }   ← not the node's vocabulary, left as written
```

The collapse applies in both `css` and `scss` output (in SCSS the modifier
nests as `&--featured`), and inside `@media` blocks. It fires only for a
selector that matches the node's own block/element vocabulary; an
out-of-vocabulary compound (`&.is-open`) is left untouched, and without
`bem()` in the run the compound emits as written - heavier specificity, not
a broken selector. Author the IR with the CSS-honest `&.block--modifier`
spelling (never the Sass-only `&--modifier`, which is invalid in plain CSS
nesting).

## Combining with frameworks

Pass `bem()` together with a framework extension to get the same classes in
every target:

```ts
process(template, { extensions: [react(), bem()] });
process(template, { extensions: [vue(), bem()] });
process(template, { extensions: [svelte(), bem()] });
```

With more than one styling extension, classes are contributed in the order
the extensions appear in `extensions`.

## License

MIT
