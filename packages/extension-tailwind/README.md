# @js-template-engine/extension-tailwind

The Tailwind styling extension. Contributes utility classes to components
defined as plain, typed data - alongside any target extension, or on the
html target the engine renders itself. It also converts between utilities and CSS
in either direction - `tailwind({ output: 'styles' })` turns the utilities
into self-contained CSS, and `tailwind({ convertStyles: true })` turns an
element's authored CSS into utilities - so the authored format and the
shipped format become independent choices.

<!-- example: tailwind-process -->
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

`tailwind({ output: 'styles' })` contributes no utility classes. Instead, each
node's utilities are converted into its style object at styling time and
ride the engine's normal styling pipeline: every stylesheet placement, the
selector-targeting rules, and every target apply downstream
unchanged - and the generated output needs no Tailwind build behind it
(the HTML target becomes fully self-contained).

<!-- example: tailwind-styles -->
```ts
const result = process(template, {
  extensions: [tailwind({ output: 'styles' })],
});
// <button class="button">Save</button>
// .button { padding-inline: 1rem; padding-block: 0.5rem; ... }
```

Conversion resolves against the **bundled Tailwind v4 default theme**
(spacing scale, color palette, type scale, breakpoints); there is no theme
customization. Converted rules emit in Tailwind's variant order (below),
and utilities with the same variants apply in declared order, later
declarations winning property conflicts. The node's authored `style` properties win over
converted ones, recursively inside matching nested blocks. Only the node's
`extensions.tailwind.classes` are converted - plain class strings, static
or conditional, are never converted. A class in `conditionalAttributes`, or
in the string literals of a class expression, that looks like a utility
(`opacity-50`, `hover:underline`, `data-[state=open]:bg-accent`) gets a
warning, since it stays a class name with no CSS behind it; give a
condition its styles as a `conditionalAttributes` entry that pairs a class
of your own with a `style` instead (`{ condition: 'disabled', attributes: {
class: ['is-disabled'], style: { opacity: '0.5' } } }`), and the style
becomes that class's rule. A literal
compared against (`variant === 'primary'`) is not a class and is skipped.
The check knows the default theme only, so a bare custom theme token such
as `bg-primary` or `text-foreground` gets no warning.

Variants become nested style blocks: pseudo-class variants map to
pseudo-selectors (`hover:` wrapped in `@media (hover: hover)`, as Tailwind
v4 does), responsive prefixes to min-width media queries, `dark:` to
`@media (prefers-color-scheme: dark)` (or to a selector, below), `aria-*`
and `data-*` to attribute selectors on the node (below), `group-*` and
`peer-*` to selectors reaching a marked ancestor or sibling (below), and
stacked variants compose recursively with at-rules outermost in the
emitted CSS.

### Variant order

Converted rules emit in the order Tailwind v4's own stylesheet gives them,
so a template renders alike with `output: 'classes'` and
`output: 'styles'`, except between utilities with the same variants.
Tailwind sorts rules by their variants, not by class
order: rules without variants first, then `hover:` before `focus:` before
`aria-*` and `data-*`, the breakpoints smallest first, then `dark:`, and a
stacked rule after each of its variants alone. So `dark:hover:bg-indigo-500`
comes after `hover:bg-indigo-600` and wins in dark mode, wherever either
class stands, and `hover:dark:` sorts the same as `dark:hover:`:

```ts
// classes: ['dark:text-white', 'dark:hover:bg-indigo-500', 'hover:bg-indigo-600']
// @media (hover: hover) {
//   .cta:hover { background-color: oklch(51.1% 0.262 276.966); }
// }
// @media (prefers-color-scheme: dark) {
//   .cta { color: #fff; }
//   @media (hover: hover) {
//     .cta:hover { background-color: oklch(58.5% 0.233 277.117); }
//   }
// }
```

