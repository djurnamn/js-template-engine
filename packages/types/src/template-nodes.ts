import type { Attributes, ConditionalAttributes } from './attributes';
import type { EventDefinition } from './events';
import type {
  ComponentExtensionOverrides,
  ExtensionOverrides,
  FragmentExtensionOverrides,
} from './extension-overrides';
import type { PropDefinition } from './props';

/**
 * An HTML element.
 *
 * Void elements (`img`, `input`, `br`, ...) must not have `children`
 * (validation error). Boolean attributes use `true`/`false` values.
 */
/**
 * A dynamic tag: the element's tag name is resolved from a runtime
 * expression instead of a literal. `$expression` is an opaque JavaScript
 * expression (the engine emits it verbatim, never parses it) yielding the
 * runtime tag - an intrinsic tag string or a component identifier.
 * `default` is a required static tag: the tag the html target renders (with a
 * `<!-- tag: expression -->` comment before it), the void/children validation check, and - on a passthrough
 * surface root - the typed prop surface. The engine never injects `default`
 * as a runtime fallback; an author wanting one writes it into the
 * expression. Allowed on any element; only the component's single root
 * rendered element may be `componentValued`.
 */
export interface DynamicTag {
  /** The runtime tag expression, e.g. `"as ?? 'button'"` - a JavaScript expression. */
  $expression: string;
  /** The static tag the html target renders and validation and typing use; never applied at runtime. */
  default: string;
  /**
   * Set when the expression may resolve to a **component** value (rather than
   * only an intrinsic tag string). A value-domain declaration for the
   * emitters: React (`ElementType`) and Vue (`:is`) already accept both at
   * runtime, and React's generated types then accept a component for a
   * polymorphic `as` prop. Svelte needs it - `<svelte:element>` renders
   * string tags only, so a component-valued root emits a `typeof` branch (a
   * `<svelte:element>` string arm and a component arm) instead. Allowed only
   * on the component's single root rendered element. Absent, the tag is
   * treated as string-tag-valued.
   */
  componentValued?: boolean;
}

export interface ElementNode {
  type: 'element';
  /**
   * The tag name: `'div'`, `'button'`, `'svg'`, ... A `DynamicTag` resolves
   * the tag from a runtime expression instead.
   */
  tag: string | DynamicTag;
  /** Static and dynamic attributes. */
  attributes?: Attributes;
  /** Condition-gated attributes. */
  conditionalAttributes?: ConditionalAttributes[];
  /** Events bound to this element. */
  events?: EventDefinition[];
  children?: TemplateNode[];
  /** Per-extension overrides. */
  extensions?: ExtensionOverrides;
  /**
   * Names the runtime values a composed component exposes through its default
   * scoped slot, bringing them into scope of this node's projected
   * `children`. Valid only on a component-reference node (a capitalized tag);
   * each entry is a binding identifier the composed component's default slot
   * exposes (its `SlotNode.exposes` keys). The children may then reference
   * those identifiers freely.
   *
   * Per target: React wraps the children as a function child
   * (`{({ api }) => (...)}`), Vue emits `v-slot="{ api }"`, Svelte emits
   * `let:api`. The html target names it in the `<!-- component -->` comment. Only
   * the default slot is supported.
   */
  slotScope?: string[];
  /**
   * Content projected into a composed child's **named** slots, keyed by slot
   * name (the child's {@link SlotNode.name}); this node's `children` continue
   * to fill the default slot. Valid only on a component-reference node (a
   * capitalized tag). Each value is the projected content (an ordinary named
   * slot), or a `{ content, slotScope? }` object whose `slotScope` names the
   * bindings received from that named slot's exposed scope (a scoped named
   * slot), brought into scope of `content`.
   *
   * Per target: React passes each as the slot's prop (`closeButton={...}`, a
   * render prop `closeButton={({ row }) => ...}` when scoped); Vue emits
   * `<template #closeButton>` (`#closeButton="{ row }"` when scoped); Svelte
   * emits `<svelte:fragment slot="closeButton">` (`let:row` when scoped). HTML
   * mode renders it inside the `<!-- component -->` comments, between
   * `<!-- slot: closeButton -->` and `<!-- /slot -->`. The slot that
   * receives it is a {@link SlotNode} (a named, optionally scoped, slot).
   */
  slots?: Record<string, NamedSlotContent>;
  /**
   * Marks this element as the component's surface root: a consumer's
   * undeclared props/attributes spread onto it, a consumer-supplied
   * `className`/`class` and `style` merge into its class list and styles,
   * and it exposes a DOM handle (React ref-as-prop, Vue `$el`, Svelte a
   * bindable `element`). At most one element per component may set it, and
   * it must be the component's single root rendered element with an
   * intrinsic HTML tag. Under a root conditional it may instead be the one
   * element of each branch (a discriminated surface root), or the one
   * element of an `if` with no `else` or an empty one, so the component
   * renders nothing while the condition is false.
   *
   * On one element below that root, an object instead routes the consumer
   * attributes it names to this element rather than the root
   * ({@link PassthroughRouting}): a `<label>` root wrapping a native
   * `<input>` sends `aria-*`, the event handlers and `required` to the input,
   * while the class, style and DOM handle stay on the label (the handle can
   * follow the attributes with `handle: 'routed'`).
   */
  passthrough?: boolean | PassthroughRouting;
}

