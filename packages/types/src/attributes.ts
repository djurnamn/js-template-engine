import type { NestedStyleObject } from './styles';

/**
 * A dynamic attribute binding.
 *
 * The `$` sigil marks the key as engine-reserved: `$expression` can never be
 * a legitimate CSS property, class name, or HTML attribute, so the wrapper is
 * unambiguous against every other value shape in the format. The expression
 * is a JavaScript expression, treated as an opaque string and emitted
 * verbatim into the target syntax - the engine never parses or evaluates it.
 *
 * @example
 * const attributes: Attributes = {
 *   alt: 'Avatar',
 *   width: 48,
 *   src: { $expression: 'props.avatarUrl' },
 * };
 */
export interface ExpressionBinding {
  $expression: string;
}

/**
 * A static or dynamic attribute value.
 *
 * Booleans render as presence/absence: `{ disabled: true }` produces
 * `disabled` and `{ disabled: false }` omits the attribute.
 */
export type AttributeValue = string | number | boolean | ExpressionBinding;

/**
 * One entry of the `class` array form: a literal class name or an
 * `$expression` binding contributing runtime classes.
 */
export type ClassEntry = string | ExpressionBinding;

/**
 * The single attribute map for both static and dynamic values.
 *
 * `class` and `style` have dedicated shapes. Both accept `$expression`
 * bindings in constrained forms - expression entries in the class list (or
 * as its sole value), expression values on top-level style properties, or a
 * top-level `$expression` key carrying the whole-object expression (which may
 * coexist with static and nested keys). The reserved `$spread` key spreads a
 * named runtime object's own properties onto the element (or composed
 * component) ahead of the authored attributes. *Condition-gated* classes and
 * styles go through `conditionalAttributes` instead, which carries the
 * condition explicitly and is literal-only.
 */
export interface Attributes {
  /**
   * Classes. The array form is canonical; the string form is accepted,
   * normalized, and literal-only. Array entries - or the sole value - may
   * be `$expression` bindings: expression classes render after every other
   * class source, in authored order among themselves, and a falsy
   * expression value contributes nothing at runtime.
   */
  class?: string | ClassEntry[] | ExpressionBinding;
  /**
   * Nested style object. A top-level `$expression` key carries a whole-object
   * expression evaluating to a plain object of camelCase CSS property→value
   * pairs; it may stand alone or coexist with static properties, includes,
   * nested selectors, and per-property `$expression` values on the same node.
   */
  style?: NestedStyleObject;
  /**
   * Object spread. Each {@link ExpressionBinding} names a runtime object whose
   * own enumerable properties are spread onto this element (or, on a
   * component-reference node, its props): React `{...x}`, Vue `v-bind="x"`,
   * Svelte `{...x}`. An array spreads several objects in order. Spreads lead
   * the node's attributes - authored attributes, classes, and styles follow
   * and override per key (consumers add, they do not replace). Unlike the
   * passthrough root's undeclared-rest spread, `$spread` targets a *named* object
   * and is allowed on any element, not the root alone. HTML mode is inert (no
   * runtime consumer).
   */
  $spread?: ExpressionBinding | ExpressionBinding[];
  [attribute: string]:
    | AttributeValue
    | ClassEntry[]
    | NestedStyleObject
    | undefined;
}

/**
 * Condition-gated attributes.
 *
 * Renders as a generated class expression in React, `:class` object syntax
 * in Vue, and `class:` directives in Svelte; HTML mode omits them from
 * markup (warning emitted) but still generates CSS for the referenced
 * classes.
 *
 * `class` and `style` are literal-only here - the condition is their
 * dynamism; `$expression` values inside conditional attributes are a
 * validation error.
 *
 * @example
 * const conditional: ConditionalAttributes = {
 *   condition: "size === 'large'",
 *   attributes: { class: ['btn--lg'], style: { fontSize: '1.25rem' } },
 * };
 */
export interface ConditionalAttributes {
  /** A JavaScript expression. */
  condition: string;
  /** The attributes applied when the condition holds. */
  attributes: Attributes;
}
