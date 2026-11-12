import {
  BARE_RADIUS,
  BARE_SHADOW,
  BREAKPOINTS,
  COLORS,
  CONTAINER_SCALE,
  DEFAULT_TRANSITION_DURATION,
  DEFAULT_TRANSITION_TIMING_FUNCTION,
  EASINGS,
  FONT_FAMILIES,
  FONT_WEIGHTS,
  LEADING,
  RADII,
  SHADOWS,
  SPACING_UNIT_REM,
  TEXT_SIZES,
  TRACKING,
} from './default-theme';
import {
  inferDataType,
  isNamedColor,
  splitTopLevel,
  type DataType,
} from './data-types';
import {
  decodeArbitraryValue,
  keptSegment,
  splitModifier,
  splitTypeHint,
} from './parse';
import { unsupportedUtilityName } from './unsupported-utilities';
import type { ConversionFail } from './variants';

/** CSS declarations produced by one utility, in camelCase property form. */
export type Declarations = Record<string, string>;

/** A resolved utility: its declarations and the `!` important flag. */
export interface ResolvedUtility {
  declarations: Declarations;
  /**
   * Declarations the utility nests in an at-rule on its own node, keyed by
   * the at-rule (`outline-hidden`'s forced-colors fallback).
   */
  nested?: Record<string, Declarations>;
  important: boolean;
}

interface ValueParts {
  /** The value text after the root; empty for bare roots (`border`). */
  value: string;
  arbitrary: boolean;
  /** An arbitrary value's type hint (`length` in `text-[length:1rem]`). */
  dataType?: string;
  negative: boolean;
  modifier?: { value: string; arbitrary: boolean };
}

/** Why a utility's value cannot convert, reported in the processing error. */
class UnsupportedValue {
  constructor(readonly reason: string) {}
}

type Resolution = Declarations | UnsupportedValue | undefined;

type UtilityResolver = (parts: ValueParts) => Resolution;

function declarations(
  properties: readonly string[],
  value: string
): Declarations {
  return Object.fromEntries(properties.map((property) => [property, value]));
}

function formatNumber(value: number): string {
  return String(parseFloat(value.toFixed(4)));
}

function spacingValue(raw: string, negative: boolean): string | undefined {
  if (raw === 'px') {
    return negative ? '-1px' : '1px';
  }
  if (!/^\d+(\.\d+)?$/.test(raw)) {
    return undefined;
  }
  const rem = parseFloat(raw) * SPACING_UNIT_REM;
  if (rem === 0) {
    return '0';
  }
  return `${negative ? '-' : ''}${formatNumber(rem)}rem`;
}

function fractionValue(parts: ValueParts): string | undefined {
  if (
    parts.modifier !== undefined &&
    !parts.modifier.arbitrary &&
    !parts.arbitrary &&
    /^\d+$/.test(parts.value) &&
    /^\d+$/.test(parts.modifier.value)
  ) {
    return `calc(${parts.value} / ${parts.modifier.value} * 100%)`;
  }
  return undefined;
}

function arbitraryValue(parts: ValueParts): string {
  const value = decodeArbitraryValue(parts.value);
  return parts.negative ? `calc(${value} * -1)` : value;
}

/**
 * The data type of an arbitrary value for a utility whose property depends
 * on it (`text-[1rem]` is a font size, `text-[#fff]` a color), read as
 * Tailwind v4 reads it: a type hint the utility routes picks its type; any
 * other hint, or an unhinted value whose type cannot be inferred from
 * `types` (a bare `var()` reference), takes the utility's fallback.
 */
function arbitraryDataType(
  parts: ValueParts,
  routed: readonly string[],
  types: readonly DataType[]
): string | undefined {
  if (parts.dataType !== undefined) {
    return routed.includes(parts.dataType) ? parts.dataType : undefined;
  }
  return inferDataType(decodeArbitraryValue(parts.value), types);
}

/**
 * Resolves a color value with its optional opacity modifier
 * (`blue-600/75` → `color-mix(in oklab, <blue-600> 75%, transparent)`).
 */
function colorValue(parts: ValueParts): string | undefined {
  const color = parts.arbitrary
    ? decodeArbitraryValue(parts.value)
    : COLORS[parts.value];
  if (color === undefined || parts.negative) {
    return undefined;
  }
  if (parts.modifier === undefined) {
    return color;
  }
  if (parts.modifier.arbitrary || !/^\d+(\.\d+)?$/.test(parts.modifier.value)) {
    return undefined;
  }
  return `color-mix(in oklab, ${color} ${parts.modifier.value}%, transparent)`;
}

function spacingFamily(
  properties: readonly string[],
  named: Record<string, string> = {}
): UtilityResolver {
  return (parts) => {
    if (parts.modifier !== undefined) {
      return undefined;
    }
    if (parts.arbitrary) {
      return declarations(properties, arbitraryValue(parts));
    }
    if (!parts.negative && named[parts.value] !== undefined) {
      return declarations(properties, named[parts.value]);
    }
    const spacing = spacingValue(parts.value, parts.negative);
    return spacing === undefined
      ? undefined
      : declarations(properties, spacing);
  };
}

function sizingFamily(
  properties: readonly string[],
  named: Record<string, string>,
  options: {
    fractions?: boolean;
    containerScale?: boolean;
    allowNegative?: boolean;
  } = {}
): UtilityResolver {
  return (parts) => {
    if (parts.negative && options.allowNegative !== true) {
      return undefined;
    }
    const fraction =
      options.fractions === true ? fractionValue(parts) : undefined;
    if (fraction !== undefined) {
      return declarations(
        properties,
        parts.negative ? `calc(${fraction} * -1)` : fraction
      );
    }
    if (parts.modifier !== undefined) {
      return undefined;
    }
    if (parts.arbitrary) {
      return declarations(properties, arbitraryValue(parts));
    }
    if (!parts.negative && named[parts.value] !== undefined) {
      return declarations(properties, named[parts.value]);
    }
    if (
      !parts.negative &&
      options.containerScale === true &&
      CONTAINER_SCALE[parts.value] !== undefined
    ) {
      return declarations(properties, CONTAINER_SCALE[parts.value]);
    }
    const spacing = spacingValue(parts.value, parts.negative);
    return spacing === undefined
      ? undefined
      : declarations(properties, spacing);
  };
}

function colorFamily(properties: readonly string[]): UtilityResolver {
  return (parts) => {
    const color = colorValue(parts);
    return color === undefined ? undefined : declarations(properties, color);
  };
}

function namedFamily(
  property: string,
  values: Record<string, string>,
  options: { arbitrary?: boolean } = {}
): UtilityResolver {
  return (parts) => {
    if (parts.modifier !== undefined || parts.negative) {
      return undefined;
    }
    if (parts.arbitrary) {
      return options.arbitrary === true
        ? { [property]: arbitraryValue(parts) }
        : undefined;
    }
    const value = values[parts.value];
    return value === undefined ? undefined : { [property]: value };
  };
}

function integerFamily(
  property: string,
  named: Record<string, string> = {},
  options: { unit?: string; allowNegative?: boolean } = {}
): UtilityResolver {
  return (parts) => {
    if (parts.modifier !== undefined) {
      return undefined;
    }
    if (parts.arbitrary) {
      return { [property]: arbitraryValue(parts) };
    }
    if (!parts.negative && named[parts.value] !== undefined) {
      return { [property]: named[parts.value] };
    }
    if (parts.negative && options.allowNegative !== true) {
      return undefined;
    }
    if (!/^\d+(\.\d+)?$/.test(parts.value)) {
      return undefined;
    }
    const sign = parts.negative ? '-' : '';
    return { [property]: `${sign}${parts.value}${options.unit ?? ''}` };
  };
}

