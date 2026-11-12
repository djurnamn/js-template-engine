# @js-template-engine/extension-bem

The BEM styling extension. Contributes `block__element--modifier` classes to
components defined as plain, typed data - alongside any target extension,
or on the html target the engine renders itself.

<!-- example: bem-process -->
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

<!-- example: bem-separators -->
```ts
bem({ elementSeparator: '__', modifierSeparator: '--' })
```

| Option | Default | |
|---|---|---|
| `elementSeparator` | `'__'` | Joins block and element. |
| `modifierSeparator` | `'--'` | Joins base class and modifier. |
| `mode` | `'literal'` | `'literal'` contributes BEM class strings. `'runtime'` renders them as `bem(...)` calls for the scripted targets (see below). |
| `importSource` | `'use-bem'` | The package the runtime helper is imported from in `'runtime'` mode. |

## Runtime mode

<!-- example: bem-runtime -->
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
the generated stylesheet, selector targeting, and the html target all render the same
class strings as `'literal'` mode - only the React, Vue and Svelte markup swaps them for
calls. A kit using runtime mode ships `use-bem` as a peer dependency; one
block per component is required (a second declared block is an error).

## Styling

BEM classes are semantic: when a node has no static class, generated CSS
(nested styles such as `':hover'` blocks) targets the node through its
first BEM class instead of a generated `data-jte-node` attribute.

Two nodes may share one BEM element, such as column and row headers that are
both `table__header`. Given the same style, the rule is emitted once. Given
different declarations for the same selector, both nodes carry the class,
so each node's rule styles the other too, and the build warns, naming both nodes:
style the class on one node, or give one of them a modifier. Declarations in
another order count as the same rule.

A rule only one node has warns too when it can also match the other node:
`'&:first-child'` or `'&:hover'` on the row header gives
`.table__header:first-child`, which can style the column header as well. Key
such a rule on a modifier only that node carries
(`'&.table__header--row': { '&:first-child': ... }`), and it matches that
node alone, without a warning. The class styled inside `@media` on one of
two nodes that both style it warns the same way. A warning names each node by its tag,
classes and other attributes, such as `<th class="table__header"
scope="row">`, and by its path in the template.

Conditional modifiers have no dedicated concept - a condition-gated class
belongs in the node's `conditionalAttributes`, which carries the condition
explicitly.

## Modifier specificity

When you style a node's own modifier with a self-compound selector
(`&.block--modifier`), `bem()` collapses it to the single-class form on
emission, so the rule keeps a hand-written modifier's specificity (`0,1,0`)
instead of the doubled `0,2,0` compound:

<!-- example: bem-style-collapse -->
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

A comma-separated key is a selector list, and each selector in it collapses
on its own. On a node whose class is `table__cell`,
`'&.table__cell--numeric, &.table__header--numeric'` emits
`.table__cell--numeric`: the node's own modifier collapses, and the
modifier of another element of the block is dropped, since a `table__cell`
node never carries it. So one style object can be spread on the cells and
the headers, and each keeps its own modifier's rule. A node that can carry
a class of the other element - one in its `class` or
`conditionalAttributes`, a class expression, or a target's `attributes`
override setting its class - keeps the selector, compound (`.table__cell.table__header--numeric`), as does any
other selector outside the node's own vocabulary (`&.is-open`). An empty
selector from a trailing comma is dropped.

## Combining with a target

Pass `bem()` together with a target extension to get the same classes in
every target:

<!-- example: bem-targets -->
```ts
process(template, { extensions: [react(), bem()] });
process(template, { extensions: [vue(), bem()] });
process(template, { extensions: [svelte(), bem()] });
```

With more than one styling extension, classes are contributed in the order
the extensions appear in `extensions`.

## License

MIT