A rule joins an earlier block for the same selector or at-rule only when
nothing sorted after that block is emitted between them; otherwise it is
emitted again as a second rule. Utilities with the same variants keep
their declared order, and the later of two that set the same or
overlapping properties wins: `px-4 p-2 px-8` ends with `padding-inline:
2rem`. Tailwind sorts those by property instead, so two utilities with
the same variants that set the same or overlapping properties (`p-2
px-4`) can resolve differently in the two modes: write one.

### Rule order beside authored styles

Nested blocks emit in order, and between two rules of equal specificity
the later one wins. The converted CSS and the node's authored `style`
combine with three guarantees:

- Converted rules keep their variant order, and converted declarations
  of one rule keep the order of their utilities.
- Authored rules and declarations keep the order you wrote them in, at
  every depth.
- An authored declaration comes after every converted declaration of the
  same rule, so it wins over a converted one it overrides, a longhand over
  a converted shorthand included.

An authored key sharing its selector with a converted block (a
hand-written dark block beside a `dark:` utility, a `':focus'` block
beside `focus:`) merges into that block when that keeps both orders, and
takes the converted block's place: a converted rule of equal specificity
from a later utility still comes after it, as it would after the
converted block alone. Otherwise the converted rule stays where it is,
and the authored block becomes a second rule for the same selector, after
the converted rules. An override matches a converted rule by its nesting
path, so nest it in the order of the utility's variants: an override for
`print:dark:` is `'@media print': { [dark]: { ... } }`, and a
`[dark]: { '@media print': ... }` block is a different path, which a
converted `print:dark:` rule can still come after:

```ts
const dark = ':where(:root:is([data-mode="dark"])) &';
// classes: ['bg-white', 'dark:bg-white/5']
// style: {
//   '&[data-featured="true"]': { boxShadow: '0 0 0 2px #4f46e5' },
//   [dark]: { '&[data-featured="true"]': { boxShadow: '0 0 0 2px #6366f1' } },
// }
// .tier { background-color: #fff; }
// :where(...) .tier { background-color: color-mix(...); }
// .tier[data-featured="true"] { box-shadow: 0 0 0 2px #4f46e5; }
// :where(...) .tier[data-featured="true"] { box-shadow: 0 0 0 2px #6366f1; }
```

### Attribute variants

`aria-*` and `data-*` variants select the node by one of its own
attributes, as Tailwind v4 defines them:

| Variant | Selector |
|---|---|
| `aria-checked:` | `&[aria-checked="true"]` |
| `aria-[sort=ascending]:` | `&[aria-sort="ascending"]` |
| `data-active:` | `&[data-active]` |
| `data-[state=open]:` | `&[data-state="open"]` |

A named `aria-<state>` selects the state set to `true`, and any state name
is accepted. A named `data-<name>` selects the attribute's presence. A
bracketed body is the attribute selector after the prefix: its value is
quoted unless it already is (`data-[state='open']`), an operator before
the `=` stays (`data-[lang|=en]` becomes `&[data-lang|="en"]`), a trailing
` i` or ` s` case flag stays outside the quotes, underscores become
spaces, the value is trimmed, and a body without `=` tests presence
(`aria-[busy]`). They stack
like other variants: `hover:aria-checked:` becomes
`&:hover[aria-checked="true"]` inside the hover media query, and
`dark:data-[featured=true]:` puts the attribute selector inside the dark
block, a rule that comes after the plain `data-[featured=true]:` rule (see
Variant order). A `data-<name>` variant tests presence only, and a boolean bound
to a `data-` attribute renders `"false"`, which is still present, so style
a boolean with `aria-<state>:` or `data-[<name>=true]:`. Binding the
attribute and styling it with a variant gives a condition its styles
without a conditional class:

<!-- example: tailwind-attribute-variants -->
```ts
{
  type: 'element',
  tag: 'button',
  attributes: {
    type: 'button',
    role: 'radio',
    'aria-checked': { $expression: 'checked' },
  },
  extensions: {
    tailwind: {
      classes: ['aria-checked:bg-indigo-600', 'aria-checked:text-white'],
    },
  },
  children: [{ type: 'text', content: 'Monthly' }],
}
```

### Group and peer variants

`group-*` and `peer-*` variants style a node by the state of another
element: an ancestor marked `group`, or an earlier sibling marked `peer`.
The markers stay on their elements as classes, the only classes
`output: 'styles'` contributes, since they are what the selectors target.
The selectors are Tailwind v4's:

| Variant | Selector |
|---|---|
| `group-hover:` | `&:is(:where(.group):hover *)`, inside `@media (hover: hover)` |
| `group-aria-expanded:` | `&:is(:where(.group)[aria-expanded="true"] *)` |
| `group-[.is-open]:` | `&:is(:where(.group):is(.is-open) *)` |
| `group-[&.is-open]:` | `&:is(:where(.group).is-open *)` |
| `group-hover/item:` | `&:is(:where(.group\/item):hover *)` |
| `peer-checked:` | `&:is(:where(.peer):checked ~ *)` |

The variant after `group-` or `peer-` is a pseudo-class variant (`hover`,
`focus`, `focus-within`, `checked`, `first`, ...), an `aria-*` or `data-*`
variant, or a bracketed selector, `&` standing for the marked element; a
selector without `&` is the element's own state (`:is(...)`). A name after
`/` (`group/item`, `group-hover/item:`) ties the variant to the marker of
the same name, for nested groups; names take letters, digits, `-` and
`_`. Variants that are not a selector on the marked element (`group-md:`,
`group-dark:`, a pseudo-element) and a relative or at-rule bracketed
selector are processing errors. So are the compounds Tailwind composes
over variants outside the subset, such as `group-has-*`, `peer-not-*`,
`group-in-*`, `group-peer-*` and `group-inert`; their error says the
variant is outside the supported conversion subset. Stacked with other variants they nest where they
stand, and their rules come before every other variant's, as in Tailwind.

<!-- example: tailwind-group-peer -->
```ts
{
  type: 'element',
  tag: 'a',
  attributes: { class: ['plan-card'], href: '/pro' },
  extensions: { tailwind: { classes: ['group', 'p-4'] } },
  children: [
    {
      type: 'element',
      tag: 'h3',
      attributes: { class: ['plan-card__title'] },
      extensions: { tailwind: { classes: ['group-hover:underline'] } },
      children: [{ type: 'text', content: 'Pro' }],
    },
  ],
}
```

Svelte scopes a component's CSS, so there the marked element must be in
the same component as the node its variant styles, and a class a bracketed
selector names (`group-[.is-open]:`) must be written in the component's
static markup: Svelte drops a rule whose class it sees applied only at
runtime, through a class expression or a conditional class.

### Rings and shadows

`ring-*`, `inset-ring-*`, `ring-offset-*`, `ring-inset` and `shadow-*`
convert as Tailwind v4 writes them: each sets its own custom property
(`--tw-ring-shadow`, `--tw-ring-color`, `--tw-inset-ring-shadow`,
`--tw-inset-ring-color`, `--tw-ring-offset-width`, `--tw-ring-offset-color`,
`--tw-ring-inset`, `--tw-shadow`) and the ring and shadow utilities write
one `box-shadow` composed from all of them, so `shadow-md ring-2
ring-blue-500` draws the shadow and the ring together, and
`focus:ring-2` on a node with `shadow-sm` keeps the shadow. A shadow's
color reads `--tw-shadow-color` first, as Tailwind writes it, and a shadow
color utility sets it: `shadow-lg shadow-indigo-500/50` draws the large
shadow in indigo at half opacity, and `hover:shadow-indigo-500` changes
only the color.

