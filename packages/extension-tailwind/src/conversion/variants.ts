import { BREAKPOINTS } from './default-theme';

/** Raises a processing error for an unconvertible candidate. */
export type ConversionFail = (message: string) => never;

const PSEUDO_CLASS_VARIANTS: Record<string, string> = {
  focus: ':focus',
  'focus-visible': ':focus-visible',
  'focus-within': ':focus-within',
  active: ':active',
  visited: ':visited',
  target: ':target',
  first: ':first-child',
  last: ':last-child',
  only: ':only-child',
  odd: ':nth-child(odd)',
  even: ':nth-child(even)',
  'first-of-type': ':first-of-type',
  'last-of-type': ':last-of-type',
  'only-of-type': ':only-of-type',
  empty: ':empty',
  disabled: ':disabled',
  enabled: ':enabled',
  checked: ':checked',
  indeterminate: ':indeterminate',
  required: ':required',
  optional: ':optional',
  valid: ':valid',
  invalid: ':invalid',
  'read-only': ':read-only',
  'placeholder-shown': ':placeholder-shown',
};

const PSEUDO_ELEMENT_VARIANTS: Record<string, string> = {
  placeholder: '::placeholder',
  selection: '::selection',
  marker: '::marker',
  backdrop: '::backdrop',
  'first-line': '::first-line',
  'first-letter': '::first-letter',
};

const AT_RULE_VARIANTS: Record<string, string> = {
  dark: '@media (prefers-color-scheme: dark)',
  'motion-safe': '@media (prefers-reduced-motion: no-preference)',
  'motion-reduce': '@media (prefers-reduced-motion: reduce)',
  print: '@media print',
};

const OTHER_ELEMENT_VARIANT_PREFIXES = ['group-', 'peer-', 'has-'];

const CONTENT_PSEUDO_ELEMENT_VARIANTS = ['before', 'after', 'file'];

/**
 * Resolves one variant prefix to the nested style-object keys that wrap
 * its declarations, outermost first — `hover` becomes the v4-faithful
 * `['@media (hover: hover)', ':hover']`, `md` a min-width media query.
 * Variants outside the supported subset are processing errors.
 */
export function resolveVariant(
  variant: string,
  candidate: string,
  fail: ConversionFail
): string[] {
  if (variant === 'hover') {
    return ['@media (hover: hover)', ':hover'];
  }
  const pseudoClass = PSEUDO_CLASS_VARIANTS[variant];
  if (pseudoClass !== undefined) {
    return [pseudoClass];
  }
  const pseudoElement = PSEUDO_ELEMENT_VARIANTS[variant];
  if (pseudoElement !== undefined) {
    return [pseudoElement];
  }
  const breakpoint = BREAKPOINTS[variant];
  if (breakpoint !== undefined) {
    return [`@media (min-width: ${breakpoint})`];
  }
  const atRule = AT_RULE_VARIANTS[variant];
  if (atRule !== undefined) {
    return [atRule];
  }
  if (
    OTHER_ELEMENT_VARIANT_PREFIXES.some((prefix) => variant.startsWith(prefix))
  ) {
    fail(
      `Cannot convert Tailwind utility '${candidate}': the '${variant}' variant targets other elements and is outside the supported conversion subset`
    );
  }
  if (CONTENT_PSEUDO_ELEMENT_VARIANTS.includes(variant)) {
    fail(
      `Cannot convert Tailwind utility '${candidate}': the '${variant}' variant relies on Tailwind's composed custom-property machinery and is outside the supported conversion subset`
    );
  }
  if (variant.startsWith('[')) {
    fail(
      `Cannot convert Tailwind utility '${candidate}': arbitrary variants are outside the supported conversion subset`
    );
  }
  if (
    ['max-', 'aria-', 'data-', 'supports-', 'not-', 'in-'].some((prefix) =>
      variant.startsWith(prefix)
    )
  ) {
    fail(
      `Cannot convert Tailwind utility '${candidate}': the '${variant}' variant is outside the supported conversion subset`
    );
  }
  fail(
    `Cannot convert Tailwind utility '${candidate}': unknown variant '${variant}'`
  );
}
