/**
 * Converts an authored nested style object into Tailwind utility classes - 
 * the inverse of `convert.ts`. Each plain declaration becomes its canonical
 * named utility when the value lands on the Tailwind v4 default theme, an
 * arbitrary value (`p-[3px]`) when it does not, or an arbitrary property
 * (`[mask-type:luminance]`) when the property has no utility family - so
 * coverage is total. Nested selector and at-rule blocks invert to variant
 * prefixes. A nested block with no Tailwind variant equivalent, like a
 * parent-modifier selector, is a processing error.
 *
 * Every named candidate is checked by round-tripping it back through the
 * forward table (`resolveBaseUtility`): a candidate is used only when it
 * resolves to exactly the declaration it came from, so the reverse mapping
 * can never emit a wrong utility - it falls back to an arbitrary form
 * instead.
 */

import { isExpressionBinding, toKebabCaseProperty } from '@js-template-engine/core';
import type { NestedSelectorBlock, NestedStyleObject } from '@js-template-engine/types';

import {
  BREAKPOINTS,
  COLORS,
  EASINGS,
  FONT_FAMILIES,
  FONT_WEIGHTS,
  LEADING,
  RADII,
  SHADOWS,
  SPACING_UNIT_REM,
  TRACKING,
} from './default-theme';
import {
  resolveBaseUtility,
  SIZING_KEYWORDS,
  STATIC_UTILITIES,
} from './utilities';
import type { ConversionFail } from './variants';

/** The result of converting one element's authored style. */
export interface StyleConversion {
  /** The utility classes the style became. */
  classes: string[];
  /** The style that could not become classes (per-property expressions). */
  remainingStyle?: NestedStyleObject;
}

type DeclarationValue = string | number;

/**
 * Converts a top-level authored style object into utility classes, keeping
 * any per-property `$expression` values as the remaining style.
 */
export function convertStyleToUtilities(
  style: NestedStyleObject,
  fail: ConversionFail
): StyleConversion {
  const classes: string[] = [];
  const remaining: NestedStyleObject = {};
  let hasRemaining = false;

  for (const [key, value] of Object.entries(style)) {
    if (value === undefined) {
      continue;
    }
    // The whole-object `$expression` is a runtime value, never a convertible
    // declaration; keep it in the remaining style for the dynamic mechanism.
    if (key === '$expression') {
      if (typeof value === 'string') {
        remaining.$expression = value;
        hasRemaining = true;
      }
      continue;
    }
    if (key === '$include' || key.startsWith('@include')) {
      failInclude(fail);
    }
    // Array and boolean values belong to Sass-source keys (handled above);
    // any other is not a convertible declaration.
    if (Array.isArray(value) || typeof value === 'boolean') {
      continue;
    }
    if (isExpressionBinding(value)) {
      remaining[key] = value;
      hasRemaining = true;
      continue;
    }
    if (isSelectorBlock(value)) {
      classes.push(...convertNested(key, value, '', fail));
      continue;
    }
    classes.push(declarationUtility(key, value, '', fail));
  }

  return { classes, remainingStyle: hasRemaining ? remaining : undefined };
}

function isSelectorBlock(value: unknown): value is NestedSelectorBlock {
  return typeof value === 'object' && value !== null && !isExpressionBinding(value);
}

/** Converts a nested selector block, prefixing its utilities with variants. */
function convertNested(
  selectorKey: string,
  block: NestedSelectorBlock,
  prefix: string,
  fail: ConversionFail
): string[] {
  const { variant, inner } = invertSelector(selectorKey, block, fail);
  const nextPrefix = `${prefix}${variant}:`;
  const classes: string[] = [];
  for (const [key, value] of Object.entries(inner)) {
    if (value === undefined) {
      continue;
    }
    if (key === '$include' || key.startsWith('@include')) {
      failInclude(fail);
    }
    if (Array.isArray(value) || typeof value === 'boolean') {
      continue;
    }
    if (isSelectorBlock(value)) {
      classes.push(...convertNested(key, value, nextPrefix, fail));
    } else {
      classes.push(declarationUtility(key, value, nextPrefix, fail));
    }
  }
  return classes;
}

