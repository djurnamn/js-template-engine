import type { ExpressionBinding } from './attributes';

/**
 * A nested selector block inside a style object: the value of a
 * pseudo-selector, at-rule, or parent-modifier key.
 *
 * Nesting composes recursively - at-rules, pseudo-selectors, and
 * parent-modifier selectors may contain one another, with at-rules wrapping
 * outermost in the emitted CSS. Selector blocks always emit to a
 * stylesheet, so their values are static only: `$expression` bindings are
 * invalid inside them (stylesheets cannot hold runtime values).
 *
 * An `@include ...` at-rule key carries a Sass mixin include - compile-time
 * source. Its value encodes whether a content block is passed: `true` (or an
 * empty object) emits a no-content `@include name;` statement, while a
 * non-empty object emits `@include name { ... }` with that object as the
 * content block. Like a selector block, it is valid inside nested blocks.
 */
export interface NestedSelectorBlock {
  /** `$expression` is engine-reserved and invalid inside selector blocks. */
  $expression?: never;
  /**
   * @deprecated Use an `@include ...` at-rule key instead
   * (`'@include name': true` for a no-content include). Sass `@include`
   * statement(s), emitted verbatim under `styling.language: 'scss'`. A
   * compile-time-opaque string, or an array for several includes in authored
   * order; never produces a CSS declaration.
   */
  $include?: string | string[];
  [propertyOrSelector: string]:
    | string
    | number
    | boolean
    | string[]
    | NestedSelectorBlock
    | undefined;
}

/**
 * A nested style object.
 *
 * Accepts plain CSS properties (camelCase or kebab-case), pseudo-selectors
 * (`':hover'`), media queries (`'@media (max-width: 768px)'`), and
 * parent-modifier selectors (`'.button--large &'`) as keys. Nested selectors
 * always require a stylesheet and therefore force a class-based selector for
 * the node.
 *
 * Top-level plain properties - CSS custom properties included - may carry
 * `$expression` values; these render through the target framework's dynamic
 * style mechanism and never enter generated CSS. To make the entire style
 * dynamic, give the object a top-level `$expression` key (a string
 * expression evaluating to a plain object of property→value pairs). It may
 * **coexist** with static properties, `$include`/`@include`, nested
 * selectors, and per-property `$expression` values on the same node: static
 * and nested keys route to the stylesheet (or inline per strategy) as usual,
 * while the whole-object expression renders through the dynamic mechanism.
 * Where both reach the same inline mechanism, the merge order is
 * whole-object first (the base layer), then authored static / per-property
 * values, then any passthrough consumer `style` (later wins).
 *
 * An `@include ...` at-rule key carries a Sass mixin include - the inverse of
 * `$expression`: compile-time source (not runtime), legal in any block
 * including nested selector blocks. Its value encodes whether a content
 * block is passed:
 *
 * - `'@include name': true` (or `{}`) → `@include name;` (no content)
 * - `'@include name': { ... }` → `@include name { ... }` (the object is the
 *   content block)
 *
 * Includes are emitted in authored order, interleaved with sibling
 * declarations, so an include followed by an overriding declaration cascades
 * as written. Under `styling.language: 'scss'` they pass through for the
 * consumer's own sass build; under `'css'` (or the `inline` strategy) the
 * engine resolves them against `styling.loadPaths`.
 *
 * @example
 * const style: NestedStyleObject = {
 *   '@include name': true,
 *   color: 'blue',
 *   fontSize: '16px',
 *   '--badge-size': { $expression: "size + 'rem'" },
 *   ':hover': { '@include elevation': { boxShadow: 'none' } },
 *   '@media (max-width: 768px)': { fontSize: '14px' },
 * };
 */
export interface NestedStyleObject {
  /**
   * A whole-object style expression: a string evaluating to a plain object of
   * camelCase CSS property→value pairs, rendered through the target's dynamic
   * style mechanism. May coexist with static properties, includes, nested
   * selectors, and per-property `$expression` values on the same node (see the
   * interface summary for the merge order). Banned inside nested selector
   * blocks - stylesheets cannot hold runtime values.
   */
  $expression?: string;
  /**
   * @deprecated Use an `@include ...` at-rule key instead
   * (`'@include name': true` for a no-content include). Sass `@include`
   * statement(s), emitted verbatim under `styling.language: 'scss'`. A
   * compile-time-opaque string, or an array for several includes in authored
   * order; never produces a CSS declaration. Under `styling.language: 'css'`
   * the engine resolves it against `styling.loadPaths`.
   */
  $include?: string | string[];
  [propertyOrSelector: string]:
    | string
    | number
    | boolean
    | string[]
    | ExpressionBinding
    | NestedSelectorBlock
    | undefined;
}
