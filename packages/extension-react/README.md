# @js-template-engine/extension-react

The React target extension. Renders components defined as plain, typed
data into React function components in TypeScript.

<!-- example: react-process -->
```ts
import { process } from '@js-template-engine/core';
import { react } from '@js-template-engine/extension-react';
import { defineTemplate } from '@js-template-engine/types';

const template = defineTemplate({
  type: 'component',
  name: 'Button',
  props: {
    label: { type: 'string', required: true },
  },
  script: "function handleClick() {\n  console.log('clicked');\n}",
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

const result = process(template, { extensions: [react()] });
// result.files → [{ path: 'Button.tsx', content: '...' }]
```

## Generated components

A template renders as one `<Name>.tsx` file containing:

- one import from `react`: the members the component needs (`ReactNode`,
  `useState`, ...) followed by those of the template's own
  `import { ... } from 'react'` lines, which it replaces, each member keeping
  its `type` modifier. A `react` import with a default or namespace binding
  (`import React, { Fragment } from 'react'`) stays as written, and the
  generated import leaves out the members it binds
- a `<Name>Props` interface generated from the declared props, with optional
  markers and destructured defaults
  (`const { variant = 'primary' } = props;`). A prop whose name can't be a
  local variable (`aria-pressed`, `for`, `class`) is destructured under a
  camel-cased alias (`'aria-pressed': ariaPressed = false`, `for: forProp`),
  with or without a default, and expressions read it by that alias, the same
  in every target
- on a passthrough root whose dynamic tag reads a declared prop (`as`, or
  `as ?? 'button'`), a generic component typed by the tag or component
  passed: `export function Button<T extends keyof JSX.IntrinsicElements &
  ('button' | 'a') = 'button'>(props: ButtonProps<T>)`, with
  `ButtonProps<T>` intersecting `Omit<ComponentPropsWithRef<T>, ...>` and the
  declared props. `<Button as="a" href="/docs">` type-checks, `href` without
  `as` does not, and the `ref` follows the element. A `componentValued` tag
  widens the constraint to `ElementType`, so `as={Link}` takes `Link`'s
  props. Take the props from `ButtonProps` (or `ButtonProps<'a'>`), not
  `ComponentProps<typeof Button>`, which resolves the tag to every tag
  allowed and keeps only their shared props, or nearly any props with
  `componentValued`
- on a passthrough root with an element below it that routes attributes
  (`passthrough: { attributes }`), a `<Name>RoutedKeys` type alias and a
  props interface extending the root's attributes without those keys plus
  the routed element's for them, so a routed `onBlur` is typed after the
  input; the undeclared props are split by a generated `consumerAttributes`
  helper into `rest`, spread on the root, and `routedRest`, spread on the
  routed element. The `ref` stays on the root, or with `handle: 'routed'`
  lands on the routed element, typed after its tag and composed with a
  template `ref` there through `composeRefs`. An ID list the root or the
  routed element sets (`aria-describedby` and the like) joins the consumer's
  through a generated `authoredAndConsumer` helper
- the component `script` content inside the function body, where handlers
  referenced from JSX are in scope
- JSX with the template's concepts translated to idiomatic React (below)

## Concept translation

| Concept | React output |
|---|---|
| Text expression | `{user.name}` |
| Attribute binding | `src={avatarUrl}` |
| Conditional | `{condition && (...)}` / ternary chains for `else` branches |
| Iteration | `{items.map((item) => ...)}` |
| Conditional classes | `className={'btn' + (condition ? ' btn--lg' : '')}` - no runtime dependency |
| Events | `onClick={handleClick}` |
| Fragment | `<>...</>`, or the element its `extensions.react` block names with `tag` |
| Comment | `{/* ... */}` |

### Slots become props

React has no slot primitive, so slots render as component props: the default
slot as `children`, named slots as props named after the slot. Slot names
normalize to valid JavaScript identifiers (`navigation-menu` →
`navigationMenu`); two slots normalizing to the same identifier, or a slot
colliding with a declared prop, are processing errors.

Each slot also adds an optional `ReactNode` entry to the generated props
interface, and fallback content renders through `??`:

```tsx
{props.header ?? <h2>Default header</h2>}
```

A scoped slot, one that exposes values to its content, takes either a render
function or plain content, as a Vue or Svelte slot does. Its prop is typed
`ReactNode | ((scope: { ... }) => ReactNode)`; a function is called with the
scope and anything else renders as it is:

```tsx
{typeof props.children === 'function'
  ? props.children({ checked })
  : props.children}
```

So both `<Checkbox>Accept</Checkbox>` and
`<Checkbox>{({ checked }) => (checked ? 'On' : 'Off')}</Checkbox>` work.