/**
 * Routes some of the consumer's attributes from a passthrough root to one
 * element below it: `passthrough: { attributes: ['aria-*', 'on*', 'required'] }`.
 * The listed attributes the component does not declare land on this element,
 * and everything else, `class`, `style` and `data-*` included, stays on the
 * root, with the DOM handle unless `handle` moves it here. The element's own
 * attributes win over the routed ones per key, as the root's do over the
 * rest.
 *
 * Each entry is one of:
 *
 * - `'*'` - every attribute except `class`, `style` and `data-*`;
 * - `'aria-*'` - every `aria-` attribute;
 * - `'on*'` - every event handler (`onChange`, `onblur`);
 * - an HTML attribute name in its HTML spelling, lowercase (`required`,
 *   `tabindex`, `autocomplete`), matched in each target's spelling
 *   (`tabIndex` in React).
 *
 * Allowed on one element per component, an intrinsic static tag, below a
 * single static-tag passthrough root.
 *
 * Where this element sets `aria-describedby`, `aria-labelledby`,
 * `aria-controls`, `aria-owns` or `aria-details` itself and the list routes
 * it, the consumer's value joins the element's own: the element's ids
 * first, then the consumer's, each once.
 */
export interface PassthroughRouting {
  /** The consumer attributes this element receives instead of the root. */
  attributes: readonly string[];
  /**
   * Where the DOM handle lands: `'root'` (the default) keeps it on the
   * passthrough root; `'routed'` moves it to this element, so a consumer's
   * React `ref`, Vue `$el` (and Vue's `element`, typed after the tag) and
   * Svelte `bind:element` reach the `<input>` a form library registers and
   * `focus()` moves to. Not allowed on an element inside an iteration.
   */
  handle?: 'root' | 'routed';
}

/**
 * Static or dynamic text.
 *
 * Exactly one of `content` | `expression` must be present. There is no
 * inline interpolation syntax: `{{ }}` inside `content` is literal text,
 * and mixed static/dynamic text is expressed as sibling text nodes.
 */
export interface TextNode {
  type: 'text';
  /** Static text. */
  content?: string;
  /** Dynamic text, e.g. `'user.name'` - a JavaScript expression. */
  expression?: string;
}

/**
 * A comment. Rendered as a comment in every target; never affects
 * semantics.
 */
export interface CommentNode {
  type: 'comment';
  content: string;
}

/**
 * Groups children without a wrapper element: React `<>...</>`, plain
 * sibling output elsewhere. A target block in `extensions` naming a `tag`
 * renders that element or component around the children in that target
 * alone, for a wrapper only some targets need (React's context provider,
 * Vue's `Teleport`).
 *
 * @example
 * const portal: FragmentNode = {
 *   type: 'fragment',
 *   extensions: {
 *     react: { tag: 'Portal' },
 *     vue: { tag: 'Teleport', attributes: { to: 'body' } },
 *   },
 *   children: [],
 * };
 */
