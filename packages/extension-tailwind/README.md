# @js-template-engine/extension-tailwind

The Tailwind styling extension. Contributes utility classes to components
defined as plain, typed data - alongside any framework extension, or on the
engine's built-in HTML output. It also converts between utilities and CSS
in either direction - `tailwind({ output: 'styles' })` turns the utilities
into self-contained CSS, and `tailwind({ convertStyles: true })` turns an
element's authored CSS into utilities - so the authored format and the
shipped format become independent choices.

```ts
import { process } from '@js-template-engine/core';
import { tailwind } from '@js-template-engine/extension-tailwind';
import { defineTemplate } from '@js-template-engine/types';

const template = defineTemplate({
  type: 'component',
  name: 'Button',
  children: [
    {
      type: 'element',
      tag: 'button',
      attributes: { class: ['button'] },
      extensions: {
        tailwind: { classes: ['px-4', 'py-2', 'rounded', 'hover:bg-blue-700'] },
      },
      children: [{ type: 'text', content: 'Save' }],
    },
  ],
});

const result = process(template, { extensions: [tailwind()] });
// <button class="button px-4 py-2 rounded hover:bg-blue-700">Save</button>
```

## Node overrides

Each element node opts in through its `extensions.tailwind` block:

| Key | Type | Effect |
|---|---|---|
| `classes` | `string[]` or `string` | Utility classes, contributed in declared order. |

The array form is canonical; a space-separated string is accepted and
normalized. Contributed classes are appended after the node's static
`attributes.class` list, with duplicates dropped (the first occurrence
wins).

## Pass-through by default

Under the default `output: 'classes'`, the classes pass through verbatim.
Responsive and pseudo-class variants are spelled inline (`md:px-6`,
`hover:bg-blue-700`), and the extension parses, validates, and converts
nothing - the generated markup is meant to be processed by Tailwind's own
build, which scans your output files for the classes it should emit.

Because utility classes are shared across nodes by design, generated CSS
(nested styles such as `':hover'` blocks on a node) never uses them as
selectors; nodes without a semantic class are targeted through a generated
`data-jte-node` attribute instead.

Condition-gated utilities have no dedicated concept - a conditional class
belongs in the node's `conditionalAttributes`, which carries the condition
explicitly.

## Converting utilities to CSS

`tailwind({ output: 'styles' })` contributes no classes. Instead, each
node's utilities are converted into its style object at styling time and
ride the engine's normal styling pipeline: every output strategy, the
selector-targeting rules, and every framework target apply downstream
unchanged - and the generated output needs no Tailwind build behind it
(the HTML target becomes fully self-contained).

```ts
const result = process(template, {
  extensions: [tailwind({ output: 'styles' })],
});
// <button class="button">Save</button>
// .button { padding-inline: 1rem; padding-block: 0.5rem; ... }
```

Conversion resolves against the **bundled Tailwind v4 default theme**
(spacing scale, color palette, type scale, breakpoints); there is no theme
customization. Utilities apply in declared order, later declarations
winning property conflicts. The node's authored `style` properties win over
converted ones, recursively inside matching nested blocks. Only the node's
`extensions.tailwind.classes` are converted - plain class strings, static
or conditional, are never parsed.

Variants become nested style blocks: pseudo-class variants map to
pseudo-selectors (`hover:` wrapped in `@media (hover: hover)`, as Tailwind
v4 does), responsive prefixes to min-width media queries, `dark:` to
`@media (prefers-color-scheme: dark)`, and stacked variants compose
recursively with at-rules outermost in the emitted CSS.

### The supported subset

A utility converts when it resolves to **self-contained plain declarations
on its own node**. That covers:

| Family | Utilities |
|---|---|
| Layout | display (`block`, `flex`, `hidden`, ...), visibility, position, `inset`/`top`/`right`/`bottom`/`left`, `z`, `order`, `overflow(-x/-y)`, `object`, `aspect`, `isolate`, `box-border`/`box-content` |
| Flexbox & grid | `flex-row`/`flex-wrap`/..., `flex`, `grow`, `shrink`, `basis`, `grid-cols`/`grid-rows`, `col-span`/`row-span`/`col-start`/..., `gap(-x/-y)`, `justify`/`items`/`content`/`self`/`justify-items`/`justify-self` |
| Spacing | `p*` and `m*` (negatives and `auto` included) |
| Sizing | `w`, `h`, `size`, `min-*`/`max-*` - numeric scale, fractions, keywords, and the container scale (`max-w-lg`) |
| Typography | text sizes (with their paired line height, and the `/` line-height modifier), `text-` alignment and color, `font-` weight and family, `leading`, `tracking`, `italic`, case transforms, decoration lines, `truncate`, `whitespace`, `break-*`, `align`, `list` |
| Backgrounds | `bg-` color, position, size, repeat, attachment, `bg-none` |
| Borders | widths, colors, and styles per side; the radius scale per corner |
| Effects | the `shadow` scale, `opacity` |
| Transitions | `transition-{none,all,colors,opacity,shadow,transform}`, `duration`, `delay`, `ease` |
| Interactivity | `cursor`, `select`, `pointer-events`, `appearance`, `sr-only` |

Total coverage comes from the escape hatches, which pass their CSS through
verbatim: arbitrary values (`p-[3px]`), arbitrary properties
(`[mask-type:luminance]`), and the trailing `!` for `!important`. Colors
take the `/` opacity modifier (`bg-blue-600/75` emits `color-mix()`), and
fractions resolve to their calc form (`w-1/2` → `calc(1 / 2 * 100%)`).

Supported variants: the common pseudo-classes (`hover`, `focus`,
`focus-visible`, `focus-within`, `active`, `visited`, `disabled`,
`checked`, `required`, `invalid`, `first`, `last`, `odd`, `even`, and
friends), the pseudo-elements `placeholder`, `selection` (the node's own),
`marker`, `backdrop`, `first-line`, `first-letter`, the breakpoints
`sm` - `2xl`, and `dark`, `motion-safe`, `motion-reduce`, `print`.

Everything else is a **processing error** naming the utility and its node -
never a silent drop. Out by the self-containment rule: utilities built on
Tailwind's composed custom properties (`ring-*`, transforms, filters,
gradients, animations, bare `transition`, `before:`/`after:` content),
utilities styling other elements (`space-*`, `divide-*`), variants
targeting other elements (`group-*`, `peer-*`, `has-*`), and arbitrary,
`max-*`, `aria-*`, `data-*`, and `supports-*` variants.

## Converting CSS to utilities

`tailwind({ convertStyles: true })` is the inverse of `output: 'styles'`:
each element's authored `style` object becomes Tailwind utility classes,
and no longer emits as CSS. An author can write plain CSS and ship a kit of
utility-class components - the storage format and the output format are
independent choices.

```ts
const result = process(template, {
  extensions: [react(), tailwind({ convertStyles: true })],
});
// style: { paddingInline: '1rem', borderRadius: '0.375rem', display: 'flex' }
// → className="px-4 rounded-md flex"
```

Each declaration resolves against the **same bundled v4 default theme** to
its canonical named utility when the value is on the theme's scale, an
arbitrary value (`padding: 3px` → `p-[3px]`) when it is not, or an
arbitrary property (`mask-type: luminance` → `[mask-type:luminance]`) when
the property has no utility family - so **coverage is total**. A
declaration's `!important` becomes the trailing `!`; an opacity expressed as
`color-mix()` returns to a `/` opacity modifier where recognizable. Nested
blocks invert the variant map (a pseudo-selector to `hover:`/`focus:`/..., a
min-width media query to its responsive prefix, `@media
(prefers-color-scheme: dark)` to `dark:`, with stacked nesting composing).
A nested block with no Tailwind variant equivalent - a parent-modifier or
other arbitrary selector - is a **processing error** naming the selector
and node.

A per-property `$expression` value cannot become a static utility, so it
stays on the element's `style` and renders through the framework's dynamic
mechanism; only its static siblings convert. `convertStyles` is independent
of `output` and reads the authored `style` only. It defaults to `false`.

## Combining with frameworks

Pass `tailwind()` together with a framework extension to get the same
classes in every target:

```ts
process(template, { extensions: [react(), tailwind()] });
process(template, { extensions: [vue(), tailwind()] });
process(template, { extensions: [svelte(), tailwind()] });
```

With more than one styling extension, classes are contributed in the order
the extensions appear in `extensions`.

## License

MIT
