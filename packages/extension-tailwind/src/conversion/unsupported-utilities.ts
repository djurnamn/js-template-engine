/**
 * The values a functional Tailwind v4 root takes, as far as the error needs
 * to tell them from a plain class name that happens to share its prefix
 * (`start-0` from `start-panel`).
 */
interface RootValues {
  /**
   * A root the converter maps whose values this root shares: the value is
   * valid when the converter resolves it under that root (`ms-2` as
   * `ml-2`), arbitrary values included.
   */
  like?: string;
  /** Named values (`origin-top-left`); an empty name is the bare root. */
  keywords?: readonly string[];
  /** Whether a whole number is a value (`col-3`, `zoom-50`). */
  integer?: boolean;
  /** Whether a percentage is a value (`font-stretch-50%`). */
  percentage?: boolean;
  /** Whether a bracketed or parenthesized value is (`bg-size-[10px]`). */
  arbitrary?: boolean;
  /** Whether a theme color, with an opacity modifier, is (`placeholder-red-500/50`). */
  color?: boolean;
  /** Whether a numeric opacity modifier may follow a keyword (`text-shadow-lg/20`). */
  keywordModifier?: boolean;
  /** Whether the root takes a leading `-` (`-ms-2`). */
  negative?: boolean;
  /** Values of the {@link RootValues.like} root this root does not take. */
  except?: readonly string[];
  /** Whether only a whole number takes a leading `-` (`-col-3`, not `-col-auto`). */
  negativeIntegerOnly?: boolean;
}

const SPACING_LIKE_MARGIN: RootValues = { like: 'ml', negative: true };
const SPACING_LIKE_PADDING: RootValues = { like: 'pl' };
const INSET_LIKE_LEFT: RootValues = { like: 'left', negative: true };

/**
 * The functional utility roots Tailwind v4 defines that the converter does
 * not map, each with the values it takes. A utility body that is one of
 * these roots followed by a value it takes is Tailwind vocabulary outside
 * the conversion subset; the same root with any other value is not
 * Tailwind's.
 */