/** A Sass include is not expressible as a Tailwind utility class. */
function failInclude(fail: ConversionFail): never {
  fail(
    'A Sass include cannot be converted to a Tailwind utility; remove ' +
      'convertStyles or the include'
  );
}

const REVERSE_PSEUDO_CLASS: Record<string, string> = {
  ':hover': 'hover',
  ':focus': 'focus',
  ':focus-visible': 'focus-visible',
  ':focus-within': 'focus-within',
  ':active': 'active',
  ':visited': 'visited',
  ':target': 'target',
  ':first-child': 'first',
  ':last-child': 'last',
  ':only-child': 'only',
  ':nth-child(odd)': 'odd',
  ':nth-child(even)': 'even',
  ':first-of-type': 'first-of-type',
  ':last-of-type': 'last-of-type',
  ':only-of-type': 'only-of-type',
  ':empty': 'empty',
  ':disabled': 'disabled',
  ':enabled': 'enabled',
  ':checked': 'checked',
  ':indeterminate': 'indeterminate',
  ':required': 'required',
  ':optional': 'optional',
  ':valid': 'valid',
  ':invalid': 'invalid',
  ':read-only': 'read-only',
  ':placeholder-shown': 'placeholder-shown',
};

const REVERSE_PSEUDO_ELEMENT: Record<string, string> = {
  '::placeholder': 'placeholder',
  '::selection': 'selection',
  '::marker': 'marker',
  '::backdrop': 'backdrop',
  '::first-line': 'first-line',
  '::first-letter': 'first-letter',
};

const REVERSE_AT_RULE: Record<string, string> = {
  '@media (prefers-color-scheme: dark)': 'dark',
  '@media (prefers-reduced-motion: no-preference)': 'motion-safe',
  '@media (prefers-reduced-motion: reduce)': 'motion-reduce',
  '@media print': 'print',
};

const REVERSE_BREAKPOINTS: Record<string, string> = Object.fromEntries(
  Object.entries(BREAKPOINTS).map(([variant, width]) => [
    `@media (min-width: ${width})`,
    variant,
  ])
);

/** Inverts a nested selector key to its variant prefix and the block to descend into. */
function invertSelector(
  key: string,
  block: NestedSelectorBlock,
  fail: ConversionFail
): { variant: string; inner: NestedSelectorBlock } {
  // The v4 hover form: `@media (hover: hover) { :hover { ... } }` is one `hover`.
  if (key === '@media (hover: hover)') {
    const innerKeys = Object.keys(block).filter(
      (innerKey) => block[innerKey] !== undefined
    );
    const hover = block[':hover'];
    if (innerKeys.length === 1 && innerKeys[0] === ':hover' && isSelectorBlock(hover)) {
      return { variant: 'hover', inner: hover };
    }
    failSelector(key, fail);
  }
  const pseudoClass = REVERSE_PSEUDO_CLASS[key];
  if (pseudoClass !== undefined) {
    return { variant: pseudoClass, inner: block };
  }
  const pseudoElement = REVERSE_PSEUDO_ELEMENT[key];
  if (pseudoElement !== undefined) {
    return { variant: pseudoElement, inner: block };
  }
  const breakpoint = REVERSE_BREAKPOINTS[key];
  if (breakpoint !== undefined) {
    return { variant: breakpoint, inner: block };
  }
  const atRule = REVERSE_AT_RULE[key];
  if (atRule !== undefined) {
    return { variant: atRule, inner: block };
  }
  failSelector(key, fail);
}

function failSelector(key: string, fail: ConversionFail): never {
  fail(
    `Cannot convert style selector '${key}' to a Tailwind variant: it has no ` +
      'utility-variant equivalent and is outside the supported conversion subset'
  );
}