Tailwind registers these custom properties with `@property`, so they start
at their initial values and do not inherit: a ring on a card does not
reappear on a shadowed button inside it. The converted CSS does the same.
When a component's converted utilities read Tailwind's composed custom
properties (shadows, rings, outline widths, numeric variants), its
stylesheet ends with the `@property` rules Tailwind emits for them, once:

```css
@property --tw-ring-shadow {
  syntax: "*";
  inherits: false;
  initial-value: 0 0 #0000;
}
```

`@property` is global, so the same rules repeated across components'
stylesheets register each property once. The references Tailwind leaves
to a registered property's start also carry that start as a `var()`
fallback (`var(--tw-ring-shadow, 0 0 #0000)`), so a ring or shadow still
draws where `@property` is unavailable - under the `inline` placement,
which adds no rules, in an older browser, or inside a shadow
root, where `@property` does not register - though there the custom
properties inherit, and an ancestor's ring can reach a descendant that
draws its own shadow.

### Dark mode under a selector

By default a converted `dark:` utility follows the operating system's
color scheme. A page that switches dark mode itself, with a class or an
attribute on `<html>`, passes `darkSelector`, and `dark:` utilities are
written under that selector instead:

<!-- example: tailwind-dark-selector -->
```ts
const result = process(template, {
  extensions: [
    tailwind({ output: 'styles', darkSelector: '[data-mode="dark"]' }),
  ],
});
// dark:bg-gray-900 →
// :where(:root:is([data-mode="dark"])) .panel { background-color: ...; }
```

The selector composes in one of two ways:

- **Without `&`**, it names a state of the page's root element, and
  `dark:` applies while `<html>` matches it: `'.dark'` becomes
  `:where(:root:is(.dark)) &`, and `'[data-mode="dark"]'` becomes
  `:where(:root:is([data-mode="dark"])) &`. The outer `:where()` adds no
  specificity, so a dark rule weighs what the media query weighs, and
  `hover:bg-gray-100` still wins over `dark:bg-gray-900` on hover in dark
  mode.
- **With `&`**, it is used as written, `&` standing for the element, as in
  Tailwind's `@custom-variant dark (...)`: `':root[data-mode="dark"] &'`,
  or `'&:where(.dark, .dark *)'` (not in Svelte, below) to let any
  ancestor turn dark mode on. Such a selector carries its own
  specificity: `':root[data-mode="dark"] &'` adds two classes' worth, so
  its dark rules win over a later `hover:` utility.

A selector list takes `&` in every member or in none, since a member
without `&` beside ones with it would be written as a rule of its own.

Stacked variants nest the selector where the variant stands, as Tailwind
does: `md:dark:p-4` puts it inside the media query, and `hover:dark:` reads
`.panel:hover` as the element. Svelte scopes a component's CSS, so a
selector naming an element outside the component holds there only when it
is anchored at `:root`; the form without `&` always is. That is why it
composes to `:where(:root:is(...))` rather than Tailwind's documented
`&:where(.dark, .dark *)`, which Svelte rewrites to look for the dark
element inside the component. An empty selector, an at-rule, a value
holding `{`, `}` or `;`, or a list mixing members with and without `&` is
an error; `isDarkSelector(value)` tells whether a value is accepted. From the CLI, pass
`--tailwind-dark-selector`.

With `convertStyles: true`, a nested style key spelling the composed
selector (`':where(:root:is([data-mode="dark"])) &'`) converts back to
`dark:`,
and the `prefers-color-scheme` media query becomes an error, since `dark:`
then means the selector. Otherwise `darkSelector` has no effect under
`output: 'classes'`, where Tailwind's own build reads the `dark` variant.

In a scaffold-ui-kit kit, set `darkSelector` in the configuration's
`tailwind` block. The kit's preview then shows the converted dark styles
through a color-mode option that sets an attribute on the frame's root,
such as the preview's `mode` option with
`apply: { type: 'root-attribute', attribute: 'data-mode' }`:
`tailwind: { darkSelector: '[data-mode="dark"]' }` matches the attribute the
option sets when its value is `dark`. Under the default media query, an
option cannot change what the frame reports as the system color scheme.