export interface FragmentNode {
  type: 'fragment';
  children: TemplateNode[];
  /** The wrapper each scripted target renders around the children, if any. */
  extensions?: FragmentExtensionOverrides;
}

/**
 * One runtime value a slot exposes to its projected content (a scoped slot).
 *
 * The shorthand string form is the provider-scope JavaScript expression,
 * typed `any` in the generated React render-prop signature. The object form
 * adds an optional TypeScript `type` for that React signature and for the
 * Svelte runes snippet's (`Snippet<[{ row: Row }]>`); the type flows to a
 * consumer through inference from the composed component's slot prop.
 * `type` has no effect on Vue, legacy Svelte (whose `<slot>` scope is
 * untyped) or the html target.
 */
export type ExposedBinding = string | { value: string; type?: string };

/**
 * Content a composing node projects into one of a composed child's named slots
 * (see {@link ElementNode.slots}).
 *
 * The shorthand array form is the projected content (an ordinary named slot).
 * The object form adds `slotScope` - binding names received from that named
 * slot's exposed scope (a scoped named slot), brought into scope of `content`,
 * the same mechanism as {@link ElementNode.slotScope} for the default slot.
 */
export type NamedSlotContent =
  | TemplateNode[]
  | { content: TemplateNode[]; slotScope?: string[] };

/**
 * A content projection point.
 *
 * The html target renders `fallback` between `<!-- slot -->` and `<!-- /slot -->`
 * comments;
 * React uses the `{children}` / `{slots.<name>}` prop convention; Vue and
 * Svelte render `<slot>` elements. Fallbacks must not contain slot nodes.
 *
 * A slot may expose runtime values to its projected content (`exposes`),
 * making it a scoped slot: React types the slot prop as a render function
 * or plain content (`children?: ReactNode | ((scope) => ReactNode)`), calling
 * a function with the scope and rendering anything else (only a function
 * when the slot sets `scopeRequired`), Vue binds them on
 * the `<slot>` (`<slot :api="api" />`), and Svelte binds them likewise
 * (`<slot api={api} />`). A composing node receives them through
 * {@link ElementNode.slotScope}.
 */
export interface SlotNode {
  type: 'slot';
  /**
   * The slot name; omitted = default slot. A slot named `'default'` is a
   * validation error - the default slot is the one without a name.
   */
  name?: string;
  /** Rendered when nothing is projected. */
  fallback?: TemplateNode[];
  /**
   * Runtime values this slot exposes to its projected content, keyed by the
   * scope binding name consumers see. Each value is the provider-scope
   * expression (and, in the object form, an optional React type). Absent =
   * an ordinary, non-scoped slot.
   */
  exposes?: Record<string, ExposedBinding>;
  /**
   * Whether projected content must take this slot's scope: content that does
   * not read the exposed values cannot work, as with a trigger that has to
   * spread the props it is given. React types the slot prop as the render
   * function alone (`trigger?: (scope) => ReactNode`), so plain content is a
   * type error, and renders the fallback when no function is given. Svelte
   * runes already types the snippet as a function of the scope; Vue and
   * legacy Svelte cannot refuse slot content that ignores the scope, so there
   * it is documentation. The html target is unaffected. Valid only on a slot with
   * `exposes`.
   */
  scopeRequired?: boolean;
}

/** A branch statement in a conditional. */
export type ConditionalStatement = 'if' | 'else-if' | 'else';

/**
 * One branch of a conditional.
 *
 * `condition` is required except for `'else'`.
 *
 * `props` declares props scoped to this branch - used only when the
 * conditional is a component's discriminated surface root (each branch a
 * single `passthrough` element of a different intrinsic tag). The props
 * assemble into a discriminated union: each branch contributes its element's
 * typed surface plus these branch props, typically the discriminant: a literal
 * type (`visual: { type: 'true' }`), or for a branch picked by a prop's
 * presence the prop it requires (`href: { type: 'string', required: true }`).
 * Props shared across branches
 * stay on the component (`ComponentNode.props`); a name that is content in one
 * branch and a native attribute in another lives as a shared prop bound
 * explicitly per branch, never as a branch prop.
 */
