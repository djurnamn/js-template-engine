import {
  BARE_RADIUS,
  BARE_SHADOW,
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
import { decodeArbitraryValue, splitModifier } from './parse';
import type { ConversionFail } from './variants';

/** CSS declarations produced by one utility, in camelCase property form. */
export type Declarations = Record<string, string>;

/** A resolved utility: its declarations and the `!` important flag. */
export interface ResolvedUtility {
  declarations: Declarations;
  important: boolean;
}

interface ValueParts {
  /** The value text after the root; empty for bare roots (`border`). */
  value: string;
  arbitrary: boolean;
  negative: boolean;
  modifier?: { value: string; arbitrary: boolean };
}

type UtilityResolver = (parts: ValueParts) => Declarations | undefined;

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
  if (
    parts.modifier.arbitrary ||
    !/^\d+(\.\d+)?$/.test(parts.modifier.value)
  ) {
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
      const value = decodeArbitraryValue(parts.value);
      if (parts.modifier === undefined && /^[\d.]/.test(value)) {
        return declarations(widthProperties, value);
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
    return radius === undefined
      ? undefined
      : declarations(properties, radius);
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
    { ...SIZING_KEYWORDS, screen: '100vw' },
    { fractions: true, containerScale: true }
  ),
  h: sizingFamily(
    ['height'],
    { ...SIZING_KEYWORDS, screen: '100vh' },
    { fractions: true }
  ),
  size: sizingFamily(['width', 'height'], SIZING_KEYWORDS, {
    fractions: true,
  }),
  'min-w': sizingFamily(['minWidth'], SIZING_KEYWORDS, {
    containerScale: true,
  }),
  'max-w': sizingFamily(
    ['maxWidth'],
    { ...SIZING_KEYWORDS, none: 'none' },
    { containerScale: true }
  ),
  'min-h': sizingFamily(['minHeight'], {
    ...SIZING_KEYWORDS,
    screen: '100vh',
  }),
  'max-h': sizingFamily(['maxHeight'], {
    ...SIZING_KEYWORDS,
    none: 'none',
    screen: '100vh',
  }),
  basis: sizingFamily(['flexBasis'], SIZING_KEYWORDS, {
    fractions: true,
    containerScale: true,
  }),
  // Flex and grid
  flex: integerFamily('flex', {
    auto: 'auto',
    initial: '0 auto',
    none: 'none',
  }),
  grow: integerFamily('flexGrow', { '': '1' }),
  shrink: integerFamily('flexShrink', { '': '1' }),
  'grid-cols': (parts) =>
    gridTemplate('gridTemplateColumns', parts),
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
      ['linear-', 'radial-', 'conic-', 'gradient-'].some((prefix) =>
        parts.value.startsWith(prefix)
      )
    ) {
      return undefined;
    }
    if (parts.arbitrary) {
      const value = decodeArbitraryValue(parts.value);
      if (value.startsWith('url(')) {
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
    if (parts.arbitrary && /^[\d.]/.test(parts.value)) {
      const lineHeight = textLineHeight(parts, undefined);
      const fontSize = decodeArbitraryValue(parts.value);
      if (parts.modifier !== undefined && lineHeight !== undefined) {
        return { fontSize, lineHeight };
      }
      return parts.modifier === undefined ? { fontSize } : undefined;
    }
    return colorFamily(['color'])(parts);
  },
  font: (parts) => {
    if (parts.modifier !== undefined || parts.negative) {
      return undefined;
    }
    if (parts.arbitrary) {
      const value = decodeArbitraryValue(parts.value);
      const property = /^\d+$/.test(value) ? 'fontWeight' : 'fontFamily';
      return { [property]: value };
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
  'rounded-l': radiusFamily([
    'borderTopLeftRadius',
    'borderBottomLeftRadius',
  ]),
  'rounded-tl': radiusFamily(['borderTopLeftRadius']),
  'rounded-tr': radiusFamily(['borderTopRightRadius']),
  'rounded-br': radiusFamily(['borderBottomRightRadius']),
  'rounded-bl': radiusFamily(['borderBottomLeftRadius']),
  // Effects
  shadow: (parts) => {
    if (parts.modifier !== undefined || parts.negative) {
      return undefined;
    }
    if (parts.value === '') {
      return { boxShadow: BARE_SHADOW };
    }
    if (parts.arbitrary) {
      return { boxShadow: arbitraryValue(parts) };
    }
    const shadow = SHADOWS[parts.value];
    return shadow === undefined ? undefined : { boxShadow: shadow };
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
]);

/**
 * Utility roots that are out of the conversion subset by the
 * self-containment rule, with the reason used in the processing error.
 */
const EXCLUDED_ROOTS: Record<string, string> = {
  space: 'styles sibling elements through child combinators',
  divide: 'styles sibling elements through child combinators',
  ring: "relies on Tailwind's composed custom-property machinery",
  'inset-ring': "relies on Tailwind's composed custom-property machinery",
  'ring-offset': "relies on Tailwind's composed custom-property machinery",
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
};

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
  let body = base;
  let important = false;
  if (body.endsWith('!')) {
    important = true;
    body = body.slice(0, -1);
  }

  const arbitraryProperty = body.match(/^\[([a-zA-Z][a-zA-Z-]*):(.+)\]$/);
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
      const shadowed = Object.keys(FUNCTIONAL_UTILITIES).some(
        (tableRoot) =>
          tableRoot.length > root.length &&
          (body === tableRoot || body.startsWith(`${tableRoot}-`))
      );
      const staticHit = !negative && STATIC_UTILITIES[body] !== undefined;
      if (!shadowed && !staticHit) {
        fail(
          `Cannot convert Tailwind utility '${candidate}': '${root}' ${reason} and is outside the supported conversion subset`
        );
      }
    }
  }

  if (!negative && STATIC_UTILITIES[body] !== undefined) {
    return { declarations: { ...STATIC_UTILITIES[body] }, important };
  }

  const { declarations: resolved, matchedRoot } = resolveFunctional(
    body,
    negative
  );
  if (resolved !== undefined) {
    return { declarations: resolved, important };
  }
  if (matchedRoot) {
    fail(
      `Cannot convert Tailwind utility '${candidate}': unsupported value`
    );
  }
  fail(`Cannot convert Tailwind utility '${candidate}': unknown utility`);
}

function resolveFunctional(
  body: string,
  negative: boolean
): { declarations?: Declarations; matchedRoot: boolean } {
  let matchedRoot = false;
  const { body: valueBody, modifier } = splitModifier(body);

  // An arbitrary value fixes the root: everything before `-[`.
  const arbitraryStart = valueBody.indexOf('-[');
  if (arbitraryStart !== -1 && valueBody.endsWith(']')) {
    const root = valueBody.slice(0, arbitraryStart);
    const resolver = FUNCTIONAL_UTILITIES[root];
    if (resolver === undefined || (negative && !NEGATIVE_ROOTS.has(root))) {
      return { matchedRoot: resolver !== undefined };
    }
    const declarations = resolver({
      value: valueBody.slice(arbitraryStart + 2, -1),
      arbitrary: true,
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
