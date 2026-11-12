import { BREAKPOINTS, CONTAINER_SCALE } from './default-theme';
import { decodeArbitraryValue, splitModifier } from './parse';

/**
 * Why a candidate cannot convert, where the conversion can tell: a name it
 * does not know, a value it does not know for a known root, or a utility
 * Tailwind v4 defines that the conversion does not map.
 */
export type ConversionFailure =
  | 'unknown-utility'
  | 'unsupported-value'
  | 'unsupported-utility';

/** Raises a processing error for an unconvertible candidate. */
export type ConversionFail = (
  message: string,
  failure?: ConversionFailure
) => never;

/** Options that change how a variant resolves. */
export interface VariantOptions {
  /**
   * The selector `dark:` writes its declarations under, in place of the
   * `prefers-color-scheme` media query; see {@link darkSelectorKey}.
   */
  darkSelector?: string;
}

/**
 * The nested style key a dark selector becomes. A selector containing `&`
 * composes as Tailwind v4's `@custom-variant dark (...)` composes it, `&`
 * standing for the element: `':root[data-mode="dark"] &'` and
 * `'&:where(.dark, .dark *)'` are used as written, with the specificity
 * they spell. A selector without `&` names a state of the page's root
 * element, the `<html>` a class or attribute toggle sets: `'.dark'`
 * becomes `:where(:root:is(.dark)) &`. The root anchor keeps the rule
 * global in a target that scopes component CSS, such as Svelte, and the
 * outer `:where()` adds no specificity, so a dark rule weighs what the
 * media query form weighs and a later `hover:` utility still wins over it.
 *
 * @example
 * darkSelectorKey('[data-mode="dark"]'); // ':where(:root:is([data-mode="dark"])) &'
 */
export function darkSelectorKey(selector: string): string {
  const trimmed = selector.trim();
  return trimmed.includes('&') ? trimmed : `:where(:root:is(${trimmed})) &`;
}

/**
 * Whether a value can be a `darkSelector`: a non-empty selector, not an
 * at-rule, holding no `{`, `}` or `;`, whose list members either all
 * contain `&` or none do - a list mixing the two would write the members
 * without `&` as rules of their own, outside the element.
 *
 * @param value - The candidate selector.
 * @returns `true` when the value is a usable dark selector.
 * @example
 * isDarkSelector('[data-mode="dark"]'); // true
 * isDarkSelector('.dark &, [data-mode="dark"]'); // false
 */
export function isDarkSelector(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.startsWith('@') || /[{};]/.test(trimmed)) {
    return false;
  }
  const members = splitSelectorList(trimmed);
  if (members.some((member) => member === '')) {
    return false;
  }
  const withAmpersand = members.filter((member) => member.includes('&'));
  return withAmpersand.length === 0 || withAmpersand.length === members.length;
}

/**
 * Splits a selector list on its top-level commas, leaving commas inside
 * parentheses, brackets and quotes alone.
 */
function splitSelectorList(selector: string): string[] {
  const members: string[] = [];
  let depth = 0;
  let quote: string | undefined;
  let current = '';
  for (const character of selector) {
    if (quote !== undefined) {
      if (character === quote) {
        quote = undefined;
      }
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '(' || character === '[') {
      depth += 1;
    } else if (character === ')' || character === ']') {
      depth -= 1;
    } else if (character === ',' && depth === 0) {
      members.push(current.trim());
      current = '';
      continue;
    }
    current += character;
  }
  members.push(current.trim());
  return members;
}