/** Converts one declaration to a utility, prefixed with any accumulated variants. */
function declarationUtility(
  property: string,
  rawValue: DeclarationValue,
  prefix: string,
  fail: ConversionFail
): string {
  const text = typeof rawValue === 'number' ? String(rawValue) : rawValue;
  const { value, important } = stripImportant(text);
  const kebab = toKebabCaseProperty(property);

  const finish = (token: string): string =>
    `${prefix}${token}${important ? '!' : ''}`;

  for (const candidate of namedCandidates(kebab, value)) {
    if (roundTrips(candidate, kebab, value)) {
      return finish(candidate);
    }
  }

  const root = ARBITRARY_VALUE_ROOTS[kebab];
  if (root !== undefined) {
    const token = `${root}-[${encodeArbitrary(value)}]`;
    if (roundTrips(token, kebab, value)) {
      return finish(token);
    }
  }

  const propertyToken = `[${kebab}:${encodeArbitrary(value)}]`;
  if (roundTrips(propertyToken, kebab, value)) {
    return finish(propertyToken);
  }

  fail(
    `Cannot convert CSS declaration '${kebab}: ${value}' to a Tailwind utility`
  );
}

function stripImportant(value: string): { value: string; important: boolean } {
  const match = value.match(/^(.*?)\s*!important$/);
  return match === null
    ? { value: value.trim(), important: false }
    : { value: match[1].trim(), important: true };
}

/** Encodes a CSS value for an arbitrary bracket: literal `_` escaped, spaces to `_`. */
function encodeArbitrary(value: string): string {
  return value.replace(/_/g, '\\_').replace(/ /g, '_');
}

const throwingFail: ConversionFail = (message) => {
  throw new Error(message);
};

/** True when `token` forward-resolves to exactly `{ kebab: value }`. */
function roundTrips(token: string, kebab: string, value: string): boolean {
  let resolved;
  try {
    resolved = resolveBaseUtility(token, token, throwingFail);
  } catch {
    return false;
  }
  if (resolved.important) {
    return false;
  }
  const entries = Object.entries(resolved.declarations);
  if (entries.length !== 1) {
    return false;
  }
  return toKebabCaseProperty(entries[0][0]) === kebab && entries[0][1] === value;
}

// --- Named-candidate generation -------------------------------------------

/** Single-property static utilities, keyed `kebab=value` → utility name. */
const STATIC_REVERSE: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const [name, declarations] of Object.entries(STATIC_UTILITIES)) {
    const entries = Object.entries(declarations);
    if (entries.length === 1) {
      map.set(`${toKebabCaseProperty(entries[0][0])}=${entries[0][1]}`, name);
    }
  }
  return map;
})();

/**
 * Color value → palette name. The first name declared for a value wins, so
 * the standard palettes take precedence over later same-valued additions.
 */
const REVERSE_COLORS: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const [name, value] of Object.entries(COLORS)) {
    if (!map.has(value)) {
      map.set(value, name);
    }
  }
  return map;
})();

/** Property → utility root, for arbitrary-value fallback and scale families. */
const SPACING_ROOTS: Record<string, string> = {
  padding: 'p',
  'padding-inline': 'px',
  'padding-block': 'py',
  'padding-top': 'pt',
  'padding-right': 'pr',
  'padding-bottom': 'pb',
  'padding-left': 'pl',
  margin: 'm',
  'margin-inline': 'mx',
  'margin-block': 'my',
  'margin-top': 'mt',
  'margin-right': 'mr',
  'margin-bottom': 'mb',
  'margin-left': 'ml',
  gap: 'gap',
  'column-gap': 'gap-x',
  'row-gap': 'gap-y',
};

/** Spacing roots whose negative scale form (`-mt-2`) is meaningful. */
const NEGATIVE_SPACING = new Set([
  'm',
  'mx',
  'my',
  'mt',
  'mr',
  'mb',
  'ml',
]);

const SIZING_ROOTS: Record<string, string> = {
  width: 'w',
  height: 'h',
  'min-width': 'min-w',
  'max-width': 'max-w',
  'min-height': 'min-h',
  'max-height': 'max-h',
  'flex-basis': 'basis',
  inset: 'inset',
  'inset-inline': 'inset-x',
  'inset-block': 'inset-y',
  top: 'top',
  right: 'right',
  bottom: 'bottom',
  left: 'left',
};

