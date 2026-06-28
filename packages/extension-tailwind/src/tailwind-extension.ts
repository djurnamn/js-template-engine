import {
  normalizeClassList,
  type StylingContext,
  type StylingExtension,
} from '@js-template-engine/core';
import type { ElementNode, NestedStyleObject } from '@js-template-engine/types';

import { convertUtilityClasses } from './conversion/convert';
import { convertStyleToUtilities } from './conversion/from-styles';

/** Options for the Tailwind styling extension. */
export interface TailwindOptions {
  /**
   * What the extension contributes to each element from its
   * `extensions.tailwind.classes` override:
   *
   * - `'classes'` (default) - the utility classes pass through verbatim
   *   into the rendered class list, for processing by Tailwind's own
   *   build.
   * - `'styles'` - no classes are contributed; the utilities are resolved
   *   against the bundled Tailwind v4 default theme into the element's
   *   style object, so the generated output needs no Tailwind build.
   */
  output?: 'classes' | 'styles';
  /**
   * When `true`, the inverse of `output: 'styles'`: each element's authored
   * `style` object is converted into Tailwind utility classes - resolved
   * against the same bundled v4 default theme - and no longer emits as CSS.
   * Off-scale values become arbitrary values (`p-[3px]`); properties with no
   * utility family become arbitrary properties (`[mask-type:luminance]`).
   * Per-property `$expression` values cannot become static utilities and
   * stay on the element's `style`. Defaults to `false`, leaving authored
   * styles untouched. Independent of `output`.
   */
  convertStyles?: boolean;
}

/** The Tailwind styling extension. */
export interface TailwindExtension extends StylingExtension {
  readonly key: 'tailwind';
}

/**
 * Creates the Tailwind styling extension.
 *
 * Reads each element node's `extensions.tailwind.classes` override. Under
 * the default `output: 'classes'`, the utility classes are appended after
 * the node's static classes in declared order and pass through verbatim - 
 * variants are spelled inline (`md:px-6`, `hover:bg-blue-700`) and the
 * generated markup is meant to be processed by Tailwind's own build.
 *
 * Under `output: 'styles'` the utilities are instead converted into the
 * element's style object: values resolve against the bundled Tailwind v4
 * default theme, variants become nested pseudo-selector and at-rule
 * blocks, and the result rides the normal styling pipeline (output
 * strategies, selector targeting, every framework target), with the
 * element's authored `style` properties winning conflicts. The supported
 * subset is the self-contained one - utilities that resolve to plain
 * declarations on their own node; anything else is a processing error.
 *
 * Tailwind classes are utilities - shared across nodes by design - so
 * generated CSS never uses them as selectors.
 *
 * @example
 * const result = process(template, { extensions: [react(), tailwind()] });
 * @example
 * // Self-contained CSS instead of utility classes:
 * const result = process(template, {
 *   extensions: [react(), tailwind({ output: 'styles' })],
 * });
 */
export function tailwind(options: TailwindOptions = {}): TailwindExtension {
  const output = options.output ?? 'classes';
  const convertStyles = options.convertStyles ?? false;
  return {
    key: 'tailwind',
    kind: 'styling',
    classKind: 'utility',
    contributeClasses(element: ElementNode): readonly string[] {
      if (output === 'styles') {
        return [];
      }
      return normalizeClassList(element.extensions?.tailwind?.classes);
    },
    convertStyleToClasses(element: ElementNode, context: StylingContext) {
      if (!convertStyles) {
        return undefined;
      }
      const style = element.attributes?.style;
      // A pure whole-object expression holds no static declarations to lift;
      // `convertStyleToUtilities` keeps `$expression` in the remaining style
      // and yields no classes for it, so a mixed node still lifts its static
      // part and a pure whole-object falls through to the empty-classes guard.
      if (style === undefined) {
        return undefined;
      }
      const { classes, remainingStyle } = convertStyleToUtilities(
        style,
        (message) => context.fail(message)
      );
      if (classes.length === 0) {
        return undefined;
      }
      return { classes, remainingStyle };
    },
    contributeStyles(
      element: ElementNode,
      context: StylingContext
    ): NestedStyleObject | undefined {
      if (output === 'classes') {
        return undefined;
      }
      const classes = normalizeClassList(
        element.extensions?.tailwind?.classes
      );
      if (classes.length === 0) {
        return undefined;
      }
      return convertUtilityClasses(classes, (message) =>
        context.fail(message)
      );
    },
  };
}