const UNSUPPORTED_UTILITY_ROOTS: Record<string, RootValues> = {
  // Layout and logical-property spacing and sizing
  'inset-s': INSET_LIKE_LEFT,
  'inset-e': INSET_LIKE_LEFT,
  'inset-bs': INSET_LIKE_LEFT,
  'inset-be': INSET_LIKE_LEFT,
  start: INSET_LIKE_LEFT,
  end: INSET_LIKE_LEFT,
  ms: SPACING_LIKE_MARGIN,
  me: SPACING_LIKE_MARGIN,
  mbs: SPACING_LIKE_MARGIN,
  mbe: SPACING_LIKE_MARGIN,
  ps: SPACING_LIKE_PADDING,
  pe: SPACING_LIKE_PADDING,
  pbs: SPACING_LIKE_PADDING,
  pbe: SPACING_LIKE_PADDING,
  inline: { like: 'w' },
  block: { like: 'h' },
  'min-inline': { like: 'min-w' },
  'max-inline': { like: 'max-w' },
  'min-block': { like: 'min-h' },
  'max-block': { like: 'max-h' },
  'scroll-ms': { like: 'scroll-ml', negative: true },
  'scroll-me': { like: 'scroll-ml', negative: true },
  'scroll-mbs': { like: 'scroll-ml', negative: true },
  'scroll-mbe': { like: 'scroll-ml', negative: true },
  'scroll-ps': { like: 'scroll-pl' },
  'scroll-pe': { like: 'scroll-pl' },
  'scroll-pbs': { like: 'scroll-pl' },
  'scroll-pbe': { like: 'scroll-pl' },
  // Flexbox and grid
  col: {
    keywords: ['auto'],
    integer: true,
    arbitrary: true,
    negative: true,
    negativeIntegerOnly: true,
  },
  row: {
    keywords: ['auto'],
    integer: true,
    arbitrary: true,
    negative: true,
    negativeIntegerOnly: true,
  },
  'auto-cols': {
    keywords: ['auto', 'min', 'max', 'fr'],
    integer: true,
    arbitrary: true,
  },
  'auto-rows': {
    keywords: ['auto', 'min', 'max', 'fr'],
    integer: true,
    arbitrary: true,
  },
  'flex-grow': { like: 'grow' },
  'flex-shrink': { like: 'shrink' },
  // Borders
  'border-s': { like: 'border-l' },
  'border-e': { like: 'border-l' },
  'border-bs': { like: 'border-l' },
  'border-be': { like: 'border-l' },
  'rounded-s': { like: 'rounded-l' },
  'rounded-e': { like: 'rounded-l' },
  'rounded-ss': { like: 'rounded-tl' },
  'rounded-se': { like: 'rounded-tl' },
  'rounded-ee': { like: 'rounded-tl' },
  'rounded-es': { like: 'rounded-tl' },
  // Backgrounds and effects
  'bg-size': { arbitrary: true },
  'bg-position': { arbitrary: true },
  'text-shadow': {
    keywords: ['2xs', 'xs', 'sm', 'md', 'lg', 'none', 'initial'],
    keywordModifier: true,
    color: true,
    arbitrary: true,
  },
  // Typography
  indent: { like: 'ml', negative: true, except: ['auto'] },
  tab: { integer: true, arbitrary: true },
  'font-features': { arbitrary: true },
  'font-stretch': {
    keywords: [
      'ultra-condensed',
      'extra-condensed',
      'condensed',
      'semi-condensed',
      'normal',
      'semi-expanded',
      'expanded',
      'extra-expanded',
      'ultra-expanded',
    ],
    percentage: true,
    arbitrary: true,
  },
  'list-image': { keywords: ['none'], arbitrary: true },
  placeholder: { color: true },
  // Interactivity, transforms and performance
  origin: {
    keywords: [
      'center',
      'top',
      'top-right',
      'right',
      'bottom-right',
      'bottom',
      'bottom-left',
      'left',
      'top-left',
    ],
    arbitrary: true,
  },
  zoom: { integer: true, arbitrary: true },
  'scrollbar-thumb': { color: true },
  'scrollbar-track': { color: true },
  'will-change': {
    keywords: ['auto', 'scroll', 'contents', 'transform'],
    arbitrary: true,
  },
  contain: {
    keywords: [
      'none',
      'content',
      'strict',
      'size',
      'inline-size',
      'layout',
      'style',
      'paint',
    ],
    arbitrary: true,
  },
};

/** A bracketed value or the parenthesized custom-property shorthand. */
const ARBITRARY_VALUE = /^(?:\[.+\]|\((?:[a-z-]+:)?--[A-Za-z0-9_-]+\))$/;

/**
 * `@container`, a container name after `/`, and its `-normal`, `-size` and
 * arbitrary types (`@container-size/main`, `@container-[scroll-state]`).
 */
const CONTAINER_UTILITY =
  /^@container(?:-(?:normal|size|\[.+\]|\(--[A-Za-z0-9_-]+\)))?(?:\/[A-Za-z0-9_-]+)?$/;

/**
 * Whether the body after a root (`-2`, `-red-500/50`, or empty for the
 * bare root) is a value the root takes; a bare root takes one only
 * through its {@link RootValues.like} root (`border-s` as `border-l`).
 */
function takesValue(
  values: RootValues,
  rest: string,
  negative: boolean,
  resolves: (body: string, negative: boolean) => boolean
): boolean {
  const value = rest.slice(1);
  if (values.like !== undefined) {
    return (
      !(values.except ?? []).includes(value) &&
      resolves(`${values.like}${rest}`, negative)
    );
  }
  if (!rest.startsWith('-')) {
    return false;
  }
  if (negative && values.negativeIntegerOnly === true) {
    return /^\d+$/.test(value);
  }
  if (values.color === true && resolves(`caret${rest}`, false)) {
    return true;
  }
  const slash = value.lastIndexOf('/');
  const [name, modifier] =
    slash === -1 || ARBITRARY_VALUE.test(value)
      ? [value, undefined]
      : [value.slice(0, slash), value.slice(slash + 1)];
  if (modifier !== undefined) {
    return (
      values.keywordModifier === true &&
      /^\d+$/.test(modifier) &&
      (values.keywords ?? []).includes(name) &&
      name !== 'none' &&
      name !== 'initial'
    );
  }
  return (
    (values.keywords ?? []).includes(value) ||
    (values.integer === true && /^\d+$/.test(value)) ||
    (values.percentage === true && /^\d+%$/.test(value)) ||
    (values.arbitrary === true && ARBITRARY_VALUE.test(value))
  );
}

