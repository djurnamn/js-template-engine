import type { ExpressionBinding } from './attributes';

/**
 * A nested selector block inside a style object: the value of a
 * pseudo-selector, at-rule, or parent-modifier key.
 *
 * Nesting composes recursively — at-rules, pseudo-selectors, and
 * parent-modifier selectors may contain one another, with at-rules wrapping
 * outermost in the emitted CSS. Selector blocks always emit to a
 * stylesheet, so their values are static only: `$expression` bindings are
 * invalid inside them (stylesheets cannot hold runtime values).
 *
 * A `$include` key carries Sass `@include` statement(s) — compile-time
 * source emitted verbatim under `styling.language: 'scss'`. Unlike
 * `$expression`, it *is* valid inside selector blocks (it resolves at the
 * consumer's sass build, not at runtime).
 */
export interface NestedSelectorBlock {
  /** `$expression` is engine-reserved and invalid inside selector blocks. */
  $expression?: never;
  /**
   * Sass `@include` statement(s), emitted verbatim under
   * `styling.language: 'scss'`. A compile-time-opaque string, or an array
   * for several includes in authored order; never produces a CSS
   * declaration.
   */
  $include?: string | string[];
  [propertyOrSelector: string]:
    | string
    | number
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
 * Top-level plain properties — CSS custom properties included — may carry
 * `$expression` values; these render through the target framework's dynamic
 * style mechanism and never enter generated CSS. To make the entire style
 * dynamic, use an `$expression` binding as the whole `style` value instead
 * (mixing `$expression` with other keys is invalid).
 *
 * A `$include` key carries Sass `@include` statement(s) — the inverse of
 * `$expression`: compile-time-opaque source (not runtime), legal in any
 * block including nested selector blocks, emitted verbatim under
 * `styling.language: 'scss'`.
 *
 * @example
 * const style: NestedStyleObject = {
 *   $include: "typography('body')",
 *   color: 'blue',
 *   fontSize: '16px',
 *   '--badge-size': { $expression: "size + 'rem'" },
 *   ':hover': { backgroundColor: '#0056b3' },
 *   '@media (max-width: 768px)': { fontSize: '14px' },
 * };
 */
export interface NestedStyleObject {
  /**
   * `$expression` is engine-reserved and never a valid style key. A fully
   * dynamic style is an `ExpressionBinding` in place of the style object,
   * not a key inside it.
   */
  $expression?: never;
  /**
   * Sass `@include` statement(s), emitted verbatim under
   * `styling.language: 'scss'`. A compile-time-opaque string, or an array
   * for several includes in authored order; never produces a CSS
   * declaration. A processing error under `styling.language: 'css'` (no
   * sass build to resolve it).
   */
  $include?: string | string[];
  [propertyOrSelector: string]:
    | string
    | number
    | string[]
    | ExpressionBinding
    | NestedSelectorBlock
    | undefined;
}