const COLOR_ROOTS: Record<string, string> = {
  color: 'text',
  'background-color': 'bg',
  'border-color': 'border',
  'border-top-color': 'border-t',
  'border-right-color': 'border-r',
  'border-bottom-color': 'border-b',
  'border-left-color': 'border-l',
  'border-inline-color': 'border-x',
  'border-block-color': 'border-y',
};

const RADIUS_ROOTS: Record<string, string> = {
  'border-radius': 'rounded',
  'border-top-left-radius': 'rounded-tl',
  'border-top-right-radius': 'rounded-tr',
  'border-bottom-right-radius': 'rounded-br',
  'border-bottom-left-radius': 'rounded-bl',
};

const BORDER_WIDTH_ROOTS: Record<string, string> = {
  'border-width': 'border',
  'border-top-width': 'border-t',
  'border-right-width': 'border-r',
  'border-bottom-width': 'border-b',
  'border-left-width': 'border-l',
  'border-inline-width': 'border-x',
  'border-block-width': 'border-y',
};

/** Named enum families: property → { value → utility suffix }, joined to a root. */
const NAMED_FAMILIES: Record<string, { root: string; values: Record<string, string> }> = {
  'justify-content': {
    root: 'justify',
    values: {
      'flex-start': 'start',
      'flex-end': 'end',
      center: 'center',
      'space-between': 'between',
      'space-around': 'around',
      'space-evenly': 'evenly',
      stretch: 'stretch',
      normal: 'normal',
    },
  },
  'align-items': {
    root: 'items',
    values: {
      'flex-start': 'start',
      'flex-end': 'end',
      center: 'center',
      baseline: 'baseline',
      stretch: 'stretch',
    },
  },
  'align-content': {
    root: 'content',
    values: {
      'flex-start': 'start',
      'flex-end': 'end',
      center: 'center',
      'space-between': 'between',
      'space-around': 'around',
      'space-evenly': 'evenly',
      stretch: 'stretch',
      normal: 'normal',
    },
  },
  'align-self': {
    root: 'self',
    values: {
      auto: 'auto',
      'flex-start': 'start',
      'flex-end': 'end',
      center: 'center',
      stretch: 'stretch',
      baseline: 'baseline',
    },
  },
  'justify-items': {
    root: 'justify-items',
    values: { start: 'start', end: 'end', center: 'center', stretch: 'stretch' },
  },
  'justify-self': {
    root: 'justify-self',
    values: {
      auto: 'auto',
      start: 'start',
      end: 'end',
      center: 'center',
      stretch: 'stretch',
    },
  },
  overflow: { root: 'overflow', values: identityValues(['auto', 'hidden', 'clip', 'visible', 'scroll']) },
  'overflow-x': { root: 'overflow-x', values: identityValues(['auto', 'hidden', 'clip', 'visible', 'scroll']) },
  'overflow-y': { root: 'overflow-y', values: identityValues(['auto', 'hidden', 'clip', 'visible', 'scroll']) },
  'white-space': {
    root: 'whitespace',
    values: identityValues(['normal', 'nowrap', 'pre', 'pre-line', 'pre-wrap', 'break-spaces']),
  },
  'list-style-type': { root: 'list', values: identityValues(['none', 'disc', 'decimal']) },
  'pointer-events': { root: 'pointer-events', values: identityValues(['none', 'auto']) },
  'object-fit': { root: 'object', values: identityValues(['contain', 'cover', 'fill', 'none', 'scale-down']) },
  'transition-timing-function': {
    root: 'ease',
    values: Object.fromEntries(Object.entries(EASINGS).map(([name, value]) => [value, name])),
  },
  'font-weight': {
    root: 'font',
    values: Object.fromEntries(Object.entries(FONT_WEIGHTS).map(([name, value]) => [value, name])),
  },
  'font-family': {
    root: 'font',
    values: Object.fromEntries(Object.entries(FONT_FAMILIES).map(([name, value]) => [value, name])),
  },
  'letter-spacing': {
    root: 'tracking',
    values: Object.fromEntries(Object.entries(TRACKING).map(([name, value]) => [value, name])),
  },
};