/**
 * The static utilities Tailwind v4 defines that the converter does not
 * map, as a root and the values it takes; an empty value is the bare root
 * (`container`).
 */
const UNSUPPORTED_STATIC_FAMILIES: Record<string, readonly string[]> = {
  container: [''],
  float: ['start', 'end', 'right', 'left', 'none'],
  clear: ['start', 'end', 'right', 'left', 'both', 'none'],
  table: [
    'caption',
    'cell',
    'column',
    'column-group',
    'footer-group',
    'header-group',
    'row-group',
    'row',
    'auto',
    'fixed',
  ],
  list: ['item', 'inside', 'outside'],
  caption: ['top', 'bottom'],
  border: ['collapse', 'separate'],
  'box-decoration': ['slice', 'clone'],
  decoration: ['slice', 'clone'],
  backface: ['visible', 'hidden'],
  scheme: ['normal', 'dark', 'light', 'light-dark', 'only-dark', 'only-light'],
  'grid-flow': ['row', 'col', 'dense', 'row-dense', 'col-dense'],
  'break-before': [
    'auto',
    'avoid',
    'all',
    'avoid-page',
    'page',
    'left',
    'right',
    'column',
  ],
  'break-inside': ['auto', 'avoid', 'avoid-page', 'avoid-column'],
  'break-after': [
    'auto',
    'avoid',
    'all',
    'avoid-page',
    'page',
    'left',
    'right',
    'column',
  ],
  content: ['none', 'baseline', 'center-safe', 'end-safe'],
  items: ['center-safe', 'end-safe', 'baseline-last'],
  justify: ['center-safe', 'end-safe', 'baseline'],
  'justify-items': ['normal', 'center-safe', 'end-safe'],
  self: ['center-safe', 'end-safe', 'baseline-last'],
  'justify-self': ['center-safe', 'end-safe'],
  overflow: ['ellipsis'],
  hyphens: ['none', 'manual', 'auto'],
  wrap: ['anywhere', 'break-word', 'normal'],
  bg: [
    'top-left',
    'top-right',
    'bottom-left',
    'bottom-right',
    'left-top',
    'right-top',
    'left-bottom',
    'right-bottom',
  ],
  'bg-clip': ['text', 'border', 'padding', 'content'],
  'bg-origin': ['border', 'padding', 'content'],
  'bg-blend': [
    'normal',
    'multiply',
    'screen',
    'overlay',
    'darken',
    'lighten',
    'color-dodge',
    'color-burn',
    'hard-light',
    'soft-light',
    'difference',
    'exclusion',
    'hue',
    'saturation',
    'color',
    'luminosity',
  ],
  'mix-blend': [
    'normal',
    'multiply',
    'screen',
    'overlay',
    'darken',
    'lighten',
    'color-dodge',
    'color-burn',
    'hard-light',
    'soft-light',
    'difference',
    'exclusion',
    'hue',
    'saturation',
    'color',
    'luminosity',
    'plus-darker',
    'plus-lighter',
  ],
  object: [
    'top-left',
    'top-right',
    'bottom-left',
    'bottom-right',
    'left-top',
    'right-top',
    'left-bottom',
    'right-bottom',
  ],
  cursor: [
    'n-resize',
    'e-resize',
    's-resize',
    'w-resize',
    'ne-resize',
    'nw-resize',
    'se-resize',
    'sw-resize',
    'ew-resize',
    'ns-resize',
    'nesw-resize',
    'nwse-resize',
  ],
  touch: [
    'auto',
    'none',
    'manipulation',
    'pan-x',
    'pan-left',
    'pan-right',
    'pan-y',
    'pan-up',
    'pan-down',
    'pinch-zoom',
  ],
  scroll: ['auto', 'smooth'],
  scrollbar: ['auto', 'thin', 'none'],
  'scrollbar-gutter': ['auto', 'stable', 'both'],
  overscroll: ['auto', 'contain', 'none'],
  'overscroll-x': ['auto', 'contain', 'none'],
  'overscroll-y': ['auto', 'contain', 'none'],
  'forced-color-adjust': ['none', 'auto'],
  mask: [
    'none',
    'add',
    'subtract',
    'intersect',
    'exclude',
    'alpha',
    'luminance',
    'match',
    'type-alpha',
    'type-luminance',
    'auto',
    'cover',
    'contain',
    'top',
    'top-left',
    'top-right',
    'bottom',
    'bottom-left',
    'bottom-right',
    'left',
    'right',
    'center',
    'repeat',
    'no-repeat',
    'repeat-x',
    'repeat-y',
    'repeat-round',
    'repeat-space',
    'clip-border',
    'clip-padding',
    'clip-content',
    'clip-fill',
    'clip-stroke',
    'clip-view',
    'no-clip',
    'origin-border',
    'origin-padding',
    'origin-content',
    'origin-fill',
    'origin-stroke',
    'origin-view',
    'circle',
    'ellipse',
    'radial-closest-side',
    'radial-farthest-side',
    'radial-closest-corner',
    'radial-farthest-corner',
    'radial-at-top',
    'radial-at-top-left',
    'radial-at-top-right',
    'radial-at-bottom',
    'radial-at-bottom-left',
    'radial-at-bottom-right',
    'radial-at-left',
    'radial-at-right',
    'radial-at-center',
  ],
  duration: ['initial'],
  ease: ['initial'],
  shadow: ['initial'],
};