function borderSideFamily(
  widthProperties: readonly string[],
  colorProperties: readonly string[],
  styleProperties?: readonly string[]
): UtilityResolver {
  return (parts) => {
    if (parts.negative) {
      return undefined;
    }
    if (parts.value === '' && parts.modifier === undefined) {
      return declarations(widthProperties, '1px');
    }
    if (parts.arbitrary) {
      const type = arbitraryDataType(
        parts,
        ['line-width', 'length'],
        ['color', 'line-width', 'length']
      );
      if (type !== undefined && type !== 'color') {
        return parts.modifier === undefined
          ? declarations(widthProperties, decodeArbitraryValue(parts.value))
          : undefined;
      }
      const color = colorValue(parts);
      return color === undefined
        ? undefined
        : declarations(colorProperties, color);
    }
    if (parts.modifier === undefined && /^\d+$/.test(parts.value)) {
      return declarations(widthProperties, `${parts.value}px`);
    }
    if (
      styleProperties !== undefined &&
      parts.modifier === undefined &&
      ['solid', 'dashed', 'dotted', 'double', 'hidden', 'none'].includes(
        parts.value
      )
    ) {
      return declarations(styleProperties, parts.value);
    }
    const color = colorValue(parts);
    return color === undefined
      ? undefined
      : declarations(colorProperties, color);
  };
}

function radiusFamily(properties: readonly string[]): UtilityResolver {
  return (parts) => {
    if (parts.modifier !== undefined || parts.negative) {
      return undefined;
    }
    if (parts.value === '') {
      return declarations(properties, BARE_RADIUS);
    }
    if (parts.arbitrary) {
      return declarations(properties, arbitraryValue(parts));
    }
    const radius = RADII[parts.value];
    return radius === undefined ? undefined : declarations(properties, radius);
  };
}

/**
 * The value `font-variant-numeric` composes from Tailwind's numeric-variant
 * custom properties, each empty unless a utility sets it.
 */
export const FONT_VARIANT_NUMERIC =
  'var(--tw-ordinal,) var(--tw-slashed-zero,) var(--tw-numeric-figure,) var(--tw-numeric-spacing,) var(--tw-numeric-fraction,)';

/**
 * A numeric-variant utility: it sets its own custom property and composes
 * `font-variant-numeric` from all of them, as Tailwind v4 does.
 */
function numericVariant(customProperty: string, value: string): Declarations {
  return { [customProperty]: value, fontVariantNumeric: FONT_VARIANT_NUMERIC };
}

/**
 * An outline-style utility: it sets `--tw-outline-style` - which an
 * outline width reads - and `outline-style` itself, as Tailwind v4 does.
 */
function outlineStyle(value: string): Declarations {
  return { '--tw-outline-style': value, outlineStyle: value };
}

/**
 * The style an outline width utility sets: whatever an outline-style
 * utility set on the node, `solid` otherwise. Tailwind writes the reference
 * without a fallback and registers the property's `solid` start; the
 * fallback here keeps an outline width visible without that registration
 * or the reset rule that stands in for it.
 */
export const OUTLINE_STYLE_REFERENCE = 'var(--tw-outline-style, solid)';

/**
 * The `box-shadow` Tailwind composes from its shadow and ring custom
 * properties, so `shadow-*`, `ring-*`, `inset-ring-*` and `ring-offset-*`
 * on one node combine. Tailwind writes each reference without a fallback and registers
 * the property's `0 0 #0000` start; the fallbacks here let a shadow or ring
 * draw without that registration or the reset rule that stands in for it.
 */
export const COMPOSED_BOX_SHADOW = [
  '--tw-inset-shadow',
  '--tw-inset-ring-shadow',
  '--tw-ring-offset-shadow',
  '--tw-ring-shadow',
  '--tw-shadow',
]
  .map((property) => `var(${property}, 0 0 #0000)`)
  .join(', ');

/** A shadow utility: `--tw-shadow` and the composed `box-shadow`. */
function shadowDeclarations(shadow: string): Declarations {
  return { '--tw-shadow': shadow, boxShadow: COMPOSED_BOX_SHADOW };
}

/**
 * A ring width utility: `--tw-ring-shadow` and the composed `box-shadow`.
 * The ring spreads past the offset width, `0px` without one, in the ring
 * color, `currentcolor` without one, inset under `ring-inset`.
 */
function ringDeclarations(width: string): Declarations {
  return {
    '--tw-ring-shadow': `var(--tw-ring-inset,) 0 0 0 calc(${width} + var(--tw-ring-offset-width, 0px)) var(--tw-ring-color, currentcolor)`,
    boxShadow: COMPOSED_BOX_SHADOW,
  };
}

/**
 * An inset ring width utility: `--tw-inset-ring-shadow` and the composed
 * `box-shadow`. The ring is drawn inset at that width in the inset ring
 * color, `currentcolor` without one.
 */
function insetRingDeclarations(width: string): Declarations {
  return {
    '--tw-inset-ring-shadow': `inset 0 0 0 ${width} var(--tw-inset-ring-color, currentcolor)`,
    boxShadow: COMPOSED_BOX_SHADOW,
  };
}

/**
 * A shadow color utility: `--tw-shadow-color`, the color with its opacity
 * modifier mixed by `--tw-shadow-alpha` as Tailwind v4 mixes it
 * (`shadow-indigo-500/50` →
 * `color-mix(in oklab, color-mix(in oklab, <indigo-500> 50%, transparent) var(--tw-shadow-alpha, 100%), transparent)`).
 * `undefined` for a value that is not a color.
 */
function shadowColorDeclarations(parts: ValueParts): Declarations | undefined {
  const color = colorValue(parts);
  return color === undefined
    ? undefined
    : {
        '--tw-shadow-color': `color-mix(in oklab, ${color} var(--tw-shadow-alpha, 100%), transparent)`,
      };
}

/**
 * A ring offset width utility: the width, and the offset shadow it spreads
 * in the offset color, `#fff` without one.
 */
function ringOffsetDeclarations(width: string): Declarations {
  return {
    '--tw-ring-offset-width': width,
    '--tw-ring-offset-shadow':
      'var(--tw-ring-inset,) 0 0 0 var(--tw-ring-offset-width, 0px) var(--tw-ring-offset-color, #fff)',
  };
}

/**
 * Whether a shadow utility's declarations draw exactly `boxShadow` on a
 * node no ring utility touches: they set `--tw-shadow` to that shadow, its
 * colors read through `--tw-shadow-color` or as written, and the composed
 * `box-shadow`. Never for a CSS-wide keyword (`inherit`, `initial`, ...),
 * which on a custom property means something else.
 *
 * @example
 * drawsBoxShadow(resolveBaseUtility('shadow-md', ...).declarations, SHADOWS.md); // true
 */
export function drawsBoxShadow(
  declarations: Declarations,
  boxShadow: string
): boolean {
  const shadow = declarations['--tw-shadow'];
  // A CSS-wide keyword set on `--tw-shadow` does not reach `box-shadow`.
  if (CSS_WIDE_KEYWORDS.has(boxShadow.trim().toLowerCase())) {
    return false;
  }
  return (
    Object.keys(declarations).length === 2 &&
    declarations.boxShadow === COMPOSED_BOX_SHADOW &&
    (shadow === boxShadow || shadow === wrapShadowColors(boxShadow))
  );
}

const CSS_WIDE_KEYWORDS = new Set([
  'inherit',
  'initial',
  'unset',
  'revert',
  'revert-layer',
]);

const SHADOW_KEYWORDS = new Set([
  'inset',
  'inherit',
  'initial',
  'revert',
  'unset',
]);
const SHADOW_LENGTH_FUNCTIONS = new Set(['calc', 'clamp', 'max', 'min']);
const SHADOW_COLOR_FUNCTIONS = new Set([
  'color',
  'color-mix',
  'contrast-color',
  'device-cmyk',
  'hsl',
  'hsla',
  'hwb',
  'lab',
  'lch',
  'light-dark',
  'oklab',
  'oklch',
  'rgb',
  'rgba',
]);

/**
 * Rewrites each shadow of a `box-shadow` value so its color reads
 * `--tw-shadow-color` first, as Tailwind v4 does
 * (`0 0 2px red` → `0 0 2px var(--tw-shadow-color, red)`): the first color
 * word or color function is wrapped; without one, a shadow with at least
 * two lengths and no other word gets `currentcolor` appended, wrapped, and
 * one with exactly one other word (a `var()`) has that word wrapped. A
 * shadow with fewer than two lengths (`none`, a bare `var()`) stays as
 * written.
 */