const BORDER_STYLES = new Set(['solid', 'dashed', 'dotted', 'double', 'hidden', 'none']);

/** Integer-valued roots: property → { root, named overrides, negatives allowed }. */
const INTEGER_ROOTS: Record<
  string,
  { root: string; named?: Record<string, string>; negative?: boolean }
> = {
  'z-index': { root: 'z', named: { auto: 'auto' }, negative: true },
  order: { root: 'order', named: { '-9999': 'first', '9999': 'last', '0': 'none' }, negative: true },
  'flex-grow': { root: 'grow', named: { '1': '' } },
  'flex-shrink': { root: 'shrink', named: { '1': '' } },
  'grid-column-start': { root: 'col-start', named: { auto: 'auto' } },
  'grid-column-end': { root: 'col-end', named: { auto: 'auto' } },
  'grid-row-start': { root: 'row-start', named: { auto: 'auto' } },
  'grid-row-end': { root: 'row-end', named: { auto: 'auto' } },
};

/** Properties that accept an arbitrary value (`root-[...]`) rather than only `[prop:...]`. */
const ARBITRARY_VALUE_ROOTS: Record<string, string> = {
  ...SPACING_ROOTS,
  ...SIZING_ROOTS,
  ...COLOR_ROOTS,
  ...RADIUS_ROOTS,
  ...BORDER_WIDTH_ROOTS,
  'font-size': 'text',
  'line-height': 'leading',
  'box-shadow': 'shadow',
  opacity: 'opacity',
  'transition-duration': 'duration',
  'transition-delay': 'delay',
  'aspect-ratio': 'aspect',
  'object-position': 'object',
  'grid-template-columns': 'grid-cols',
  'grid-template-rows': 'grid-rows',
};

function identityValues(values: readonly string[]): Record<string, string> {
  return Object.fromEntries(values.map((value) => [value, value]));
}

function namedCandidates(kebab: string, value: string): string[] {
  const out: string[] = [];

  const staticName = STATIC_REVERSE.get(`${kebab}=${value}`);
  if (staticName !== undefined) {
    out.push(staticName);
  }

  const spacingRoot = SPACING_ROOTS[kebab];
  if (spacingRoot !== undefined) {
    pushSpacing(out, spacingRoot, value, NEGATIVE_SPACING.has(spacingRoot));
  }

  const sizingRoot = SIZING_ROOTS[kebab];
  if (sizingRoot !== undefined) {
    pushSizing(out, sizingRoot, kebab, value);
  }

  const colorRoot = COLOR_ROOTS[kebab];
  if (colorRoot !== undefined) {
    const color = colorSuffix(value);
    if (color !== undefined) {
      out.push(`${colorRoot}-${color}`);
    }
  }

  const radiusRoot = RADIUS_ROOTS[kebab];
  if (radiusRoot !== undefined) {
    const named = reverseLookup(RADII, value);
    if (value === '0.25rem') {
      out.push(radiusRoot);
    }
    if (named !== undefined) {
      out.push(`${radiusRoot}-${named}`);
    }
  }

  const borderWidthRoot = BORDER_WIDTH_ROOTS[kebab];
  if (borderWidthRoot !== undefined) {
    if (value === '1px') {
      out.push(borderWidthRoot);
    }
    const pixels = value.match(/^(\d+)px$/);
    if (pixels !== null) {
      out.push(`${borderWidthRoot}-${pixels[1]}`);
    }
  }

  if (kebab === 'border-style' && BORDER_STYLES.has(value)) {
    out.push(`border-${value}`);
  }

  const family = NAMED_FAMILIES[kebab];
  if (family !== undefined && family.values[value] !== undefined) {
    const suffix = family.values[value];
    out.push(suffix === '' ? family.root : `${family.root}-${suffix}`);
  }

  if (kebab === 'line-height') {
    const named = reverseLookup(LEADING, value);
    if (named !== undefined) {
      out.push(`leading-${named}`);
    }
    const spacing = spacingScaleSuffix(value);
    if (spacing !== undefined) {
      out.push(`leading-${spacing}`);
    }
  }

  if (kebab === 'box-shadow') {
    if (value === '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)') {
      out.push('shadow');
    }
    const named = reverseLookup(SHADOWS, value);
    if (named !== undefined) {
      out.push(`shadow-${named}`);
    }
  }

  if (kebab === 'opacity') {
    const percent = value.match(/^(\d+(?:\.\d+)?)%$/);
    if (percent !== null) {
      out.push(`opacity-${percent[1]}`);
    }
  }

  if (kebab === 'transition-duration' || kebab === 'transition-delay') {
    const milliseconds = value.match(/^(\d+(?:\.\d+)?)ms$/);
    if (milliseconds !== null) {
      out.push(`${kebab === 'transition-duration' ? 'duration' : 'delay'}-${milliseconds[1]}`);
    }
  }

  const integer = INTEGER_ROOTS[kebab];
  if (integer !== undefined) {
    pushInteger(out, integer, value);
  }

  return out;
}