### The supported subset

A utility converts when it resolves to **self-contained plain declarations
on its own node**. That covers:

| Family | Utilities |
|---|---|
| Layout | display (`block`, `flex`, `hidden`, ...), visibility, position, `inset`/`top`/`right`/`bottom`/`left`, `z`, `order`, `overflow(-x/-y)`, `object`, `aspect`, `columns`, `isolate`, `box-border`/`box-content` |
| Flexbox & grid | `flex-row`/`flex-wrap`/..., `flex`, `grow`, `shrink`, `basis`, `grid-cols`/`grid-rows`, `col-span`/`row-span`/`col-start`/..., `gap(-x/-y)`, `justify`/`items`/`content`/`self`/`justify-items`/`justify-self`, `place-content`/`place-items`/`place-self` |
| Spacing | `p*` and `m*` on the physical sides and axes (negatives and `auto` included) |
| Sizing | `w`, `h`, `size`, `min-*`/`max-*` - numeric scale, fractions, keywords, viewport units (`min-h-dvh`, `h-svh`, `w-lvw`), `lh`, the container scale (`max-w-lg`), `max-w-prose` and the breakpoint widths (`max-w-screen-md`) |
| Typography | text sizes (with their paired line height, and the `/` line-height modifier), `text-` alignment and color, `font-` weight and family, `leading`, `tracking`, `italic`, case transforms, decoration lines, `decoration-` thickness, style and color, `underline-offset`, `truncate`, `line-clamp`, `text-wrap`/`text-nowrap`/`text-balance`/`text-pretty`, `whitespace`, `break-*`, `align`, `list`, numeric variants (`tabular-nums`, `slashed-zero`, ...), `antialiased`/`subpixel-antialiased` |
| Backgrounds | `bg-` color, position, size, repeat, attachment, `bg-none` |
| Borders | widths, colors, and styles per side; the radius scale per corner |
| Outlines | `outline` widths, styles (`outline-dashed`, `outline-none`, `outline-hidden`), colors, and `outline-offset` |
| Effects | the `shadow` scale, `shadow-` colors, `opacity` |
| Rings | `ring` and `ring-<n>` widths, `ring-` colors, `inset-ring` and `inset-ring-<n>` widths, `inset-ring-` colors, `ring-offset-` widths and colors, `ring-inset` |
| Transitions | `transition-{none,all,colors,opacity,shadow,transform}`, `duration`, `delay`, `ease` |
| Interactivity | `cursor`, `select`, `pointer-events`, `appearance`, `resize`, `field-sizing`, `accent`, `caret`, `scroll-m*`/`scroll-p*`, `snap-start`/`snap-center`/`snap-end`/`snap-align-none`, `snap-always`/`snap-normal`, `snap-none`, `sr-only` |
| SVG | `fill`, `stroke` color and width |

Beyond the table, the escape hatches carry their CSS through: arbitrary
values (`p-[3px]`, or `p-(--gutter)` for `p-[var(--gutter)]`), arbitrary
properties (`[mask-type:luminance]`, a custom property such as
`[--gutter:1rem]`, or a prefixed one such as `[-webkit-line-clamp:2]`), and
the trailing `!` for `!important` (the leading form, `hover:!p-1`, too). Their values are decoded as Tailwind decodes them:
underscores become spaces, and math functions get spaces around their
operators, so `w-[calc(100%-2rem)]` emits `calc(100% - 2rem)`. Colors take
the `/` opacity modifier (`bg-blue-600/75` emits `color-mix()`), and
fractions resolve to their calc form (`w-1/2` → `calc(1 / 2 * 100%)`).