const PSEUDO_CLASS_VARIANTS: Record<string, string> = {
  focus: ':focus',
  'focus-visible': ':focus-visible',
  'focus-within': ':focus-within',
  active: ':active',
  visited: ':visited',
  target: ':target',
  open: ':is([open], :popover-open, :open)',
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
  'user-valid': ':user-valid',
  'user-invalid': ':user-invalid',
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

const OTHER_ELEMENT_VARIANT_PREFIXES = ['has-'];

const CONTENT_PSEUDO_ELEMENT_VARIANTS = ['before', 'after', 'file'];

/**
 * Resolves one variant prefix to the nested style-object keys that wrap
 * its declarations, outermost first - `hover` becomes the v4-faithful
 * `['@media (hover: hover)', ':hover']`, `md` a min-width media query.
 * `dark` is the `prefers-color-scheme` media query, or the nested selector
 * `options.darkSelector` composes to. `aria-*` and `data-*` become the
 * attribute selector {@link attributeVariantSelector} gives, and `group-*`
 * and `peer-*` the selector reaching a marked ancestor or preceding
 * sibling (see {@link compoundVariantKeys}). Variants outside the supported
 * subset are processing errors.
 */
export function resolveVariant(
  variant: string,
  candidate: string,
  fail: ConversionFail,
  options: VariantOptions = {}
): string[] {
  if (variant === 'dark' && options.darkSelector !== undefined) {
    return [darkSelectorKey(options.darkSelector)];
  }
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
  const attributeSelector = attributeVariantSelector(variant);
  if (attributeSelector !== undefined) {
    return [attributeSelector];
  }
  const compound = parseCompoundVariant(variant);
  if (compound !== undefined) {
    return compoundVariantKeys(compound, candidate, fail);
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
    ['max-', 'supports-', 'not-', 'in-'].some((prefix) =>
      variant.startsWith(prefix)
    )
  ) {
    fail(
      `Cannot convert Tailwind utility '${candidate}': the '${variant}' variant is outside the supported conversion subset`
    );
  }
  if (
    UNSUPPORTED_SELECTOR_VARIANTS.has(variant) ||
    UNSUPPORTED_STANDALONE_VARIANTS.has(variant) ||
    UNSUPPORTED_VARIANT_SHAPES.some((shape) => shape.test(variant))
  ) {
    fail(
      `Cannot convert Tailwind utility '${candidate}': the '${variant}' variant is outside the supported conversion subset`
    );
  }
  if (/^(?:aria|data)-\[.*\]$/.test(variant)) {
    fail(
      `Cannot convert Tailwind utility '${candidate}': the bracketed attribute in the '${variant}' variant is empty, does not open with an attribute name and then an operator or its end, or holds [, ], {, } or ;`
    );
  }
  if (variant.startsWith('aria-') || variant.startsWith('data-')) {
    fail(
      `Cannot convert Tailwind utility '${candidate}': the '${variant}' variant takes a name (aria-checked, data-active) or a bracketed attribute (aria-[sort=ascending], data-[state=open])`
    );
  }
  fail(
    `Cannot convert Tailwind utility '${candidate}': unknown variant '${variant}'`
  );
}

/**
 * A `group-*` or `peer-*` variant split into its parts: `group-hover/card`
 * is the `group` root, the `hover` inner variant and the `card` name.
 */
interface CompoundVariant {
  root: 'group' | 'peer';
  /** The inner variant, a bracketed selector included (`[.is-open]`). */
  inner: string;
  /** The group or peer name after `/`, when one is given. */
  name?: string;
  /** The `/` part as written, when it is not a usable name. */
  invalidName?: string;
}

/** The names a `group/<name>` or `peer/<name>` marker may take. */
const COMPOUND_NAME = /^[A-Za-z0-9_-]+$/;

/**
 * Splits a `group-*` or `peer-*` variant, or returns `undefined` for any
 * other variant.
 */
function parseCompoundVariant(variant: string): CompoundVariant | undefined {
  const root = variant.startsWith('group-')
    ? 'group'
    : variant.startsWith('peer-')
      ? 'peer'
      : undefined;
  if (root === undefined) {
    return undefined;
  }
  const { body, modifier } = splitModifier(variant.slice(root.length + 1));
  if (modifier === undefined) {
    return { root, inner: body };
  }
  const written = modifier.arbitrary ? `[${modifier.value}]` : modifier.value;
  return !modifier.arbitrary && COMPOUND_NAME.test(modifier.value)
    ? { root, inner: body, name: modifier.value }
    : { root, inner: body, invalidName: written };
}

/**
 * Whether a class is a `group` or `peer` marker - `group`, `peer`, or
 * either with a name (`group/card`) - which the `group-*` and `peer-*`
 * variants select, and which so stays a class under `output: 'styles'`.
 *
 * @example
 * isGroupMarker('group/card'); // true
 */
export function isGroupMarker(candidate: string): boolean {
  const [root, name, ...rest] = candidate.split('/');
  return (
    (root === 'group' || root === 'peer') &&
    rest.length === 0 &&
    (name === undefined || COMPOUND_NAME.test(name))
  );
}

/**
 * The selector an inner variant of `group-*` or `peer-*` puts on the
 * marked element, `&` standing for it, and the at-rules that wrap it:
 * `hover` is `&:hover` inside `@media (hover: hover)`, a pseudo-class
 * variant its pseudo-class, `aria-*`/`data-*` the attribute selector, and a
 * bracketed selector its decoded text, `&:is(<selector>)` when it holds no
 * `&`. Returns a reason string for an inner variant that is not a selector
 * on the element.
 */
function innerVariantSelector(
  inner: string
): { atRules: string[]; selector: string } | string {
  if (inner === 'hover') {
    return { atRules: ['@media (hover: hover)'], selector: '&:hover' };
  }
  const pseudoClass = PSEUDO_CLASS_VARIANTS[inner];
  if (pseudoClass !== undefined) {
    return { atRules: [], selector: `&${pseudoClass}` };
  }
  const attributeSelector = attributeVariantSelector(inner);
  if (attributeSelector !== undefined) {
    return { atRules: [], selector: attributeSelector };
  }
  if (/^(?:aria|data)-/.test(inner)) {
    return 'takes an aria-* or data-* variant with a name (aria-checked, data-active) or a bracketed attribute that opens with its name (data-[state=open])';
  }
  if (inner.startsWith('[') && inner.endsWith(']')) {
    const selector = arbitraryInnerSelector(inner);
    return selector === undefined
      ? 'takes a bracketed selector that is not empty, relative (>, +, ~) or an at-rule, and holds no {, } or ;'
      : { atRules: [], selector };
  }
  return 'takes a pseudo-class variant (hover, focus, checked), aria-* or data-*, or a bracketed selector';
}

/**
 * The selector variants Tailwind v4 defines that the converter does not
 * map, reported as outside the conversion subset on their own and after
 * `group-` or `peer-`.
 */
const UNSUPPORTED_SELECTOR_VARIANTS: ReadonlySet<string> = new Set([
  'inert',
  'ltr',
  'rtl',
  'autofill',
  'default',
  'in-range',
  'out-of-range',
]);

/**
 * The variants Tailwind v4 defines that the converter does not map and
 * that Tailwind does not compose after `group-` or `peer-`: the child
 * selectors `*` and `**`, the `details-content` pseudo-element, and the
 * media and at-rule variants. They are reported as outside the
 * conversion subset.
 */
const UNSUPPORTED_STANDALONE_VARIANTS: ReadonlySet<string> = new Set([
  '*',
  '**',
  'details-content',
  'starting',
  'noscript',
  'portrait',
  'landscape',
  'contrast-more',
  'contrast-less',
  'forced-colors',
  'inverted-colors',
  'pointer-none',
  'pointer-coarse',
  'pointer-fine',
  'any-pointer-none',
  'any-pointer-coarse',
  'any-pointer-fine',
]);

/** A theme scale's keys as regular-expression alternatives. */
function keyAlternatives(scale: Record<string, string>): string {
  return Object.keys(scale).join('|');
}

/** The structural `nth-*` variants: `nth-3`, `nth-last-of-type-[2n+1]`. */
const NTH_VARIANT = /^nth-(?:last-)?(?:of-type-)?(?:\d+|\[.+\])$/;

/**
 * The shapes of the functional variants Tailwind v4 defines that the
 * converter does not map: the {@link NTH_VARIANT} family, the `min-*`
 * breakpoint ranges over the default theme's breakpoints (`min-md`,
 * `min-[600px]`), and the container queries over its container scale
 * (`@md`, `@max-lg`, `@min-[400px]`, `@sm/sidebar`).
 */
const UNSUPPORTED_VARIANT_SHAPES: readonly RegExp[] = [
  NTH_VARIANT,
  new RegExp(`^min-(?:${keyAlternatives(BREAKPOINTS)}|\\[.+\\])$`),
  new RegExp(
    `^@(?:min-|max-)?(?:${keyAlternatives(CONTAINER_SCALE)}|\\[.+\\])(?:/[A-Za-z0-9_-]+)?$`
  ),
];

/**
 * The inner variants Tailwind v4 composes after `group-` and `peer-` that
 * fall outside the conversion subset: the relational `has-*`, `not-*` and
 * `in-*`, a nested `group-*` or `peer-*`, the structural `nth-*` family,
 * and the {@link UNSUPPORTED_SELECTOR_VARIANTS}.
 */
const UNSUPPORTED_COMPOUND_INNER_PREFIXES = [
  'has-',
  'not-',
  'in-',
  'group-',
  'peer-',
];

/**
 * Whether an inner variant of `group-*` or `peer-*` is one Tailwind v4
 * composes but the conversion subset leaves out, so the error says so
 * instead of naming the inner variants the converter takes.
 */
function isUnsupportedCompoundInner(inner: string): boolean {
  return (
    UNSUPPORTED_SELECTOR_VARIANTS.has(inner) ||
    NTH_VARIANT.test(inner) ||
    UNSUPPORTED_COMPOUND_INNER_PREFIXES.some(
      (prefix) => inner.startsWith(prefix) && inner.length > prefix.length
    )
  );
}

/**
 * The selector of a bracketed inner variant, as Tailwind v4 reads it:
 * decoded as an arbitrary value and trimmed, a list's members separated by
 * `, `, and `&:is(<selector>)` when it holds no `&`. `undefined` for an empty, relative or at-rule selector, or
 * one holding `{`, `}` or `;`.
 */
function arbitraryInnerSelector(inner: string): string | undefined {
  const selector = decodeArbitraryValue(inner.slice(1, -1)).trim();
  if (selector === '' || /^[>+~@]/.test(selector) || /[{};]/.test(selector)) {
    return undefined;
  }
  const list = splitSelectorList(selector).join(', ');
  return list.includes('&') ? list : `&:is(${list})`;
}

/**
 * The nested style keys a `group-*` or `peer-*` variant becomes, as
 * Tailwind v4 composes them: the inner variant's selector, `&` replaced by
 * `:where(.group)` (`:where(.group\/<name>)` for a named group), selects
 * the marked element, and the node is a descendant of it
 * (`&:is(:where(.group):hover *)`) or, for `peer`, a later sibling
 * (`&:is(:where(.peer):checked ~ *)`). A selector list wraps in `:is()`.
 * The inner variant's at-rules come first, outermost.
 *
 * @example
 * // group-hover/card:
 * // ['@media (hover: hover)', '&:is(:where(.group\\/card):hover *)']
 */
function compoundVariantKeys(
  compound: CompoundVariant,
  candidate: string,
  fail: ConversionFail
): string[] {
  const variant = `${compound.root}-${compound.inner}`;
  if (compound.invalidName !== undefined) {
    fail(
      `Cannot convert Tailwind utility '${candidate}': the name '${compound.invalidName}' after '${variant}/' takes letters, digits, '-' and '_'`
    );
  }
  const inner = innerVariantSelector(compound.inner);
  if (typeof inner === 'string' && isUnsupportedCompoundInner(compound.inner)) {
    fail(
      `Cannot convert Tailwind utility '${candidate}': the '${variant}' variant is outside the supported conversion subset`
    );
  }
  if (typeof inner === 'string') {
    fail(
      `Cannot convert Tailwind utility '${candidate}': the '${variant}' variant ${inner} after '${compound.root}-'`
    );
  }
  const marker = `:where(.${compound.root}${compound.name === undefined ? '' : `\\/${compound.name}`})`;
  let selector = inner.selector.split('&').join(marker);
  if (splitSelectorList(selector).length > 1) {
    selector = `:is(${selector})`;
  }
  const combinator = compound.root === 'group' ? ' *' : ' ~ *';
  return [...inner.atRules, `&:is(${selector}${combinator})`];
}

/**
 * The attribute selector an `aria-*` or `data-*` variant selects the
 * element by, as Tailwind v4 defines them: a named `aria-<state>` is the
 * state set to true (`aria-checked` → `&[aria-checked="true"]`), a named
 * `data-<name>` the attribute's presence (`data-active` →
 * `&[data-active]`), and a bracketed value is the attribute selector's body
 * after the prefix, its value quoted (`aria-[sort=ascending]` →
 * `&[aria-sort="ascending"]`, `data-[state=open]` → `&[data-state="open"]`).
 * Returns `undefined` for any other variant, and for a malformed one.
 *
 * @example
 * attributeVariantSelector('data-[featured=true]'); // '&[data-featured="true"]'
 */
export function attributeVariantSelector(variant: string): string | undefined {
  const prefix = variant.startsWith('aria-')
    ? 'aria'
    : variant.startsWith('data-')
      ? 'data'
      : undefined;
  if (prefix === undefined) {
    return undefined;
  }
  const value = variant.slice(prefix.length + 1);
  if (value.startsWith('[') && value.endsWith(']')) {
    const body = decodeArbitraryValue(value.slice(1, -1));
    if (
      body.trim() === '' ||
      /[[\]{};]/.test(body) ||
      !ATTRIBUTE_BODY_START.test(body)
    ) {
      return undefined;
    }
    return `&[${prefix}-${quoteAttributeValue(body)}]`;
  }
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    return undefined;
  }
  return prefix === 'aria' ? `&[aria-${value}="true"]` : `&[data-${value}]`;
}