A scoped slot with `scopeRequired: true` takes the render function alone, for
content that cannot work without the scope, such as a trigger that has to
spread the props it is given. Its prop is typed
`((scope: { ... }) => ReactNode) | undefined`, so
`<Dialog trigger={<Button label="Open" />} />` is a type error, and only a
function renders. Anything else renders the fallback, or nothing:

```tsx
{typeof props.trigger === 'function'
  ? props.trigger({ triggerProps })
  : null}
```

### Iteration keys

When an iteration body is a single element, or a fragment whose React block
names a wrapper, its `key` lands directly on it (`<li key={user.id}>`); any
other body shape is wrapped in
`<Fragment key={...}>`. An iteration without a `key` renders without one and
emits a warning.

### Event names

A template names events by their DOM names, and React writes the event prop
React has for each: `mouseenter` → `onMouseEnter`, `animationend` →
`onAnimationEnd`, `dblclick` → `onDoubleClick`. React's `onFocus` and `onBlur`
listen for the bubbling `focusin` and `focusout`, so those names render as
`onFocus` and `onBlur`; `focus` and `focusin` on one element share the prop and
merge into one handler.

A few props belong to one element: `onCancel` and `onClose` on `<dialog>`,
`onResize` on `<video>`. On an HTML or SVG element, an event name React has no
prop for there renders as `on` + the name (`doubleclick` → `onDoubleclick`),
which React neither types nor attaches, and emits a warning naming the event
and the tag. Rename the event to one React has a prop for, in a React `events`
override when the other targets keep the original name. `capture` on
`mouseenter`, `mouseleave`, `pointerenter` or `pointerleave` warns too, since
React has no capture-phase listener for them. `capture` on `toggle`,
`beforetoggle`, `cancel` or `close`, and `resize` on `<audio>`, attach at
runtime but have no declared type, and warn that the prop is untyped. Events
on a component tag are that component's own props and are not checked.

### Event modifiers

`prevent`, `stop`, and `self` are applied in a generated handler in declared
order. A key-guard modifier (`enter`, `escape`, `arrow-down`, ...) becomes an
`event.key` guard that runs first, so `prevent` and `stop` apply only to the
guarded key, as Vue's `@keydown.prevent.enter` does:

```tsx
onKeyDown={(event) => { if (event.key !== 'Enter') return; event.preventDefault(); submitSearch(event); }}
```

`capture` maps to React's `Capture`-suffixed props
(`onClickCapture`). `once` and `passive` cannot be expressed through React's
declarative event props and emit a warning.

### Two-way props

A prop whose `bindable` is an object (`{ current, setter, defaultProp,
changeProp }`) becomes React's controlled and uncontrolled pair. The
component keeps its own copy in `useState`, seeded from the default prop,
and reads a given prop over it:

```tsx
const [ownPressed, setOwnPressed] = useState<boolean>(defaultPressed);
const isPressed = pressed !== undefined ? pressed : ownPressed;
const latestPressed = useRef<{ value: boolean } | null>(null);
function setPressed(next: boolean | ((current: boolean) => boolean)) {
  const current = latestPressed.current !== null ? latestPressed.current.value : isPressed;
  const value = typeof next === 'function' ? (next as (current: boolean) => boolean)(current) : next;
  if (Object.is(value, current)) return;
  latestPressed.current = { value };
  queueMicrotask(() => (latestPressed.current = null));
  if (pressed === undefined) setOwnPressed(value);
  onPressedChange?.(value);
}
```

A consumer writes `<Toggle pressed={pressed} onPressedChange={setPressed} />`
to own the value, or `<Toggle defaultPressed />` to leave it to the
component. A given value with no handler writing changes back stays as
given. `latestPressed` holds what the setter wrote last until the handler's
task ends, so two calls in one handler build on each other. A component with
a two-way prop holds state, so its file starts with `'use client';`, and
`useState` and `useRef` join the generated `react` import unless the
component's own imports already bring them.

A value whose owner holds it - a state-machine driver, a native input,
which handles being controlled or uncontrolled itself - is **relayed**
instead: `bindable: { given, report, changeProp }` keeps no copy. The
component reads the prop as `given` and reports through `report`, which
calls the change prop with each new value, every call passing through:

```tsx
const givenValue = value;
function reportValue(next: string) {
  onValueChange?.(next);
}
```

The template forwards `givenValue` to the owner and hands it `reportValue`,
the same text in every target. A relayed value holds no state, so it adds
no `'use client'`, `useState` or `useRef`.

`report` takes the change prop's parameter type, so a control can show a
wider value than it reports, and the prop's type when there is no change
prop. With no change prop the function has nothing to call and names its
parameter `_next`, so a consumer compiling with `noUnusedParameters` stays
clean.