function pushSpacing(
  out: string[],
  root: string,
  value: string,
  allowNegative: boolean
): void {
  const negative = value.startsWith('-');
  if (negative && !allowNegative) {
    return;
  }
  const suffix = spacingScaleSuffix(negative ? value.slice(1) : value);
  if (suffix === undefined) {
    return;
  }
  out.push(negative ? `-${root}-${suffix}` : `${root}-${suffix}`);
}

function pushSizing(out: string[], root: string, kebab: string, value: string): void {
  const keyword = reverseLookup(SIZING_KEYWORDS, value);
  if (keyword !== undefined) {
    out.push(`${root}-${keyword}`);
  }
  const fraction = value.match(/^calc\((\d+) \/ (\d+) \* 100%\)$/);
  if (fraction !== null) {
    out.push(`${root}-${fraction[1]}/${fraction[2]}`);
  }
  const allowNegative = ['inset', 'inset-x', 'inset-y', 'top', 'right', 'bottom', 'left'].includes(root);
  pushSpacing(out, root, value, allowNegative);
}

function pushInteger(
  out: string[],
  { root, named, negative }: { root: string; named?: Record<string, string>; negative?: boolean },
  value: string
): void {
  if (named !== undefined && named[value] !== undefined) {
    const suffix = named[value];
    out.push(suffix === '' ? root : `${root}-${suffix}`);
  }
  const isNegative = value.startsWith('-');
  if (isNegative && negative !== true) {
    return;
  }
  const digits = isNegative ? value.slice(1) : value;
  if (/^\d+$/.test(digits)) {
    out.push(isNegative ? `-${root}-${digits}` : `${root}-${digits}`);
  }
}

/** The numeric spacing-scale suffix for a value (`1rem` → `4`, `1px` → `px`). */
function spacingScaleSuffix(value: string): string | undefined {
  if (value === '0') {
    return '0';
  }
  if (value === '1px') {
    return 'px';
  }
  const rem = value.match(/^(\d+(?:\.\d+)?)rem$/);
  if (rem === null) {
    return undefined;
  }
  const units = parseFloat(rem[1]) / SPACING_UNIT_REM;
  return String(parseFloat(units.toFixed(4)));
}

/** A color value's utility suffix: palette name with an optional `/opacity`. */
function colorSuffix(value: string): string | undefined {
  const direct = REVERSE_COLORS.get(value);
  if (direct !== undefined) {
    return direct;
  }
  const mix = value.match(/^color-mix\(in oklab, (.+) (\d+(?:\.\d+)?)%, transparent\)$/);
  if (mix !== null) {
    const name = REVERSE_COLORS.get(mix[1]);
    if (name !== undefined) {
      return `${name}/${mix[2]}`;
    }
  }
  return undefined;
}

function reverseLookup(
  table: Record<string, string>,
  value: string
): string | undefined {
  for (const [name, candidate] of Object.entries(table)) {
    if (candidate === value) {
      return name;
    }
  }
  return undefined;
}