/**
 * How a bracketed attribute body must start for the attribute selector to
 * be valid, as Tailwind v4 requires: the attribute's name right away, then
 * optional whitespace, then the end of the body or an operator -
 * `data-[a_b]` (`a b`) and `data-[_state=open]` give no selector.
 */
const ATTRIBUTE_BODY_START =
  /^(?:[A-Za-z0-9_-]|[^\x00-\x7f]|\\.)+\s*(?:$|[~|^$*]?=)/;

/**
 * Quotes the value of an attribute selector body as Tailwind v4 does:
 * `state=open` becomes `state="open"`, an operator before the `=` stays
 * (`lang|=en` → `lang|="en"`), a value already quoted stays as written,
 * and a trailing ` i` or ` s` case flag stays outside the quotes. The
 * value is read trimmed, as Tailwind reads it, so `state= open` is
 * `state="open"`. A body without `=` is a presence test and stays as
 * written.
 */
function quoteAttributeValue(body: string): string {
  const equalsIndex = topLevelEqualsIndex(body);
  if (equalsIndex === -1) {
    return body;
  }
  const name = body.slice(0, equalsIndex);
  const value = body.slice(equalsIndex + 1).trim();
  if (value.startsWith("'") || value.startsWith('"')) {
    return body;
  }
  if (value.length > 1) {
    const flag = value[value.length - 1];
    if (value[value.length - 2] === ' ' && /^[iIsS]$/.test(flag)) {
      return `${name}="${value.slice(0, -2)}" ${flag}`;
    }
  }
  return `${name}="${value}"`;
}