export interface ConditionalBranch {
  statement: ConditionalStatement;
  /** A JavaScript expression. */
  condition?: string;
  /** Props scoped to this branch of a discriminated surface root. */
  props?: Record<string, PropDefinition>;
  children: TemplateNode[];
}

/**
 * A conditional with a unified branch list.
 *
 * The statement sequence is validated: `if` first, then any number of
 * `else-if`, optional trailing `else`.
 */
export interface ConditionalNode {
  type: 'conditional';
  conditions: ConditionalBranch[];
}

/**
 * A loop.
 *
 * Renders as `.map()` in React, `v-for` in Vue, `{#each}` in Svelte; HTML
 * mode renders children once as a sample between `<!-- for -->` comments
 * naming the item, index and key.
 */
export interface IterationNode {
  type: 'iteration';
  /** An expression evaluating to an iterable: `'users'`. */
  items: string;
  /** The loop variable name: `'user'`. */
  item: string;
  /** Optional index variable name: `'i'`. */
  index?: string;
  /** Optional expression for stable identity: `'user.id'`. */
  key?: string;
  children: TemplateNode[];
}

/**
 * The optional root wrapper carrying component metadata. Validation
 * rejects `component` nodes anywhere but the template root.
 */
/**
 * Where a component's leftover attributes land: the attributes a consumer
 * passes that are not declared props, gathered into one value named `rest`,
 * typed as the attributes of `tag`. The author places it, with a `$spread` of
 * `rest` on any node (inside a scoped slot included) or by passing it to a
 * helper. It carries the consumer's `class` (`className` in React) and `style`
 * unmerged, and in React its `ref`.
 *
 * @example
 * ```ts
 * defineTemplate({
 *   type: 'component',
 *   name: 'Select',
 *   rest: { tag: 'div' },
 *   children: [
 *     {
 *       type: 'element',
 *       tag: 'SelectDriver',
 *       slotScope: ['api'],
 *       children: [
 *         {
 *           type: 'element',
 *           tag: 'SelectVisual',
 *           attributes: { $spread: { $expression: 'mergeRootProps(api.getRootProps(), rest)' } },
 *         },
 *       ],
 *     },
 *   ],
 * });
 * ```
 */
export interface RestDefinition {
  /** The intrinsic tag whose attributes the leftover attributes are typed as. */
  tag: string;
}

/**
 * A type parameter of a generic component: a name, or a name with a
 * `constraint` and a `default`, each a TypeScript type written verbatim.
 * Prop types, scoped-slot `exposes` types and the component's imports may
 * reference it. Each scripted target emits its generic form; the html target
 * ignores it.
 *
 * @example
 * ```ts
 * defineTemplate({
 *   type: 'component',
 *   name: 'List',
 *   typeParameters: ['Item'],
 *   props: { items: { type: 'Item[]', required: true } },
 *   children: [ ... ],
 * });
 * // React:  export function List<Item>(props: ListProps<Item>)
 * // Vue:    <script setup lang="ts" generic="Item">
 * // Svelte: <script lang="ts" generics="Item">
 * ```
 */
export type TypeParameter =
  | string
  | { name: string; constraint?: string; default?: string };

/**
 * A per-instance id in its object form: the literal `prefix` the generated
 * id starts with and, optionally, the string prop whose value the consumer
 * gives in its place.
 *
 * @example
 * ```ts
 * ids: { inputId: { prefix: 'field', prop: 'id' } }
 * // inputId is the consumer's `id` when given, else a generated `field-...`
 * ```
 */
export interface DeclaredId {
  /** The literal start of the generated id, such as `'field'`. */
  prefix: string;
  /**
   * A declared string prop whose value, when the consumer gives it, is used
   * instead of the generated id. Left out or `undefined`, the generated id
   * applies.
   */
  prop?: string;
}