function wrapShadowColors(value: string): string {
  const wrap = (color: string) => `var(--tw-shadow-color, ${color})`;
  return splitTopLevel(value, ',')
    .map((shadow) => {
      const tokens = splitTopLevel(shadow, ' ');
      let lengths = 0;
      let otherIndex = -1;
      let others = 0;
      for (const [index, token] of tokens.entries()) {
        const open = token.indexOf('(');
        if (open > 0 && token.endsWith(')')) {
          const name = token.slice(0, open).toLowerCase();
          if (SHADOW_COLOR_FUNCTIONS.has(name)) {
            tokens[index] = wrap(token);
            return tokens.join(' ');
          }
          if (SHADOW_LENGTH_FUNCTIONS.has(name)) {
            lengths += 1;
          } else {
            otherIndex = index;
            others += 1;
          }
          continue;
        }
        const word = token.toLowerCase();
        if (SHADOW_KEYWORDS.has(word)) {
          continue;
        }
        if (/^-?(\d+|\.\d+)/.test(word)) {
          lengths += 1;
          continue;
        }
        if (token.startsWith('#') || isNamedColor(word)) {
          tokens[index] = wrap(token);
          return tokens.join(' ');
        }
        otherIndex = index;
        others += 1;
      }
      if (lengths < 2) {
        return shadow;
      }
      if (others === 0) {
        return `${shadow} ${wrap('currentcolor')}`;
      }
      if (others === 1) {
        tokens[otherIndex] = wrap(tokens[otherIndex]);
        return tokens.join(' ');
      }
      return shadow;
    })
    .join(', ');
}

/** Viewport-unit sizing keywords (`h-dvh` → `100dvh`). */
const VIEWPORT_SIZES: Record<string, string> = Object.fromEntries(
  ['dvw', 'svw', 'lvw', 'dvh', 'svh', 'lvh'].map((unit) => [unit, `100${unit}`])
);

/**
 * A length utility whose bare integers are pixels and whose negative form
 * negates through `calc()`, as Tailwind v4 writes them
 * (`-outline-offset-2` → `calc(2px * -1)`).
 */
function pixelOffsetFamily(
  property: string,
  named: Record<string, string> = {}
): UtilityResolver {
  return (parts) => {
    if (parts.modifier !== undefined) {
      return undefined;
    }
    if (parts.arbitrary) {
      return { [property]: arbitraryValue(parts) };
    }
    if (!parts.negative && named[parts.value] !== undefined) {
      return { [property]: named[parts.value] };
    }
    if (!/^\d+$/.test(parts.value)) {
      return undefined;
    }
    return {
      [property]: parts.negative
        ? `calc(${parts.value}px * -1)`
        : `${parts.value}px`,
    };
  };
}

/**
 * A utility that sets a width or a color depending on its value: bare
 * integers are widths, theme colors are colors, and an arbitrary value's
 * type - its hint, or else inferred from `types` - routes it to the width
 * when it is one of `widthTypes` and to the color otherwise, as Tailwind
 * reads `outline-`, `stroke-` and `decoration-`.
 */
function widthOrColorFamily(options: {
  width: (value: string) => Declarations;
  color: string;
  widthTypes: readonly DataType[];
  types: readonly DataType[];
  bareWidth: (value: string) => string;
  named?: Record<string, Declarations>;
}): UtilityResolver {
  return (parts) => {
    if (parts.negative) {
      return undefined;
    }
    if (parts.arbitrary) {
      const type = arbitraryDataType(parts, options.widthTypes, options.types);
      if (type !== undefined && type !== 'color') {
        return parts.modifier === undefined
          ? options.width(decodeArbitraryValue(parts.value))
          : undefined;
      }
      return colorFamily([options.color])(parts);
    }
    if (parts.modifier === undefined) {
      const named = options.named?.[parts.value];
      if (named !== undefined) {
        return { ...named };
      }
      if (/^\d+$/.test(parts.value)) {
        return options.width(options.bareWidth(parts.value));
      }
    }
    return colorFamily([options.color])(parts);
  };
}

const TRANSITION_DEFAULTS: Declarations = {
  transitionTimingFunction: DEFAULT_TRANSITION_TIMING_FUNCTION,
  transitionDuration: DEFAULT_TRANSITION_DURATION,
};

export const SIZING_KEYWORDS: Record<string, string> = {
  auto: 'auto',
  full: '100%',
  min: 'min-content',
  max: 'max-content',
  fit: 'fit-content',
};

/** The sizing keywords a `max-` size takes: `max-width: auto` is not CSS. */
const WITHOUT_AUTO: Record<string, string> = Object.fromEntries(
  Object.entries(SIZING_KEYWORDS).filter(([name]) => name !== 'auto')
);

const OVERFLOW_VALUES: Record<string, string> = {
  auto: 'auto',
  hidden: 'hidden',
  clip: 'clip',
  visible: 'visible',
  scroll: 'scroll',
};