Where a utility sets one of several properties depending on its value,
`text-`, `bg-`, `border-`, `font-`, `outline-`, `decoration-` and
`stroke-`, the arbitrary value's type picks the property, read as Tailwind
reads it. A type hint names it:
`text-[length:var(--size)]` is a font size, `bg-[length:...]` a background
size, `bg-[position:...]` its position, `bg-[image:...]` its image,
`border-[length:...]` a width, and `font-[family-name:...]` a family.
Without a hint the type is inferred: `text-[clamp(1rem,2vw,2rem)]` and
`text-[0.8125rem]` are font sizes, `text-[#0f172a]` a color, `bg-[url(...)]`
an image. A value whose type cannot be inferred, such as a bare `var()`
reference, takes Tailwind's fallback: a color for `text-`, `bg-`,
`border-`, `outline-`, `decoration-` and `stroke-`, a weight for `font-`. Write the hint when you mean the other
property. On a utility that sets one property, a hint is dropped.
`shadow-` reads an arbitrary color as a shadow color
(`shadow-[#000]`, `shadow-(color:--glow)`) and anything else as a shadow
(`shadow-(--elevation)`), as Tailwind does. Tailwind's theme functions
(`theme()`, `--spacing()`) are outside the subset, since they need a
Tailwind build to resolve.