export interface ComponentNode {
  type: 'component';
  /** The component name: `'Button'` → `Button.tsx` / `Button.vue` / ... */
  name: string;
  /**
   * What the component is and when to reach for it, written as the generated
   * component's doc comment in every scripted target, so a consumer's editor
   * shows it on hover, and readable here by tooling such as a kit's docs or
   * preview. Markdown is allowed.
   */
  description?: string;
  /** Component props. */
  props?: Record<string, PropDefinition>;
  /**
   * Verbatim module-scope lines. Import statements keep their place; any
   * other declaration (a constant, a counter, a context, an exported type) is
   * emitted at module scope in every scripted target, so it runs once per
   * module and its instances share it.
   */
  imports?: string[];
  /** Framework-agnostic JS (handlers, utils). */
  script?: string;
  /**
   * Values the component computes from its props, written once: each name
   * with the expression that computes it, in order. The template and the
   * component script read each by its name in every target, and it follows
   * what it reads: a `const` in React, a `computed` in Vue, a `$:`
   * declaration in legacy Svelte and a `$derived` in Svelte runes. The html target
   * names it in a comment, and an instance render evaluates it.
   *
   * An expression reads props, two-way values (a bindable's `current`),
   * declared `ids`, derived values declared before it and the declarations
   * in `imports`,
   * never a name only the component script declares. No script writes a
   * derived value.
   *
   * @example
   * ```ts
   * derived: {
   *   visibleRows: 'rows.filter((row) => row.name.includes(filterText))',
   *   allSelected: 'visibleRows.length > 0 && visibleRows.every((row) => row.selected)',
   * }
   * ```
   */
  derived?: Record<string, string>;
  /**
   * Ids the component generates once per instance, for wiring such as
   * `aria-controls`, `aria-labelledby` or a radio group's `name`: each name
   * with the literal prefix the id starts with, or `{ prefix, prop }` to let
   * a string prop the consumer gives replace it. The template, the
   * component script and derived values read each by its name, like a prop,
   * in every target. React takes it from `useId()`, Vue from `useId()`,
   * Svelte runes from `$props.id()` and legacy Svelte from a counter every
   * component on the page shares, each after the prefix. The html target and an instance render write
   * `prefix-1`, `prefix-2` and so on, counted through the page they render.
   *
   * @example
   * ```ts
   * ids: {
   *   listId: 'command',
   *   inputId: { prefix: 'field', prop: 'id' },
   * }
   * ```
   */
  ids?: Record<string, string | DeclaredId>;
  /** Component-level CSS, distributed to children. */
  style?: string;
  children: TemplateNode[];
  /** Component-level per-extension overrides. */
  extensions?: ComponentExtensionOverrides;
  /**
   * Where the consumer's leftover attributes land, as one value named `rest`
   * typed after `tag`. Not combined with a `passthrough` root.
   */
  rest?: RestDefinition;
  /**
   * The component's type parameters, in order, for a component generic over
   * a type its consumer supplies - the item type of a list, say.
   */
  typeParameters?: TypeParameter[];
  /**
   * The components that make up this one as a compound, by name: the parts a
   * consumer places inside it (`DialogTrigger`, `DialogContent`) or the
   * modules it composes from (a hand-written driver). Rendering ignores the
   * list; tooling reads it, so a kit's consumer command can place a part
   * beside its compound and copy the compound whole. Each name is another
   * component of the kit, and a part belongs to one compound.
   *
   * @example
   * ```ts
   * defineTemplate({
   *   type: 'component',
   *   name: 'Dialog',
   *   parts: ['DialogTrigger', 'DialogContent', 'DialogClose'],
   *   children: [ ... ],
   * });
   * ```
   */
  parts?: string[];
}

/**
 * Any template node.
 *
 * Every node has a `type` discriminant; unknown `type` values are a
 * validation error. `ComponentNode` is structurally part of the union but
 * only valid at the template root.
 */
export type TemplateNode =
  | ComponentNode
  | ElementNode
  | TextNode
  | CommentNode
  | FragmentNode
  | SlotNode
  | ConditionalNode
  | IterationNode;

/**
 * A complete template: either a root `ComponentNode` or a bare node array.
 * Templates without a component wrapper are valid; the engine uses a
 * default component name from options.
 */
export type Template = ComponentNode | TemplateNode[];