/** Utilities that are a single exact name, mapped straight to declarations. */
export const STATIC_UTILITIES: Record<string, Declarations> = {
  // Display
  block: { display: 'block' },
  'inline-block': { display: 'inline-block' },
  inline: { display: 'inline' },
  flex: { display: 'flex' },
  'inline-flex': { display: 'inline-flex' },
  grid: { display: 'grid' },
  'inline-grid': { display: 'inline-grid' },
  table: { display: 'table' },
  'inline-table': { display: 'inline-table' },
  contents: { display: 'contents' },
  'flow-root': { display: 'flow-root' },
  hidden: { display: 'none' },
  // Visibility
  visible: { visibility: 'visible' },
  invisible: { visibility: 'hidden' },
  collapse: { visibility: 'collapse' },
  // Position
  static: { position: 'static' },
  fixed: { position: 'fixed' },
  absolute: { position: 'absolute' },
  relative: { position: 'relative' },
  sticky: { position: 'sticky' },
  // Flex direction and wrapping
  'flex-row': { flexDirection: 'row' },
  'flex-row-reverse': { flexDirection: 'row-reverse' },
  'flex-col': { flexDirection: 'column' },
  'flex-col-reverse': { flexDirection: 'column-reverse' },
  'flex-wrap': { flexWrap: 'wrap' },
  'flex-wrap-reverse': { flexWrap: 'wrap-reverse' },
  'flex-nowrap': { flexWrap: 'nowrap' },
  // Box sizing and isolation
  'box-border': { boxSizing: 'border-box' },
  'box-content': { boxSizing: 'content-box' },
  isolate: { isolation: 'isolate' },
  'isolation-auto': { isolation: 'auto' },
  // Typography
  italic: { fontStyle: 'italic' },
  'not-italic': { fontStyle: 'normal' },
  uppercase: { textTransform: 'uppercase' },
  lowercase: { textTransform: 'lowercase' },
  capitalize: { textTransform: 'capitalize' },
  'normal-case': { textTransform: 'none' },
  underline: { textDecorationLine: 'underline' },
  overline: { textDecorationLine: 'overline' },
  'line-through': { textDecorationLine: 'line-through' },
  'no-underline': { textDecorationLine: 'none' },
  truncate: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  'text-ellipsis': { textOverflow: 'ellipsis' },
  'text-clip': { textOverflow: 'clip' },
  'break-normal': { overflowWrap: 'normal', wordBreak: 'normal' },
  'break-words': { overflowWrap: 'break-word' },
  'break-all': { wordBreak: 'break-all' },
  'break-keep': { wordBreak: 'keep-all' },
  'text-wrap': { textWrap: 'wrap' },
  'text-nowrap': { textWrap: 'nowrap' },
  'text-balance': { textWrap: 'balance' },
  'text-pretty': { textWrap: 'pretty' },
  antialiased: {
    '-webkit-font-smoothing': 'antialiased',
    '-moz-osx-font-smoothing': 'grayscale',
  },
  'subpixel-antialiased': {
    '-webkit-font-smoothing': 'auto',
    '-moz-osx-font-smoothing': 'auto',
  },
  // Numeric variants compose through Tailwind's custom properties, so
  // `tabular-nums slashed-zero` sets both
  'normal-nums': { fontVariantNumeric: 'normal' },
  ordinal: numericVariant('--tw-ordinal', 'ordinal'),
  'slashed-zero': numericVariant('--tw-slashed-zero', 'slashed-zero'),
  'lining-nums': numericVariant('--tw-numeric-figure', 'lining-nums'),
  'oldstyle-nums': numericVariant('--tw-numeric-figure', 'oldstyle-nums'),
  'proportional-nums': numericVariant(
    '--tw-numeric-spacing',
    'proportional-nums'
  ),
  'tabular-nums': numericVariant('--tw-numeric-spacing', 'tabular-nums'),
  'diagonal-fractions': numericVariant(
    '--tw-numeric-fraction',
    'diagonal-fractions'
  ),
  'stacked-fractions': numericVariant(
    '--tw-numeric-fraction',
    'stacked-fractions'
  ),
  // Text alignment
  'text-left': { textAlign: 'left' },
  'text-center': { textAlign: 'center' },
  'text-right': { textAlign: 'right' },
  'text-justify': { textAlign: 'justify' },
  'text-start': { textAlign: 'start' },
  'text-end': { textAlign: 'end' },
  // Backgrounds
  'bg-none': { backgroundImage: 'none' },
  'bg-fixed': { backgroundAttachment: 'fixed' },
  'bg-local': { backgroundAttachment: 'local' },
  'bg-scroll': { backgroundAttachment: 'scroll' },
  'bg-center': { backgroundPosition: 'center' },
  'bg-top': { backgroundPosition: 'top' },
  'bg-bottom': { backgroundPosition: 'bottom' },
  'bg-left': { backgroundPosition: 'left' },
  'bg-right': { backgroundPosition: 'right' },
  'bg-repeat': { backgroundRepeat: 'repeat' },
  'bg-no-repeat': { backgroundRepeat: 'no-repeat' },
  'bg-repeat-x': { backgroundRepeat: 'repeat-x' },
  'bg-repeat-y': { backgroundRepeat: 'repeat-y' },
  'bg-repeat-round': { backgroundRepeat: 'round' },
  'bg-repeat-space': { backgroundRepeat: 'space' },
  'bg-auto': { backgroundSize: 'auto' },
  'bg-cover': { backgroundSize: 'cover' },
  'bg-contain': { backgroundSize: 'contain' },
  // Outline styles, which an outline width reads through
  // `--tw-outline-style`
  'outline-solid': outlineStyle('solid'),
  'outline-dashed': outlineStyle('dashed'),
  'outline-dotted': outlineStyle('dotted'),
  'outline-double': outlineStyle('double'),
  'outline-none': outlineStyle('none'),
  'outline-hidden': outlineStyle('none'),
  // Screen-reader visibility
  'sr-only': {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: '0',
    margin: '-1px',
    overflow: 'hidden',
    clipPath: 'inset(50%)',
    whiteSpace: 'nowrap',
    borderWidth: '0',
  },
  'not-sr-only': {
    position: 'static',
    width: 'auto',
    height: 'auto',
    padding: '0',
    margin: '0',
    overflow: 'visible',
    clipPath: 'none',
    whiteSpace: 'normal',
  },
  // Interactivity
  'appearance-none': { appearance: 'none' },
  'appearance-auto': { appearance: 'auto' },
  resize: { resize: 'both' },
  'resize-none': { resize: 'none' },
  'resize-x': { resize: 'horizontal' },
  'resize-y': { resize: 'vertical' },
  'field-sizing-content': { fieldSizing: 'content' },
  'field-sizing-fixed': { fieldSizing: 'fixed' },
  // Scroll snapping
  'snap-start': { scrollSnapAlign: 'start' },
  'snap-end': { scrollSnapAlign: 'end' },
  'snap-center': { scrollSnapAlign: 'center' },
  'snap-align-none': { scrollSnapAlign: 'none' },
  'snap-normal': { scrollSnapStop: 'normal' },
  'snap-always': { scrollSnapStop: 'always' },
  'snap-none': { scrollSnapType: 'none' },
  // Transitions, resolved to their default timing and duration
  'transition-none': { transitionProperty: 'none' },
  'transition-all': { transitionProperty: 'all', ...TRANSITION_DEFAULTS },
  'transition-colors': {
    transitionProperty:
      'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to',
    ...TRANSITION_DEFAULTS,
  },
  'transition-opacity': {
    transitionProperty: 'opacity',
    ...TRANSITION_DEFAULTS,
  },
  'transition-shadow': {
    transitionProperty: 'box-shadow',
    ...TRANSITION_DEFAULTS,
  },
  'transition-transform': {
    transitionProperty: 'transform, translate, scale, rotate',
    ...TRANSITION_DEFAULTS,
  },
  // Rings, drawn inset by the composed ring shadow
  'ring-inset': { '--tw-ring-inset': 'inset' },
};

/**
 * Static utilities that also nest declarations in an at-rule on their own
 * node, keyed by utility name and then by at-rule.
 */
const NESTED_STATIC_UTILITIES: Record<string, Record<string, Declarations>> = {
  'outline-hidden': {
    '@media (forced-colors: active)': {
      outline: '2px solid transparent',
      outlineOffset: '2px',
    },
  },
};