Supported variants: the common pseudo-classes (`hover`, `focus`,
`focus-visible`, `focus-within`, `active`, `visited`, `open`, `disabled`,
`checked`, `required`, `invalid`, `user-invalid`, `user-valid`, `first`,
`last`, `odd`, `even`, and friends), the pseudo-elements `placeholder`,
`selection` (the node's own), `marker`, `backdrop`, `first-line`,
`first-letter`, the breakpoints `sm` - `2xl`, `dark`, `motion-safe`,
`motion-reduce`, `print`, the node's own `aria-*` and `data-*` attributes,
and `group-*` and `peer-*` over those.

Everything else is a **processing error** naming the utility and its node -
never a silent drop. A run reports every unconvertible utility of the
template in one error, one line each. The converted CSS assumes Tailwind's preflight, or a
comparable reset, is loaded: each utility converts to what Tailwind emits
for it and nothing more, so `border` becomes `border-width: 1px` and relies
on the reset's solid border style. Where Tailwind composes a property
through its own custom properties on the node, the converted CSS does the
same: `outline-2` reads its style from `--tw-outline-style`, which
`outline-dashed` sets, as `var(--tw-outline-style, solid)`; `tabular-nums
slashed-zero` composes `font-variant-numeric` from both; and rings and
shadows compose `box-shadow` (above). Those custom properties come with
Tailwind's `@property` registrations (above), and the `var()` fallbacks
are the one place the converted CSS differs from Tailwind's text. A variant reacting to
another element in a way Tailwind has no variant for has a plain-CSS form
instead: a nested style key on the node, such as `'.card:hover &': {
color: 'red' }`, which emits beside the converted utilities. Out by the
self-containment rule: utilities built on Tailwind's other composed custom
properties (`inset-shadow-*`, transforms, filters,
gradients, animations, bare `transition`, `snap-x`/`snap-y` and their
strictness, `before:`/`after:` content), utilities styling other elements
(`space-*`, `divide-*`), the `has-*` variant and `group-*` or `peer-*`
over it, opacity modifiers on a shadow (`shadow-lg/50`), and arbitrary,
`max-*`, and `supports-*` variants.

The error tells a Tailwind v4 name the subset leaves out from a name
Tailwind does not define. A variant or utility Tailwind v4 defines, such as
`nth-3:`, `*:`, `starting:`, `forced-colors:`, `@md:`, `@container`,
`scheme-dark`, `float-left` or `text-shadow-sm`,
says it is outside the supported conversion subset. A name Tailwind does
not define, including a Tailwind prefix followed by a value Tailwind
doesn't give it (`start-panel`, `row-header`), says it is unknown, or that
its value is unsupported where the prefix is one the conversion covers.

### A reset for converted CSS

Converted output needs no Tailwind build, but Tailwind's own `preflight.css`
does: it reads the theme through `--theme()`, which only a Tailwind build
resolves, so loaded as it is it leaves the page in the browser's serif
default. A utility converts to the declarations Tailwind emits for it and
nothing more, so converted output relies on the browser defaults the reset
removes: a link is underlined until a reset sets `text-decoration`, a list
keeps its bullets, a heading its size and weight, an image sits inline, and a
button keeps the browser's font and background. Load a reset that removes
them instead, such as this one, which follows preflight without the theme
reads:

```css
*,
::before,
::after,
::backdrop,
::file-selector-button {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border: 0 solid;
}

html {
  line-height: 1.5;
  font-family: ui-sans-serif, system-ui, sans-serif;
  -webkit-text-size-adjust: 100%;
  tab-size: 4;
}

hr {
  height: 0;
  color: inherit;
  border-top-width: 1px;
}

h1,
h2,
h3,
h4,
h5,
h6 {
  font-size: inherit;
  font-weight: inherit;
}

a {
  color: inherit;
  text-decoration: inherit;
}

b,
strong {
  font-weight: bolder;
}

code,
kbd,
samp,
pre {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 1em;
}

small {
  font-size: 80%;
}

table {
  text-indent: 0;
  border-color: inherit;
  border-collapse: collapse;
}

ol,
ul,
menu {
  list-style: none;
}

img,
svg,
video,
canvas,
audio,
iframe,
embed,
object {
  display: block;
  vertical-align: middle;
}

img,
video {
  max-width: 100%;
  height: auto;
}

button,
input,
select,
optgroup,
textarea,
::file-selector-button {
  font: inherit;
  letter-spacing: inherit;
  color: inherit;
  border-radius: 0;
  background-color: transparent;
  opacity: 1;
}

::placeholder {
  opacity: 1;
  color: color-mix(in oklab, currentcolor 50%, transparent);
}

textarea {
  resize: vertical;
}

button,
input:where([type='button'], [type='reset'], [type='submit']),
::file-selector-button {
  appearance: button;
}

[hidden]:where(:not([hidden='until-found'])) {
  display: none !important;
}
```

The reset sets nothing for Tailwind's custom properties: the converted
CSS registers those itself (see Rings and shadows). A kit that sets its
own fonts replaces the two `font-family` lists with its own.

## Converting CSS to utilities

`tailwind({ convertStyles: true })` is the inverse of `output: 'styles'`:
each element's authored `style` object becomes Tailwind utility classes,
and no longer emits as CSS. An author can write plain CSS and ship a kit of
utility-class components - the storage format and the output format are
independent choices.

<!-- example: tailwind-convert-styles -->
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
the property has no utility family. A
declaration's `!important` becomes the trailing `!`; an opacity expressed as
`color-mix()` returns to a `/` opacity modifier where recognizable. Nested
blocks invert the variant map (a pseudo-selector to `hover:`/`focus:`/..., a
min-width media query to its responsive prefix, `@media
(prefers-color-scheme: dark)` to `dark:`, with stacked nesting composing).
A nested block with no Tailwind variant equivalent - a parent-modifier or
other arbitrary selector - is a **processing error** naming the selector
and node.

A per-property `$expression` value cannot become a static utility, so it
stays on the element's `style` and renders through the target's dynamic
mechanism; only its static siblings convert. `convertStyles` is independent
of `output` and reads the authored `style` only. It defaults to `false`.

## Combining with a target

Pass `tailwind()` together with a target extension to get the same
classes in every target:

<!-- example: tailwind-targets -->
```ts
process(template, { extensions: [react(), tailwind()] });
process(template, { extensions: [vue(), tailwind()] });
process(template, { extensions: [svelte(), tailwind()] });
```

With more than one styling extension, classes are contributed in the order
the extensions appear in `extensions`.

## License

MIT