/**
 * The index of the first `=` outside parentheses, brackets and quotes, as
 * Tailwind splits an attribute body, or -1.
 */
function topLevelEqualsIndex(body: string): number {
  let depth = 0;
  let quote: string | undefined;
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    if (character === '\\') {
      index += 1;
    } else if (quote !== undefined) {
      if (character === quote) {
        quote = undefined;
      }
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '(' || character === '[') {
      depth += 1;
    } else if (character === ')' || character === ']') {
      depth -= 1;
    } else if (character === '=' && depth === 0) {
      return index;
    }
  }
  return -1;
}

/**
 * The positions Tailwind v4 registers the supported variants at, which its
 * stylesheet sorts rules by. Only the relative order matters.
 */
const VARIANT_ORDER: Record<string, number> = {
  group: 4,
  peer: 5,
  'first-letter': 6,
  'first-line': 7,
  marker: 8,
  selection: 9,
  placeholder: 11,
  backdrop: 12,
  first: 16,
  last: 17,
  only: 18,
  odd: 19,
  even: 20,
  'first-of-type': 21,
  'last-of-type': 22,
  'only-of-type': 23,
  visited: 24,
  target: 25,
  open: 26,
  checked: 28,
  indeterminate: 29,
  'placeholder-shown': 30,
  optional: 32,
  required: 33,
  valid: 34,
  invalid: 35,
  'user-valid': 36,
  'user-invalid': 37,
  'read-only': 40,
  empty: 41,
  'focus-within': 42,
  hover: 43,
  focus: 44,
  'focus-visible': 45,
  active: 46,
  enabled: 47,
  disabled: 48,
  aria: 52,
  data: 53,
  'motion-safe': 59,
  'motion-reduce': 60,
  breakpoint: 64,
  dark: 71,
  print: 73,
};