/** Utilities addressed by root + value, mapped through a resolver. */
const FUNCTIONAL_UTILITIES: Record<string, UtilityResolver> = {
  // Padding
  p: spacingFamily(['padding']),
  px: spacingFamily(['paddingInline']),
  py: spacingFamily(['paddingBlock']),
  pt: spacingFamily(['paddingTop']),
  pr: spacingFamily(['paddingRight']),
  pb: spacingFamily(['paddingBottom']),
  pl: spacingFamily(['paddingLeft']),
  // Margin
  m: spacingFamily(['margin'], { auto: 'auto' }),
  mx: spacingFamily(['marginInline'], { auto: 'auto' }),
  my: spacingFamily(['marginBlock'], { auto: 'auto' }),
  mt: spacingFamily(['marginTop'], { auto: 'auto' }),
  mr: spacingFamily(['marginRight'], { auto: 'auto' }),
  mb: spacingFamily(['marginBottom'], { auto: 'auto' }),
  ml: spacingFamily(['marginLeft'], { auto: 'auto' }),
  // Gap
  gap: spacingFamily(['gap']),
  'gap-x': spacingFamily(['columnGap']),
  'gap-y': spacingFamily(['rowGap']),
  // Position offsets
  inset: sizingFamily(['inset'], SIZING_KEYWORDS, {
    fractions: true,
    allowNegative: true,
  }),
  'inset-x': sizingFamily(['insetInline'], SIZING_KEYWORDS, {
    fractions: true,
    allowNegative: true,
  }),
  'inset-y': sizingFamily(['insetBlock'], SIZING_KEYWORDS, {
    fractions: true,
    allowNegative: true,
  }),
  top: sizingFamily(['top'], SIZING_KEYWORDS, {
    fractions: true,
    allowNegative: true,
  }),
  right: sizingFamily(['right'], SIZING_KEYWORDS, {
    fractions: true,
    allowNegative: true,
  }),
  bottom: sizingFamily(['bottom'], SIZING_KEYWORDS, {
    fractions: true,
    allowNegative: true,
  }),
  left: sizingFamily(['left'], SIZING_KEYWORDS, {
    fractions: true,
    allowNegative: true,
  }),
  z: integerFamily('zIndex', { auto: 'auto' }, { allowNegative: true }),
  order: integerFamily(
    'order',
    { first: '-9999', last: '9999', none: '0' },
    { allowNegative: true }
  ),
  // Sizing
  w: sizingFamily(
    ['width'],
    { ...SIZING_KEYWORDS, ...VIEWPORT_SIZES, screen: '100vw' },
    { fractions: true, containerScale: true }
  ),
  h: sizingFamily(
    ['height'],
    { ...SIZING_KEYWORDS, ...VIEWPORT_SIZES, screen: '100vh', lh: '1lh' },
    { fractions: true }
  ),
  size: sizingFamily(
    ['width', 'height'],
    {
      ...SIZING_KEYWORDS,
      ...VIEWPORT_SIZES,
    },
    {
      fractions: true,
    }
  ),
  'min-w': sizingFamily(
    ['minWidth'],
    { ...SIZING_KEYWORDS, ...VIEWPORT_SIZES, screen: '100vw' },
    { fractions: true, containerScale: true }
  ),
  'max-w': sizingFamily(
    ['maxWidth'],
    {
      ...WITHOUT_AUTO,
      ...VIEWPORT_SIZES,
      none: 'none',
      screen: '100vw',
      prose: '65ch',
      ...Object.fromEntries(
        Object.entries(BREAKPOINTS).map(([name, width]) => [
          `screen-${name}`,
          width,
        ])
      ),
    },
    { fractions: true, containerScale: true }
  ),
  'min-h': sizingFamily(
    ['minHeight'],
    {
      ...SIZING_KEYWORDS,
      ...VIEWPORT_SIZES,
      screen: '100vh',
      lh: '1lh',
    },
    { fractions: true }
  ),
  'max-h': sizingFamily(
    ['maxHeight'],
    {
      ...WITHOUT_AUTO,
      ...VIEWPORT_SIZES,
      none: 'none',
      screen: '100vh',
      lh: '1lh',
    },
    { fractions: true }
  ),
  basis: sizingFamily(
    ['flexBasis'],
    { auto: 'auto', full: '100%' },
    {
      fractions: true,
      containerScale: true,
    }
  ),
  // Flex and grid
  flex: integerFamily('flex', {
    auto: 'auto',
    initial: '0 auto',
    none: 'none',
  }),
  grow: integerFamily('flexGrow', { '': '1' }),
  shrink: integerFamily('flexShrink', { '': '1' }),
  'grid-cols': (parts) => gridTemplate('gridTemplateColumns', parts),
  'grid-rows': (parts) => gridTemplate('gridTemplateRows', parts),
  'col-span': (parts) => gridSpan('gridColumn', parts),
  'row-span': (parts) => gridSpan('gridRow', parts),
  'col-start': integerFamily('gridColumnStart', { auto: 'auto' }),
  'col-end': integerFamily('gridColumnEnd', { auto: 'auto' }),
  'row-start': integerFamily('gridRowStart', { auto: 'auto' }),
  'row-end': integerFamily('gridRowEnd', { auto: 'auto' }),
  justify: namedFamily('justifyContent', {
    start: 'flex-start',
    end: 'flex-end',
    center: 'center',
    between: 'space-between',
    around: 'space-around',
    evenly: 'space-evenly',
    stretch: 'stretch',
    normal: 'normal',
  }),
  items: namedFamily('alignItems', {
    start: 'flex-start',
    end: 'flex-end',
    center: 'center',
    baseline: 'baseline',
    stretch: 'stretch',
  }),
  content: namedFamily('alignContent', {
    start: 'flex-start',
    end: 'flex-end',
    center: 'center',
    between: 'space-between',
    around: 'space-around',
    evenly: 'space-evenly',
    stretch: 'stretch',
    normal: 'normal',
  }),
  self: namedFamily('alignSelf', {
    auto: 'auto',
    start: 'flex-start',
    end: 'flex-end',
    center: 'center',
    stretch: 'stretch',
    baseline: 'baseline',
  }),
  'justify-items': namedFamily('justifyItems', {
    start: 'start',
    end: 'end',
    center: 'center',
    stretch: 'stretch',
  }),
  'place-content': namedFamily('placeContent', {
    center: 'center',
    'center-safe': 'safe center',
    start: 'start',
    end: 'end',
    'end-safe': 'safe end',
    between: 'space-between',
    around: 'space-around',
    evenly: 'space-evenly',
    baseline: 'baseline',
    stretch: 'stretch',
  }),
  'place-items': namedFamily('placeItems', {
    start: 'start',
    end: 'end',
    'end-safe': 'safe end',
    center: 'center',
    'center-safe': 'safe center',
    baseline: 'baseline',
    stretch: 'stretch',
  }),
  'place-self': namedFamily('placeSelf', {
    auto: 'auto',
    start: 'start',
    end: 'end',
    'end-safe': 'safe end',
    center: 'center',
    'center-safe': 'safe center',
    stretch: 'stretch',
  }),
  'justify-self': namedFamily('justifySelf', {
    auto: 'auto',
    start: 'start',
    end: 'end',
    center: 'center',
    stretch: 'stretch',
  }),
  // Colors and backgrounds
  bg: (parts) => {
    if (
      !parts.arbitrary &&
      ['linear-', 'radial-', 'conic-', 'gradient-'].some((prefix) =>
        parts.value.startsWith(prefix)
      )
    ) {
      return undefined;
    }
    if (parts.arbitrary) {
      const type = arbitraryDataType(
        parts,
        ['image', 'url', 'percentage', 'position', 'bg-size', 'length', 'size'],
        ['image', 'color', 'percentage', 'position', 'bg-size', 'length', 'url']
      );
      if (type !== undefined && type !== 'color') {
        if (parts.modifier !== undefined || parts.negative) {
          return undefined;
        }
        const value = decodeArbitraryValue(parts.value);
        if (type === 'percentage' || type === 'position') {
          return { backgroundPosition: value };
        }
        if (type === 'bg-size' || type === 'length' || type === 'size') {
          return { backgroundSize: value };
        }
        return { backgroundImage: value };
      }
    }
    return colorFamily(['backgroundColor'])(parts);
  },
  // Typography
  text: (parts) => {
    if (!parts.arbitrary && !parts.negative) {
      const size = TEXT_SIZES[parts.value];
      if (size !== undefined) {
        const lineHeight = textLineHeight(parts, size.lineHeight);
        return lineHeight === undefined
          ? undefined
          : { fontSize: size.fontSize, lineHeight };
      }
    }
    if (parts.arbitrary) {
      const type = arbitraryDataType(
        parts,
        ['length', 'size', 'percentage', 'absolute-size', 'relative-size'],
        ['color', 'length', 'percentage', 'absolute-size', 'relative-size']
      );
      if (type !== undefined && type !== 'color') {
        if (parts.negative) {
          return undefined;
        }
        const lineHeight = textLineHeight(parts, undefined);
        const fontSize = decodeArbitraryValue(parts.value);
        if (parts.modifier !== undefined && lineHeight !== undefined) {
          return { fontSize, lineHeight };
        }
        return parts.modifier === undefined ? { fontSize } : undefined;
      }
    }
    return colorFamily(['color'])(parts);
  },
  font: (parts) => {
    if (parts.modifier !== undefined || parts.negative) {
      return undefined;
    }
    if (parts.arbitrary) {
      const type = arbitraryDataType(
        parts,
        ['generic-name', 'family-name'],
        ['number', 'generic-name', 'family-name']
      );
      const value = decodeArbitraryValue(parts.value);
      return type === 'generic-name' || type === 'family-name'
        ? { fontFamily: value }
        : { fontWeight: value };
    }
    if (FONT_WEIGHTS[parts.value] !== undefined) {
      return { fontWeight: FONT_WEIGHTS[parts.value] } as Declarations;
    }
    if (FONT_FAMILIES[parts.value] !== undefined) {
      return { fontFamily: FONT_FAMILIES[parts.value] } as Declarations;
    }
    return undefined;
  },
  leading: (parts) => {
    if (parts.modifier !== undefined || parts.negative) {
      return undefined;
    }
    if (parts.arbitrary) {
      return { lineHeight: arbitraryValue(parts) };
    }
    if (LEADING[parts.value] !== undefined) {
      return { lineHeight: LEADING[parts.value] };
    }
    const spacing = spacingValue(parts.value, false);
    return spacing === undefined ? undefined : { lineHeight: spacing };
  },
  tracking: namedFamily('letterSpacing', TRACKING, { arbitrary: true }),
  // Borders
  border: borderSideFamily(['borderWidth'], ['borderColor'], ['borderStyle']),
  'border-t': borderSideFamily(['borderTopWidth'], ['borderTopColor']),
  'border-r': borderSideFamily(['borderRightWidth'], ['borderRightColor']),
  'border-b': borderSideFamily(['borderBottomWidth'], ['borderBottomColor']),
  'border-l': borderSideFamily(['borderLeftWidth'], ['borderLeftColor']),
  'border-x': borderSideFamily(['borderInlineWidth'], ['borderInlineColor']),
  'border-y': borderSideFamily(['borderBlockWidth'], ['borderBlockColor']),
  rounded: radiusFamily(['borderRadius']),
  'rounded-t': radiusFamily(['borderTopLeftRadius', 'borderTopRightRadius']),
  'rounded-r': radiusFamily([
    'borderTopRightRadius',
    'borderBottomRightRadius',
  ]),
  'rounded-b': radiusFamily([
    'borderBottomRightRadius',
    'borderBottomLeftRadius',
  ]),
  'rounded-l': radiusFamily(['borderTopLeftRadius', 'borderBottomLeftRadius']),
  'rounded-tl': radiusFamily(['borderTopLeftRadius']),
  'rounded-tr': radiusFamily(['borderTopRightRadius']),
  'rounded-br': radiusFamily(['borderBottomRightRadius']),
  'rounded-bl': radiusFamily(['borderBottomLeftRadius']),
  // Effects
  shadow: (parts) => {
    if (parts.negative) {
      return undefined;
    }
    if (parts.arbitrary) {
      // A color sets Tailwind's shadow-color variable rather than a shadow.
      const value = decodeArbitraryValue(parts.value);
      const color =
        parts.dataType === undefined
          ? inferDataType(value, ['color']) !== undefined
          : parts.dataType === 'color';
      if (color) {
        return shadowColorDeclarations(parts);
      }
      return parts.modifier === undefined
        ? shadowDeclarations(wrapShadowColors(value))
        : undefined;
    }
    if (parts.value === 'inherit') {
      return parts.modifier === undefined
        ? { '--tw-shadow-color': 'inherit' }
        : undefined;
    }
    const color = shadowColorDeclarations(parts);
    if (color !== undefined || parts.modifier !== undefined) {
      return color;
    }
    if (parts.value === '') {
      return shadowDeclarations(wrapShadowColors(BARE_SHADOW));
    }
    if (parts.value === 'none') {
      return shadowDeclarations('0 0 #0000');
    }
    const shadow = SHADOWS[parts.value];
    return shadow === undefined
      ? undefined
      : shadowDeclarations(wrapShadowColors(shadow));
  },
  ring: (parts) => {
    if (parts.negative) {
      return undefined;
    }
    if (parts.value === '') {
      return parts.modifier === undefined ? ringDeclarations('1px') : undefined;
    }
    if (parts.arbitrary) {
      if (
        arbitraryDataType(parts, ['length'], ['color', 'length']) === 'length'
      ) {
        return parts.modifier === undefined
          ? ringDeclarations(decodeArbitraryValue(parts.value))
          : undefined;
      }
      return colorFamily(['--tw-ring-color'])(parts);
    }
    const color = colorFamily(['--tw-ring-color'])(parts);
    if (color !== undefined) {
      return color;
    }
    return parts.modifier === undefined && /^\d+$/.test(parts.value)
      ? ringDeclarations(`${parts.value}px`)
      : undefined;
  },
  'ring-offset': (parts) => {
    if (parts.negative || parts.value === '') {
      return undefined;
    }
    if (parts.arbitrary) {
      if (
        arbitraryDataType(parts, ['length'], ['color', 'length']) === 'length'
      ) {
        return parts.modifier === undefined
          ? ringOffsetDeclarations(decodeArbitraryValue(parts.value))
          : undefined;
      }
      return colorFamily(['--tw-ring-offset-color'])(parts);
    }
    if (parts.modifier === undefined && /^\d+$/.test(parts.value)) {
      return ringOffsetDeclarations(`${parts.value}px`);
    }
    return colorFamily(['--tw-ring-offset-color'])(parts);
  },
  'inset-ring': (parts) => {
    if (parts.negative) {
      return undefined;
    }
    if (parts.value === '') {
      return parts.modifier === undefined
        ? insetRingDeclarations('1px')
        : undefined;
    }
    if (parts.arbitrary) {
      if (
        arbitraryDataType(parts, ['length'], ['color', 'length']) === 'length'
      ) {
        return parts.modifier === undefined
          ? insetRingDeclarations(decodeArbitraryValue(parts.value))
          : undefined;
      }
      return colorFamily(['--tw-inset-ring-color'])(parts);
    }
    const color = colorFamily(['--tw-inset-ring-color'])(parts);
    if (color !== undefined) {
      return color;
    }
    return parts.modifier === undefined && /^\d+$/.test(parts.value)
      ? insetRingDeclarations(`${parts.value}px`)
      : undefined;
  },
  opacity: (parts) => {
    if (parts.modifier !== undefined || parts.negative) {
      return undefined;
    }
    if (parts.arbitrary) {
      return { opacity: arbitraryValue(parts) };
    }
    return /^\d+(\.\d+)?$/.test(parts.value)
      ? { opacity: `${parts.value}%` }
      : undefined;
  },
  // Transitions
  duration: integerFamily('transitionDuration', {}, { unit: 'ms' }),
  delay: integerFamily('transitionDelay', {}, { unit: 'ms' }),
  ease: namedFamily('transitionTimingFunction', EASINGS, { arbitrary: true }),
  // Layout details
  aspect: (parts) => {
    const fraction =
      parts.modifier !== undefined &&
      !parts.modifier.arbitrary &&
      /^\d+$/.test(parts.value) &&
      /^\d+$/.test(parts.modifier.value)
        ? `${parts.value}/${parts.modifier.value}`
        : undefined;
    if (fraction !== undefined) {
      return { aspectRatio: fraction };
    }
    if (parts.modifier !== undefined || parts.negative) {
      return undefined;
    }
    if (parts.arbitrary) {
      return { aspectRatio: arbitraryValue(parts) };
    }
    const named: Record<string, string> = {
      square: '1 / 1',
      video: '16 / 9',
      auto: 'auto',
    };
    return named[parts.value] === undefined
      ? undefined
      : { aspectRatio: named[parts.value] };
  },
  object: (parts) => {
    if (parts.modifier !== undefined || parts.negative) {
      return undefined;
    }
    if (parts.arbitrary) {
      return { objectPosition: arbitraryValue(parts) };
    }
    const fits = ['contain', 'cover', 'fill', 'none', 'scale-down'];
    if (fits.includes(parts.value)) {
      return { objectFit: parts.value } as Declarations;
    }
    const positions = ['top', 'bottom', 'left', 'right', 'center'];
    return positions.includes(parts.value)
      ? ({ objectPosition: parts.value } as Declarations)
      : undefined;
  },
  overflow: namedFamily('overflow', OVERFLOW_VALUES),
  'overflow-x': namedFamily('overflowX', OVERFLOW_VALUES),
  'overflow-y': namedFamily('overflowY', OVERFLOW_VALUES),
  whitespace: namedFamily('whiteSpace', {
    normal: 'normal',
    nowrap: 'nowrap',
    pre: 'pre',
    'pre-line': 'pre-line',
    'pre-wrap': 'pre-wrap',
    'break-spaces': 'break-spaces',
  }),
  align: namedFamily(
    'verticalAlign',
    {
      baseline: 'baseline',
      top: 'top',
      middle: 'middle',
      bottom: 'bottom',
      'text-top': 'text-top',
      'text-bottom': 'text-bottom',
      sub: 'sub',
      super: 'super',
    },
    { arbitrary: true }
  ),
  list: namedFamily('listStyleType', {
    none: 'none',
    disc: 'disc',
    decimal: 'decimal',
  }),
  // Interactivity
  cursor: namedFamily(
    'cursor',
    Object.fromEntries(
      [
        'auto',
        'default',
        'pointer',
        'wait',
        'text',
        'move',
        'help',
        'not-allowed',
        'none',
        'context-menu',
        'progress',
        'cell',
        'crosshair',
        'vertical-text',
        'alias',
        'copy',
        'no-drop',
        'grab',
        'grabbing',
        'all-scroll',
        'col-resize',
        'row-resize',
        'zoom-in',
        'zoom-out',
      ].map((value) => [value, value])
    ),
    { arbitrary: true }
  ),
  select: (parts) => {
    if (parts.modifier !== undefined || parts.negative || parts.arbitrary) {
      return undefined;
    }
    return ['none', 'text', 'all', 'auto'].includes(parts.value)
      ? {
          '-webkit-user-select': parts.value,
          userSelect: parts.value,
        }
      : undefined;
  },
  'pointer-events': namedFamily('pointerEvents', {
    none: 'none',
    auto: 'auto',
  }),
  accent: (parts) =>
    !parts.arbitrary && parts.value === 'auto' && parts.modifier === undefined
      ? { accentColor: 'auto' }
      : colorFamily(['accentColor'])(parts),
  caret: colorFamily(['caretColor']),
  // Outlines
  outline: widthOrColorFamily({
    width: (value) => ({
      outlineStyle: OUTLINE_STYLE_REFERENCE,
      outlineWidth: value,
    }),
    color: 'outlineColor',
    widthTypes: ['length', 'number', 'percentage'],
    types: ['color', 'length', 'number', 'percentage'],
    bareWidth: (value) => `${value}px`,
    named: {
      '': { outlineStyle: OUTLINE_STYLE_REFERENCE, outlineWidth: '1px' },
    },
  }),
  'outline-offset': pixelOffsetFamily('outlineOffset'),
  // Text decoration
  decoration: widthOrColorFamily({
    width: (value) => ({ textDecorationThickness: value }),
    color: 'textDecorationColor',
    widthTypes: ['length', 'percentage'],
    types: ['color', 'percentage', 'length'],
    bareWidth: (value) => `${value}px`,
    named: {
      auto: { textDecorationThickness: 'auto' },
      'from-font': { textDecorationThickness: 'from-font' },
      ...Object.fromEntries(
        ['solid', 'double', 'dotted', 'dashed', 'wavy'].map((style) => [
          style,
          { textDecorationStyle: style },
        ])
      ),
    },
  }),
  'underline-offset': pixelOffsetFamily('textUnderlineOffset', {
    auto: 'auto',
  }),
  // Line clamping
  'line-clamp': (parts) => {
    if (parts.modifier !== undefined || parts.negative) {
      return undefined;
    }
    if (!parts.arbitrary && parts.value === 'none') {
      return {
        overflow: 'visible',
        display: 'block',
        '-webkit-box-orient': 'horizontal',
        '-webkit-line-clamp': 'unset',
      };
    }
    const lines = parts.arbitrary
      ? arbitraryValue(parts)
      : /^\d+$/.test(parts.value)
        ? parts.value
        : undefined;
    return lines === undefined
      ? undefined
      : {
          overflow: 'hidden',
          display: '-webkit-box',
          '-webkit-box-orient': 'vertical',
          '-webkit-line-clamp': lines,
        };
  },
  // Multi-column layout
  columns: (parts) => {
    if (parts.modifier !== undefined || parts.negative) {
      return undefined;
    }
    if (parts.arbitrary) {
      return { columns: arbitraryValue(parts) };
    }
    if (parts.value === 'auto') {
      return { columns: 'auto' };
    }
    if (CONTAINER_SCALE[parts.value] !== undefined) {
      return { columns: CONTAINER_SCALE[parts.value] };
    }
    return /^\d+$/.test(parts.value) ? { columns: parts.value } : undefined;
  },
  // SVG
  fill: (parts) =>
    !parts.arbitrary && parts.value === 'none' && parts.modifier === undefined
      ? { fill: 'none' }
      : colorFamily(['fill'])(parts),
  stroke: widthOrColorFamily({
    width: (value) => ({ strokeWidth: value }),
    color: 'stroke',
    widthTypes: ['number', 'length', 'percentage'],
    types: ['color', 'number', 'length', 'percentage'],
    bareWidth: (value) => value,
    named: { none: { stroke: 'none' } },
  }),
  // Scroll margin and padding
  'scroll-m': spacingFamily(['scrollMargin']),
  'scroll-mx': spacingFamily(['scrollMarginInline']),
  'scroll-my': spacingFamily(['scrollMarginBlock']),
  'scroll-mt': spacingFamily(['scrollMarginTop']),
  'scroll-mr': spacingFamily(['scrollMarginRight']),
  'scroll-mb': spacingFamily(['scrollMarginBottom']),
  'scroll-ml': spacingFamily(['scrollMarginLeft']),
  'scroll-p': spacingFamily(['scrollPadding']),
  'scroll-px': spacingFamily(['scrollPaddingInline']),
  'scroll-py': spacingFamily(['scrollPaddingBlock']),
  'scroll-pt': spacingFamily(['scrollPaddingTop']),
  'scroll-pr': spacingFamily(['scrollPaddingRight']),
  'scroll-pb': spacingFamily(['scrollPaddingBottom']),
  'scroll-pl': spacingFamily(['scrollPaddingLeft']),
};