const UNSUPPORTED_STATIC_UTILITIES: ReadonlySet<string> = new Set(
  Object.entries(UNSUPPORTED_STATIC_FAMILIES).flatMap(([root, values]) =>
    values.map((value) => (value === '' ? root : `${root}-${value}`))
  )
);

/**
 * Names the Tailwind v4 utility a body the converter could not resolve
 * belongs to, when Tailwind defines it: the static utility itself
 * (`float-left`, `scheme-dark`), or the functional root it starts with,
 * given a value that root takes (`ms` for `ms-2`, `@container` for
 * `@container/sidebar`). `undefined` for a body Tailwind does not define
 * (`start-panel`, `row-header`), or one a longer root the converter maps
 * claims, so the error says the value is unsupported rather than naming a
 * shorter root.
 *
 * @param body - The utility body, without variants, `!` or a leading `-`.
 * @param negative - Whether the utility was written with a leading `-`.
 * @param converter - `isShadowed` tells whether a root the converter maps,
 *   longer than the given root, also prefixes the body; `resolves` whether
 *   the converter resolves a utility body, written with a leading `-` or
 *   not.
 * @returns The static utility or functional root to name in the error.
 * @example
 * unsupportedUtilityName('ms-2', false, converter); // 'ms'
 */
export function unsupportedUtilityName(
  body: string,
  negative: boolean,
  converter: {
    isShadowed: (root: string) => boolean;
    resolves: (body: string, negative: boolean) => boolean;
  }
): string | undefined {
  if (!negative && UNSUPPORTED_STATIC_UTILITIES.has(body)) {
    return body;
  }
  if (!negative && CONTAINER_UTILITY.test(body)) {
    return '@container';
  }
  return Object.entries(UNSUPPORTED_UTILITY_ROOTS)
    .filter(
      ([root, values]) =>
        (body === root || body.startsWith(`${root}-`)) &&
        (!negative || values.negative === true) &&
        !converter.isShadowed(root) &&
        takesValue(
          values,
          body.slice(root.length),
          negative,
          converter.resolves
        )
    )
    .map(([root]) => root)
    .sort((first, second) => second.length - first.length)[0];
}