/**
 * Compares two supported variants by the order Tailwind v4 sorts them in:
 * by the position each is registered at (`group-*` and `peer-*` first,
 * `hover` before `focus`, a breakpoint before `dark`), breakpoints by
 * width, `aria-*` and `data-*` variants named ones first, then by their
 * text, a bracketed one decoded as an arbitrary value (`data-[a_b]` reads
 * `a b`), and two `group-*` (or `peer-*`) variants by their inner variant,
 * a bracketed selector after any other and bracketed ones by their text,
 * then unnamed before named and names by their text. Returns zero only
 * for the same variant.
 *
 * @param first - A supported variant, without its `:`.
 * @param second - Another supported variant.
 * @returns A negative number when `first` sorts first, a positive one
 *   when `second` does, zero for the same variant.
 *
 * @example
 * compareVariants('hover', 'dark'); // < 0
 * compareVariants('lg', 'md'); // > 0
 */
export function compareVariants(first: string, second: string): number {
  const firstCompound = parseCompoundVariant(first);
  const secondCompound = parseCompoundVariant(second);
  if (
    firstCompound !== undefined &&
    secondCompound !== undefined &&
    firstCompound.root === secondCompound.root
  ) {
    return compareCompoundVariants(firstCompound, secondCompound);
  }
  const firstPosition = variantPosition(first);
  const secondPosition = variantPosition(second);
  if (firstPosition.order !== secondPosition.order) {
    return firstPosition.order - secondPosition.order;
  }
  if (firstPosition.width !== secondPosition.width) {
    return firstPosition.width - secondPosition.width;
  }
  if (firstPosition.arbitrary !== secondPosition.arbitrary) {
    return firstPosition.arbitrary ? 1 : -1;
  }
  if (firstPosition.value === secondPosition.value) {
    return 0;
  }
  return firstPosition.value < secondPosition.value ? -1 : 1;
}