function gridTemplate(
  property: string,
  parts: ValueParts
): Declarations | undefined {
  if (parts.modifier !== undefined || parts.negative) {
    return undefined;
  }
  if (parts.arbitrary) {
    return { [property]: arbitraryValue(parts) };
  }
  if (parts.value === 'none' || parts.value === 'subgrid') {
    return { [property]: parts.value };
  }
  return /^\d+$/.test(parts.value)
    ? { [property]: `repeat(${parts.value}, minmax(0, 1fr))` }
    : undefined;
}

function gridSpan(
  property: string,
  parts: ValueParts
): Declarations | undefined {
  if (parts.modifier !== undefined || parts.negative || parts.arbitrary) {
    return undefined;
  }
  if (parts.value === 'full') {
    return { [property]: '1 / -1' };
  }
  return /^\d+$/.test(parts.value)
    ? { [property]: `span ${parts.value} / span ${parts.value}` }
    : undefined;
}

function textLineHeight(
  parts: ValueParts,
  paired: string | undefined
): string | undefined {
  if (parts.modifier === undefined) {
    return paired;
  }
  if (parts.modifier.arbitrary) {
    return decodeArbitraryValue(parts.modifier.value);
  }
  return spacingValue(parts.modifier.value, false);
}

/** Roots whose negative form (`-mt-2`) is meaningful. */
const NEGATIVE_ROOTS = new Set([
  'm',
  'mx',
  'my',
  'mt',
  'mr',
  'mb',
  'ml',
  'inset',
  'inset-x',
  'inset-y',
  'top',
  'right',
  'bottom',
  'left',
  'z',
  'order',
  'outline-offset',
  'underline-offset',
  'scroll-m',
  'scroll-mx',
  'scroll-my',
  'scroll-mt',
  'scroll-mr',
  'scroll-mb',
  'scroll-ml',
]);