## Stylesheet placements

| Placement | Styles |
|---|---|
| `inline` | `style={{ ... }}` objects |
| `in-file` (default) | a rendered `<style>` element |
| `separate-file` | `<Name>.css` + import |

Styles with nested selectors (pseudo-classes, media queries) always require
a stylesheet and stay in the `<style>` element under the `inline` placement.

The `scss` stylesheet language (`styling.language`) emits nested SCSS. A
React `<style>` element is injected at runtime and cannot parse SCSS, so
`scss` is supported only with the `separate-file` placement (`<Name>.scss` +
an import); `in-file` and `inline` under `scss` are a processing error.

## Node-level overrides

Element nodes may carry React-specific overrides under `extensions.react`:
`attributes` merges into the node's attributes per key, and `events`
replaces the node's event list; the build warns, naming each event the
override leaves out, unless an override event of another name takes its
handler or is `change` standing in for `input` (in every target, though
outside React `change` fires on commit, not per keystroke), and an empty list drops them all without a warning. A `class` key is one key: it replaces the
node's whole class list in React, the classes a styling extension such as
BEM or Tailwind gives the node included, so an override that adds a class
repeats the ones it keeps. On a node that spreads `rest`, an override that
adds `rest.className` (`class: ['stack', { $expression: 'rest.className' }]`)
keeps the consumer's class, which `rest` carries unmerged, and the build
does not warn about the node's own class.

A key set to `null` in the `attributes` override removes the node's attribute
of that name from the React output and leaves the other targets alone.
`class: null` removes every class the node renders, BEM's and the ones its
`conditionalAttributes` entries add included (an entry's other attributes
stay, under its condition), and a `className` key stands for the node's
`class`, whether it sets a value or `null`:

<!-- example: react-attribute-removal -->
```ts
{
  type: 'element',
  tag: 'input',
  attributes: { type: 'checkbox', disabled: { $expression: 'mixed' }, title: 'Select all' },
  extensions: { react: { attributes: { title: null } } },
}
```

An `indeterminate` on an `<input>` needs no override, though it is a DOM
property with no attribute and React has no prop for it. Bound on the node,
or set to `true`, it renders as a ref from a small generated helper,
`ref={indeterminateRef(mixed)}`, composed through `composeRefs` with any
other ref the input takes. The helper hands back one of two callbacks by the
value's truth, so the ref changes, and React writes the property, only when
the input mounts and when the value changes, as Vue and Svelte write it. A
click that clears a mixed box stays cleared on the next render, inside an
iteration too. An unset value clears the box, in every target. One in a
conditional entry joins the entry's condition,
`ref={indeterminateRef(open && mixed)}`, and a dynamic tag whose `default`
is `input` takes the ref too: the callbacks accept any element and set the
property only where it has one, so the ref type-checks on every tag the
expression may take. The build warns about a static `indeterminate` that
isn't `true` or `false`.

<!-- example: react-events-override -->
```ts
{
  type: 'element',
  tag: 'button',
  events: [{ name: 'click', handler: 'handleClick' }],
  extensions: {
    react: { events: [{ name: 'click', handler: 'handleReactClick' }] },
  },
}
```

Component-level overrides under the root node's `extensions.react` merge
extension-specific `imports`, `script`, `style`, and `props` into the
component, each with a `merge` (default) or `replace` strategy.

## Attribute names

A template spells attributes as HTML does; the extension writes each in
React's spelling. `REACT_ATTRIBUTE_NAMES` holds the React name of every HTML
and SVG attribute React renames, by its HTML name, and `attributeName(name)`
looks one up, returning any other name unchanged:

```ts
import { attributeName, REACT_ATTRIBUTE_NAMES } from '@js-template-engine/extension-react';

attributeName('tabindex'); // 'tabIndex'
REACT_ATTRIBUTE_NAMES['stroke-width']; // 'strokeWidth'
attributeName('aria-label'); // 'aria-label'
```

## Reserved names

A React component declares these names itself, so in a build with `react()`
no prop, slot, loop variable, id, derived value or script declaration of the
template may take them (validation names the clash):

- in every component: `props`, `componentStyles`, `useBem`, `Fragment`,
  `routedRest`, `surfaceProperties`;
- in a component declaring ids: `useId`, `useState`, `useRef`;
- in a component with a two-way prop: `useState`, `useRef`, and for each
  two-way prop `setOwn<Prop>` and `latest<Prop>` (after its local name),
  which a derived value does not read either.

The engine reserves its own names (`bem`, `RootTag`, `Tag`, the surface
helpers) in every build.

## License

MIT
