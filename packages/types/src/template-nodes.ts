import type { Attributes, ConditionalAttributes } from './attributes';
import type { EventDefinition } from './events';
import type {
  ComponentExtensionOverrides,
  ExtensionOverrides,
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
 * runtime tag — an intrinsic tag string or a component identifier.
 * `default` is a required static tag: the basis for the HTML-mode static
 * preview, the void/children validation check, and — on a passthrough
 * surface root — the typed prop surface. The engine never injects `default`
 * as a runtime fallback; an author wanting one writes it into the
 * expression. Allowed only on a component's single root rendered element.
 */
export interface DynamicTag {
  /** The runtime tag expression, e.g. `'as'` — a JavaScript expression. */
  $expression: string;
  /** The static fallback tag — preview, validation, and typing basis. */
  default: string;
}

export interface ElementNode {
  type: 'element';
  /**
   * The tag name: `'div'`, `'button'`, `'svg'`, ... A `DynamicTag` resolves
   * the tag from a runtime expression instead (root element only).
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
   * Marks this element as the component's surface root: a consumer's
   * undeclared props/attributes spread onto it, a consumer-supplied
   * `className`/`class` and `style` merge into its class list and styles,
   * and it exposes a DOM handle (React ref-as-prop, Vue `$el`, Svelte a
   * bindable `element`). At most one element per component may set it, and
   * it must be the component's single root rendered element with an
   * intrinsic HTML tag.
   */
  passthrough?: boolean;
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
  /** Dynamic text, e.g. `'user.name'` — a JavaScript expression. */
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
 * sibling output elsewhere.
 */
export interface FragmentNode {
  type: 'fragment';
  children: TemplateNode[];
}

/**
 * A content projection point.
 *
 * HTML mode renders `fallback` (slots have no consumer in static HTML);
 * React uses the `{children}` / `{slots.<name>}` prop convention; Vue and
 * Svelte render `<slot>` elements. Fallbacks must not contain slot nodes.
 */
export interface SlotNode {
  type: 'slot';
  /** The slot name; omitted = default slot. */
  name?: string;
  /** Rendered when nothing is projected. */
  fallback?: TemplateNode[];
}

/** A branch statement in a conditional. */
export type ConditionalStatement = 'if' | 'else-if' | 'else';

/**
 * One branch of a conditional.
 *
 * `condition` is required except for `'else'`.
 */
export interface ConditionalBranch {
  statement: ConditionalStatement;
  /** A JavaScript expression. */
  condition?: string;
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
 * mode renders children once as a static sample wrapped in debug comments.
 */
export interface IterationNode {
  type: 'iteration';
  /** An expression evaluating to an iterable: `'props.users'`. */
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
export interface ComponentNode {
  type: 'component';
  /** The component name: `'Button'` → `Button.tsx` / `Button.vue` / ... */
  name: string;
  /** Component props. */
  props?: Record<string, PropDefinition>;
  /** Verbatim import statements. */
  imports?: string[];
  /** Framework-agnostic JS (handlers, utils). */
  script?: string;
  /** Component-level CSS, distributed to children. */
  style?: string;
  children: TemplateNode[];
  /** Component-level per-extension overrides. */
  extensions?: ComponentExtensionOverrides;
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