/**
 * Utility roots that are out of the conversion subset by the
 * self-containment rule, with the reason used in the processing error, or
 * an empty reason for a root the error names without one.
 */
const EXCLUDED_ROOTS: Record<string, string> = {
  'inset-shadow': '',
  space: 'styles sibling elements through child combinators',
  divide: 'styles sibling elements through child combinators',
  transform: "relies on Tailwind's composed custom-property machinery",
  translate: "relies on Tailwind's composed custom-property machinery",
  rotate: "relies on Tailwind's composed custom-property machinery",
  scale: "relies on Tailwind's composed custom-property machinery",
  skew: "relies on Tailwind's composed custom-property machinery",
  perspective: "relies on Tailwind's composed custom-property machinery",
  animate: 'requires generated @keyframes rules',
  'bg-linear': "relies on Tailwind's composed custom-property machinery",
  'bg-radial': "relies on Tailwind's composed custom-property machinery",
  'bg-conic': "relies on Tailwind's composed custom-property machinery",
  'bg-gradient': "relies on Tailwind's composed custom-property machinery",
  transition: "relies on Tailwind's composed custom-property machinery",
  filter: "relies on Tailwind's composed custom-property machinery",
  blur: "relies on Tailwind's composed custom-property machinery",
  brightness: "relies on Tailwind's composed custom-property machinery",
  contrast: "relies on Tailwind's composed custom-property machinery",
  'drop-shadow': "relies on Tailwind's composed custom-property machinery",
  grayscale: "relies on Tailwind's composed custom-property machinery",
  'hue-rotate': "relies on Tailwind's composed custom-property machinery",
  invert: "relies on Tailwind's composed custom-property machinery",
  saturate: "relies on Tailwind's composed custom-property machinery",
  sepia: "relies on Tailwind's composed custom-property machinery",
  backdrop: "relies on Tailwind's composed custom-property machinery",
  from: "relies on Tailwind's composed custom-property machinery",
  via: "relies on Tailwind's composed custom-property machinery",
  to: "relies on Tailwind's composed custom-property machinery",
  snap: "relies on Tailwind's composed custom-property machinery",
};

