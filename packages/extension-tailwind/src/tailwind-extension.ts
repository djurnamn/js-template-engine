import {
  classExpressions,
  normalizeClassList,
  type StylingContext,
  type StylingExtension,
} from '@js-template-engine/core';
import type { ElementNode, NestedStyleObject } from '@js-template-engine/types';

import {
  convertUtilityClasses,
  looksLikeUtilityClass,
} from './conversion/convert';
import { convertStyleToUtilities } from './conversion/from-styles';
import { registeredPropertyRules } from './conversion/registered-properties';
import { isDarkSelector, isGroupMarker } from './conversion/variants';

/** Options for the Tailwind styling extension. */
export interface TailwindOptions {
  /**
   * What the extension contributes to each element from its
   * `extensions.tailwind.classes` override:
   *
   * - `'classes'` (default) - the utility classes pass through verbatim
   *   into the rendered class list, for processing by Tailwind's own
   *   build.
   * - `'styles'` - the utilities are resolved against the bundled Tailwind
   *   v4 default theme into the element's style object, so the generated
   *   output needs no Tailwind build. The only classes contributed are the
   *   `group` and `peer` markers (`group`, `peer/email`), which the
   *   `group-*` and `peer-*` variants select. A
   *   utility-looking class in the element's `conditionalAttributes` or in
   *   a class expression is not converted and gets a warning.
   */
  output?: 'classes' | 'styles';
  /**
   * Under `output: 'styles'`, the selector `dark:` utilities are written
   * under, in place of the default `@media (prefers-color-scheme: dark)`, so
   * dark mode can follow a class or attribute the page sets. A selector
   * holding `&` composes as Tailwind v4's `@custom-variant dark (...)`
   * does, `&` standing for the element (`':root[data-mode="dark"] &'`). A
   * selector without `&` names a state of the page's root element:
   * `'.dark'` becomes `:where(:root:is(.dark)) &`, adding no specificity; a
   * selector with `&` keeps the specificity it spells. Under `convertStyles`, a
   * nested style key spelling the composed selector converts
   * back to `dark:`, and the `prefers-color-scheme` media query is no
   * longer `dark:`. Otherwise ignored under `output: 'classes'`, where
   * Tailwind's own build reads the variant.
   */
  darkSelector?: string;
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
 * blocks (`group-*` and `peer-*` a selector reaching the marked ancestor or
 * sibling, whose `group` or `peer` marker class stays), and the result rides the normal styling pipeline (every
 * stylesheet placement, selector targeting, every target), with the
 * element's authored `style` properties winning conflicts. The supported
 * subset is the self-contained one - utilities that resolve to plain
 * declarations on their own node; anything else is a processing error,
 * every unconvertible utility of the run reported together. A class in
 * `conditionalAttributes` or a class expression is never converted, and
 * one that looks like a utility gets a warning.
 *
 * Converted utilities that read Tailwind's composed custom properties
 * (shadows, rings, outline widths, numeric variants) bring the `@property`
 * registrations Tailwind emits for them, once in the component's
 * stylesheet, so those properties start at their initial values and do not
 * inherit.
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
 * @example
 * // dark: follows a data-mode="dark" attribute on the page root:
 * tailwind({ output: 'styles', darkSelector: ':root[data-mode="dark"] &' });
 */
export function tailwind(options: TailwindOptions = {}): TailwindExtension {
  const output = options.output ?? 'classes';
  const convertStyles = options.convertStyles ?? false;
  const darkSelector = validateDarkSelector(options.darkSelector);
  return {
    key: 'tailwind',
    kind: 'styling',
    overrideKeys: { node: ['classes'] },
    classKind: 'utility',
    contributeClasses(element: ElementNode): readonly string[] {
      const classes = normalizeClassList(element.extensions?.tailwind?.classes);
      return output === 'styles' ? classes.filter(isGroupMarker) : classes;
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
        (message) => context.fail(message),
        { darkSelector }
      );
      if (classes.length === 0) {
        return undefined;
      }
      return { classes, remainingStyle };
    },
    contributeComponentCss(
      contributedStyles: readonly NestedStyleObject[]
    ): string | undefined {
      return output === 'styles'
        ? registeredPropertyRules(contributedStyles)
        : undefined;
    },
    contributeStyles(
      element: ElementNode,
      context: StylingContext
    ): NestedStyleObject | undefined {
      if (output === 'classes') {
        return undefined;
      }
      warnUnconvertedUtilities(element, context);
      const classes = normalizeClassList(
        element.extensions?.tailwind?.classes
      ).filter((candidate) => !isGroupMarker(candidate));
      if (classes.length === 0) {
        return undefined;
      }
      return convertUtilityClasses(
        classes,
        (message) =>
          context.error === undefined
            ? context.fail(message)
            : context.error(message),
        { darkSelector }
      );
    },
  };
}

/**
 * Checks the `darkSelector` option with {@link isDarkSelector}.
 */
function validateDarkSelector(
  darkSelector: string | undefined
): string | undefined {
  if (darkSelector === undefined) {
    return undefined;
  }
  if (!isDarkSelector(darkSelector)) {
    throw new Error(
      `tailwind({ darkSelector }) takes a selector, such as '[data-mode="dark"]' or ':root[data-mode="dark"] &', with & in every member of a list or in none; received ${JSON.stringify(darkSelector)}`
    );
  }
  return darkSelector.trim();
}

/**
 * Warns about the utility-looking classes `output: 'styles'` leaves
 * unconverted on an element: those in its `conditionalAttributes`, and
 * those in the string literals of its class expressions.
 */
function warnUnconvertedUtilities(
  element: ElementNode,
  context: StylingContext
): void {
  const conditionalClasses = (element.conditionalAttributes ?? []).flatMap(
    (conditional) => normalizeClassList(conditional.attributes.class)
  );
  const expressionClasses = [
    element.attributes?.class,
    ...(element.conditionalAttributes ?? []).map(
      (conditional) => conditional.attributes.class
    ),
  ]
    .flatMap((value) => classExpressions(value))
    .flatMap(stringLiteralContents);
  const report = (source: string, candidates: readonly string[]) => {
    const utilities = [
      ...new Set(
        candidates
          .flatMap((candidate) => candidate.split(/\s+/))
          .filter((candidate) => candidate !== '')
          .filter(looksLikeUtilityClass)
      ),
    ];
    if (utilities.length > 0) {
      context.warn(
        `Tailwind utilities in ${source} are not converted under output: 'styles' ` +
          `and stay class names with no CSS behind them: ` +
          `${utilities.map((utility) => `'${utility}'`).join(', ')}. ` +
          'Give a condition its styles as a conditionalAttributes entry that pairs a ' +
          "class of your own with a style instead; the style becomes that class's rule"
      );
    }
  };
  report('conditionalAttributes', conditionalClasses);
  report('a class expression', expressionClasses);
}

/**
 * The text of each string literal in an expression that can become part of
 * the class - quoted strings and the static parts of template literals -
 * leaving out an operand of a comparison (`variant === 'primary'`), which
 * is never a class.
 */
function stringLiteralContents(expression: string): string[] {
  const contents: string[] = [];
  const literal =
    /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  const comparison = /^(?:===?|!==?)/;
  for (const match of expression.matchAll(literal)) {
    const before = expression.slice(0, match.index).trimEnd();
    const after = expression.slice(match.index + match[0].length).trimStart();
    if (/(?:===?|!==?)$/.test(before) || comparison.test(after)) {
      continue;
    }
    contents.push(
      match[1] ?? match[2] ?? match[3].replace(/\$\{[^}]*\}/g, ' ')
    );
  }
  return contents;
}