function compareCompoundVariants(
  first: CompoundVariant,
  second: CompoundVariant
): number {
  const firstArbitrary = first.inner.startsWith('[');
  const secondArbitrary = second.inner.startsWith('[');
  let comparison: number;
  if (firstArbitrary && secondArbitrary) {
    comparison = compareText(
      arbitraryInnerSelector(first.inner) ?? first.inner,
      arbitraryInnerSelector(second.inner) ?? second.inner
    );
  } else if (firstArbitrary !== secondArbitrary) {
    comparison = firstArbitrary ? 1 : -1;
  } else {
    comparison = compareVariants(first.inner, second.inner);
  }
  if (comparison !== 0) {
    return comparison;
  }
  if (first.name === undefined || second.name === undefined) {
    return (
      (first.name === undefined ? 0 : 1) - (second.name === undefined ? 0 : 1)
    );
  }
  return compareText(first.name, second.name);
}

function compareText(first: string, second: string): number {
  return first === second ? 0 : first < second ? -1 : 1;
}

interface VariantPosition {
  order: number;
  width: number;
  arbitrary: boolean;
  value: string;
}

function variantPosition(variant: string): VariantPosition {
  const breakpoint = BREAKPOINTS[variant];
  if (breakpoint !== undefined) {
    return {
      order: VARIANT_ORDER.breakpoint,
      width: Number.parseFloat(breakpoint),
      arbitrary: false,
      value: '',
    };
  }
  for (const prefix of ['aria', 'data']) {
    if (variant.startsWith(`${prefix}-`)) {
      const value = variant.slice(prefix.length + 1);
      const arbitrary = value.startsWith('[');
      return {
        order: VARIANT_ORDER[prefix],
        width: 0,
        arbitrary,
        value: arbitrary ? decodeArbitraryValue(value.slice(1, -1)) : value,
      };
    }
  }
  const compound = parseCompoundVariant(variant);
  if (compound !== undefined) {
    return {
      order: VARIANT_ORDER[compound.root],
      width: 0,
      arbitrary: false,
      value: variant,
    };
  }
  return {
    order: VARIANT_ORDER[variant] ?? Number.MAX_SAFE_INTEGER,
    width: 0,
    arbitrary: false,
    value: variant,
  };
}