/**
 * Whether a root of the conversion table longer than `root` also prefixes
 * the body, so that root claims it: `inset-x-2` belongs to `inset-x`, not
 * to a shorter excluded or unsupported root.
 */
function isShadowedByTableRoot(body: string, root: string): boolean {
  return Object.keys(FUNCTIONAL_UTILITIES).some(
    (tableRoot) =>
      tableRoot.length > root.length &&
      (body === tableRoot || body.startsWith(`${tableRoot}-`))
  );
}

/**
 * Resolves the utility part of a candidate (variants already stripped) to
 * its CSS declarations. Unknown utilities, utilities outside the supported
 * subset, and unsupported values are processing errors.
 */
export function resolveBaseUtility(
  base: string,
  candidate: string,
  fail: ConversionFail
): ResolvedUtility {
  const resolved = resolveUtility(base, candidate, fail);
  if (Object.values(resolved.declarations).some(usesThemeFunction)) {
    fail(
      `Cannot convert Tailwind utility '${candidate}': Tailwind's theme functions resolve against a Tailwind build and are outside the supported conversion subset`
    );
  }
  return resolved;
}

/**
 * True when a decoded value calls one of Tailwind's theme functions
 * (`theme()`, `--theme()`, `--spacing()`, `--alpha()`) outside a `url()`.
 */
function usesThemeFunction(value: string): boolean {
  let outsideUrls = '';
  let index = 0;
  while (index < value.length) {
    const segment = keptSegment(value, index);
    if (segment?.kind === 'url') {
      outsideUrls += ' ';
      index = segment.end;
      continue;
    }
    outsideUrls += value[index];
    index += 1;
  }
  return /(?<![\w.-])(?:theme|--theme|--spacing|--alpha)\(/.test(outsideUrls);
}

function resolveUtility(
  base: string,
  candidate: string,
  fail: ConversionFail
): ResolvedUtility {
  let body = base;
  let important = false;
  // Tailwind v4 writes `!` after the utility and still reads the leading
  // form (`hover:!p-1`).
  if (body.endsWith('!')) {
    important = true;
    body = body.slice(0, -1);
  } else if (body.startsWith('!')) {
    important = true;
    body = body.slice(1);
  }

  // A property name, vendor-prefixed (`-webkit-line-clamp`) or custom
  // (`--gutter`), then its value.
  const arbitraryProperty = body.match(
    /^\[(--[a-zA-Z0-9_-]+|-?[a-zA-Z][a-zA-Z-]*):(.+)\]$/
  );
  if (arbitraryProperty !== null) {
    return {
      declarations: {
        [arbitraryProperty[1]]: decodeArbitraryValue(arbitraryProperty[2]),
      },
      important,
    };
  }

  let negative = false;
  if (body.startsWith('-')) {
    negative = true;
    body = body.slice(1);
  }

  for (const [root, reason] of Object.entries(EXCLUDED_ROOTS)) {
    if (body === root || body.startsWith(`${root}-`)) {
      // Longer table roots shadow excluded prefixes (`inset-x` over `inset-ring`).
      const shadowed = isShadowedByTableRoot(body, root);
      const staticHit = !negative && STATIC_UTILITIES[body] !== undefined;
      if (!shadowed && !staticHit) {
        fail(
          `Cannot convert Tailwind utility '${candidate}': '${root}' ${
            reason === '' ? 'is' : `${reason} and is`
          } outside the supported conversion subset`
        );
      }
    }
  }

  if (!negative && STATIC_UTILITIES[body] !== undefined) {
    const nested = NESTED_STATIC_UTILITIES[body];
    return {
      declarations: { ...STATIC_UTILITIES[body] },
      ...(nested === undefined ? {} : { nested }),
      important,
    };
  }

  const { declarations: resolved, matchedRoot } = resolveFunctional(
    body,
    negative
  );
  if (resolved instanceof UnsupportedValue) {
    fail(`Cannot convert Tailwind utility '${candidate}': ${resolved.reason}`);
  }
  if (resolved !== undefined) {
    return { declarations: resolved, important };
  }
  const tailwindName = unsupportedUtilityName(body, negative, {
    isShadowed: (root) => isShadowedByTableRoot(body, root),
    resolves: (counterpart, counterpartNegative) => {
      const { declarations } = resolveFunctional(
        counterpart,
        counterpartNegative
      );
      return (
        declarations !== undefined &&
        !(declarations instanceof UnsupportedValue)
      );
    },
  });
  if (tailwindName !== undefined) {
    fail(
      `Cannot convert Tailwind utility '${candidate}': '${tailwindName}' is outside the supported conversion subset`,
      'unsupported-utility'
    );
  }
  if (matchedRoot) {
    fail(
      `Cannot convert Tailwind utility '${candidate}': unsupported value`,
      'unsupported-value'
    );
  }
  fail(
    `Cannot convert Tailwind utility '${candidate}': unknown utility`,
    'unknown-utility'
  );
}

/**
 * The arbitrary value of a utility body, if it has one: `p-[3px]`, or the
 * custom-property shorthand `bg-(--brand)` for `bg-[var(--brand)]` - its
 * root, raw value, and type hint.
 */
function arbitraryParts(
  valueBody: string
): { root: string; value: string; dataType?: string } | undefined {
  const bracketStart = valueBody.indexOf('-[');
  if (bracketStart !== -1 && valueBody.endsWith(']')) {
    const { value, dataType } = splitTypeHint(
      valueBody.slice(bracketStart + 2, -1)
    );
    return { root: valueBody.slice(0, bracketStart), value, dataType };
  }
  const parenthesisStart = valueBody.indexOf('-(');
  if (parenthesisStart !== -1 && valueBody.endsWith(')')) {
    const { value, dataType } = splitTypeHint(
      valueBody.slice(parenthesisStart + 2, -1)
    );
    return {
      root: valueBody.slice(0, parenthesisStart),
      value: value.startsWith('--') ? `var(${value})` : value,
      dataType,
    };
  }
  return undefined;
}

function resolveFunctional(
  body: string,
  negative: boolean
): { declarations?: Declarations | UnsupportedValue; matchedRoot: boolean } {
  let matchedRoot = false;
  const { body: valueBody, modifier } = splitModifier(body);

  // An arbitrary value fixes the root: everything before `-[` or `-(`.
  const arbitrary = arbitraryParts(valueBody);
  if (arbitrary !== undefined) {
    const resolver = FUNCTIONAL_UTILITIES[arbitrary.root];
    if (
      resolver === undefined ||
      (negative && !NEGATIVE_ROOTS.has(arbitrary.root))
    ) {
      return { matchedRoot: resolver !== undefined };
    }
    if (!arbitrary.value.startsWith('var(--') && valueBody.endsWith(')')) {
      return {
        declarations: new UnsupportedValue(
          'the parenthesized shorthand takes a custom property, such as (--brand)'
        ),
        matchedRoot: true,
      };
    }
    const declarations = resolver({
      value: arbitrary.value,
      arbitrary: true,
      dataType: arbitrary.dataType,
      negative,
      modifier,
    });
    return { declarations, matchedRoot: true };
  }

  const splits: Array<[string, string]> = [[valueBody, '']];
  for (let index = valueBody.length - 1; index > 0; index -= 1) {
    if (valueBody[index] === '-') {
      splits.push([valueBody.slice(0, index), valueBody.slice(index + 1)]);
    }
  }

  for (const [root, value] of splits) {
    const resolver = FUNCTIONAL_UTILITIES[root];
    if (resolver === undefined) {
      continue;
    }
    if (negative && !NEGATIVE_ROOTS.has(root)) {
      matchedRoot = true;
      continue;
    }
    matchedRoot = true;
    const declarations = resolver({
      value,
      arbitrary: false,
      negative,
      modifier,
    });
    if (declarations !== undefined) {
      return { declarations, matchedRoot };
    }
  }

  return { matchedRoot };
}
