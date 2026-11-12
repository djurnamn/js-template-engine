/**
 * Arbitrary-value data types, as Tailwind v4 reads them: the type hints an
 * author may write (`text-[length:var(--size)]`), the inference that picks
 * a type for an unhinted value, and the operator spacing Tailwind adds
 * inside math functions.
 */

/** The data types Tailwind v4 infers an arbitrary value as. */
export type DataType =
  | 'color'
  | 'length'
  | 'percentage'
  | 'ratio'
  | 'number'
  | 'integer'
  | 'url'
  | 'position'
  | 'bg-size'
  | 'line-width'
  | 'image'
  | 'family-name'
  | 'generic-name'
  | 'absolute-size'
  | 'relative-size'
  | 'angle'
  | 'vector';

const MATH_FUNCTIONS = [
  'calc',
  'min',
  'max',
  'clamp',
  'mod',
  'rem',
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atan2',
  'pow',
  'sqrt',
  'hypot',
  'log',
  'exp',
  'round',
];

const NAMED_COLORS = new Set([
  'aliceblue',
  'antiquewhite',
  'aqua',
  'aquamarine',
  'azure',
  'beige',
  'bisque',
  'black',
  'blanchedalmond',
  'blue',
  'blueviolet',
  'brown',
  'burlywood',
  'cadetblue',
  'chartreuse',
  'chocolate',
  'coral',
  'cornflowerblue',
  'cornsilk',
  'crimson',
  'cyan',
  'darkblue',
  'darkcyan',
  'darkgoldenrod',
  'darkgray',
  'darkgreen',
  'darkgrey',
  'darkkhaki',
  'darkmagenta',
  'darkolivegreen',
  'darkorange',
  'darkorchid',
  'darkred',
  'darksalmon',
  'darkseagreen',
  'darkslateblue',
  'darkslategray',
  'darkslategrey',
  'darkturquoise',
  'darkviolet',
  'deeppink',
  'deepskyblue',
  'dimgray',
  'dimgrey',
  'dodgerblue',
  'firebrick',
  'floralwhite',
  'forestgreen',
  'fuchsia',
  'gainsboro',
  'ghostwhite',
  'gold',
  'goldenrod',
  'gray',
  'green',
  'greenyellow',
  'grey', // voice-lint-disable-line: a CSS named color
  'honeydew',
  'hotpink',
  'indianred',
  'indigo',
  'ivory',
  'khaki',
  'lavender',
  'lavenderblush',
  'lawngreen',
  'lemonchiffon',
  'lightblue',
  'lightcoral',
  'lightcyan',
  'lightgoldenrodyellow',
  'lightgray',
  'lightgreen',
  'lightgrey',
  'lightpink',
  'lightsalmon',
  'lightseagreen',
  'lightskyblue',
  'lightslategray',
  'lightslategrey',
  'lightsteelblue',
  'lightyellow',
  'lime',
  'limegreen',
  'linen',
  'magenta',
  'maroon',
  'mediumaquamarine',
  'mediumblue',
  'mediumorchid',
  'mediumpurple',
  'mediumseagreen',
  'mediumslateblue',
  'mediumspringgreen',
  'mediumturquoise',
  'mediumvioletred',
  'midnightblue',
  'mintcream',
  'mistyrose',
  'moccasin',
  'navajowhite',
  'navy',
  'oldlace',
  'olive',
  'olivedrab',
  'orange',
  'orangered',
  'orchid',
  'palegoldenrod',
  'palegreen',
  'paleturquoise',
  'palevioletred',
  'papayawhip',
  'peachpuff',
  'peru',
  'pink',
  'plum',
  'powderblue',
  'purple',
  'rebeccapurple',
  'red',
  'rosybrown',
  'royalblue',
  'saddlebrown',
  'salmon',
  'sandybrown',
  'seagreen',
  'seashell',
  'sienna',
  'silver',
  'skyblue',
  'slateblue',
  'slategray',
  'slategrey',
  'snow',
  'springgreen',
  'steelblue',
  'tan',
  'teal',
  'thistle',
  'tomato',
  'turquoise',
  'violet',
  'wheat',
  'white',
  'whitesmoke',
  'yellow',
  'yellowgreen',
  'transparent',
  'currentcolor',
  'canvas',
  'canvastext',
  'linktext',
  'visitedtext',
  'activetext',
  'buttonface',
  'buttontext',
  'buttonborder',
  'field',
  'fieldtext',
  'highlight',
  'highlighttext',
  'selecteditem',
  'selecteditemtext',
  'mark',
  'marktext',
  'graytext',
  'accentcolor',
  'accentcolortext',
]);

const LENGTH_UNITS = [
  'cm',
  'mm',
  'Q',
  'in',
  'pc',
  'pt',
  'px',
  'em',
  'ex',
  'ch',
  'rem',
  'lh',
  'rlh',
  'vw',
  'vh',
  'vmin',
  'vmax',
  'vb',
  'vi',
  'svw',
  'svh',
  'lvw',
  'lvh',
  'dvw',
  'dvh',
  'cqw',
  'cqh',
  'cqi',
  'cqb',
  'cqmin',
  'cqmax',
];

const NUMBER_SOURCE = '[+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?';
const IS_NUMBER = new RegExp(`^${NUMBER_SOURCE}$`);
const IS_PERCENTAGE = new RegExp(`^${NUMBER_SOURCE}%$`);
const IS_LENGTH = new RegExp(`^${NUMBER_SOURCE}(?:${LENGTH_UNITS.join('|')})$`);
const IS_ANGLE = new RegExp(`^${NUMBER_SOURCE}(?:deg|rad|grad|turn)$`);
const IS_FRACTION = new RegExp(`^${NUMBER_SOURCE}\\s*/\\s*${NUMBER_SOURCE}$`);
const IS_COLOR_FUNCTION =
  /^(?:rgba?|hsla?|hwb|color|(?:ok)?(?:lab|lch)|light-dark|color-mix)\(/i;
const IS_IMAGE_FUNCTION =
  /^(?:element|image|cross-fade|image-set|(?:repeating-)?(?:conic|linear|radial)-gradient)\(/;
const GENERIC_NAMES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'math',
  'emoji',
  'fangsong',
]);
const ABSOLUTE_SIZES = new Set([
  'xx-small',
  'x-small',
  'small',
  'medium',
  'large',
  'x-large',
  'xx-large',
  'xxx-large',
]);
const POSITION_KEYWORDS = new Set(['center', 'top', 'right', 'bottom', 'left']);

/** Returns true when the value contains a CSS math function call. */
export function hasMathFunction(value: string): boolean {
  return (
    value.includes('(') &&
    MATH_FUNCTIONS.some((name) => value.includes(`${name}(`))
  );
}

/**
 * Splits a value at a separator outside parentheses and brackets, trimming
 * each part and dropping empty ones.
 */
export function splitTopLevel(value: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const character of value) {
    if (character === '(' || character === '[') {
      depth += 1;
    } else if (character === ')' || character === ']') {
      depth -= 1;
    }
    if (character === separator && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  parts.push(current.trim());
  return parts.filter((part) => part !== '');
}

/** Whether a word is a CSS named color, `transparent` and `currentcolor` included. */
export function isNamedColor(value: string): boolean {
  return NAMED_COLORS.has(value.toLowerCase());
}

function isColor(value: string): boolean {
  return (
    value.startsWith('#') ||
    IS_COLOR_FUNCTION.test(value) ||
    NAMED_COLORS.has(value.toLowerCase())
  );
}

function isLength(value: string): boolean {
  return IS_LENGTH.test(value) || hasMathFunction(value);
}

function isNumber(value: string): boolean {
  return IS_NUMBER.test(value) || hasMathFunction(value);
}

function isPercentage(value: string): boolean {
  return IS_PERCENTAGE.test(value) || hasMathFunction(value);
}

function isUrl(value: string): boolean {
  return value.startsWith('url(');
}

function isImage(value: string): boolean {
  let count = 0;
  for (const part of splitTopLevel(value, ',')) {
    if (part.startsWith('var(')) {
      continue;
    }
    if (isUrl(part) || IS_IMAGE_FUNCTION.test(part)) {
      count += 1;
      continue;
    }
    return false;
  }
  return count > 0;
}

function isBackgroundPosition(value: string): boolean {
  let count = 0;
  for (const part of splitTopLevel(value, ' ')) {
    if (POSITION_KEYWORDS.has(part)) {
      count += 1;
      continue;
    }
    if (part.startsWith('var(')) {
      continue;
    }
    if (isLength(part) || isPercentage(part)) {
      count += 1;
      continue;
    }
    return false;
  }
  return count > 0;
}

function isBackgroundSize(value: string): boolean {
  let count = 0;
  for (const layer of splitTopLevel(value, ',')) {
    if (layer === 'cover' || layer === 'contain') {
      count += 1;
      continue;
    }
    const values = splitTopLevel(layer, ' ');
    if (values.length !== 1 && values.length !== 2) {
      return false;
    }
    if (
      values.every(
        (part) => part === 'auto' || isLength(part) || isPercentage(part)
      )
    ) {
      count += 1;
      continue;
    }
    return false;
  }
  return count > 0;
}

function isLineWidth(value: string): boolean {
  return splitTopLevel(value, ' ').every(
    (part) =>
      isLength(part) ||
      isNumber(part) ||
      part === 'thin' ||
      part === 'medium' ||
      part === 'thick'
  );
}

function isFamilyName(value: string): boolean {
  let count = 0;
  for (const part of splitTopLevel(value, ',')) {
    if (/^\d/.test(part)) {
      return false;
    }
    if (part.startsWith('var(')) {
      continue;
    }
    count += 1;
  }
  return count > 0;
}

function isVector(value: string): boolean {
  const parts = splitTopLevel(value, ' ');
  return parts.length === 3 && parts.every(isNumber);
}

const CHECKS: Record<DataType, (value: string) => boolean> = {
  color: isColor,
  length: isLength,
  percentage: isPercentage,
  ratio: (value) => IS_FRACTION.test(value),
  number: isNumber,
  integer: (value) => /^\d+$/.test(value),
  url: isUrl,
  position: isBackgroundPosition,
  'bg-size': isBackgroundSize,
  'line-width': isLineWidth,
  image: isImage,
  'family-name': isFamilyName,
  'generic-name': (value) => GENERIC_NAMES.has(value),
  'absolute-size': (value) => ABSOLUTE_SIZES.has(value),
  'relative-size': (value) => value === 'larger' || value === 'smaller',
  angle: (value) => IS_ANGLE.test(value),
  vector: isVector,
};

/**
 * Infers an unhinted arbitrary value's data type the way Tailwind v4 does:
 * the first of `types`, in order, the value matches. A value that is a
 * bare `var()` reference carries no type and infers nothing.
 */
export function inferDataType(
  value: string,
  types: readonly DataType[]
): DataType | undefined {
  if (value.startsWith('var(')) {
    return undefined;
  }
  return types.find((type) => CHECKS[type](value));
}

/**
 * Adds the whitespace Tailwind v4 adds around `+`, `-`, `*` and `/` inside
 * math functions, and after their commas (`calc(100%-2rem)` →
 * `calc(100% - 2rem)`). Already-spaced values come back unchanged, and
 * operators outside math functions - inside `var()`, for instance - are
 * left alone.
 */
export function addWhitespaceAroundMathOperators(input: string): string {
  if (!input.includes('(')) {
    return input;
  }
  if (!MATH_FUNCTIONS.some((name) => input.includes(name))) {
    return input;
  }
  let result = '';
  const formattable: boolean[] = [];
  let valuePosition: number | undefined;
  let lastValuePosition: number | undefined;
  const isDigit = (character: string | undefined) =>
    character !== undefined && character >= '0' && character <= '9';
  const isOperator = (character: string | undefined) =>
    character === '+' ||
    character === '-' ||
    character === '*' ||
    character === '/';

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (isDigit(character)) {
      valuePosition = index;
    } else if (valuePosition !== undefined && /[%a-zA-Z]/.test(character)) {
      valuePosition = index;
    } else {
      lastValuePosition = valuePosition;
      valuePosition = undefined;
    }

    if (character === '(') {
      result += character;
      let start = index;
      for (let back = index - 1; back >= 0; back -= 1) {
        if (/[0-9a-z]/.test(input[back])) {
          start = back;
        } else {
          break;
        }
      }
      const name = input.slice(start, index);
      if (MATH_FUNCTIONS.includes(name)) {
        formattable.unshift(true);
      } else if (formattable[0] === true && name === '') {
        formattable.unshift(true);
      } else {
        formattable.unshift(false);
      }
      continue;
    }
    if (character === ')') {
      result += character;
      formattable.shift();
      continue;
    }
    if (character === ',' && formattable[0] === true) {
      result += ', ';
      continue;
    }
    if (character === ' ' && formattable[0] === true && result.endsWith(' ')) {
      continue;
    }
    if (isOperator(character) && formattable[0] === true) {
      const trimmed = result.trimEnd();
      const previous = trimmed[trimmed.length - 1];
      const beforePrevious = trimmed[trimmed.length - 2];
      const next = input[index + 1];
      if ((previous === 'e' || previous === 'E') && isDigit(beforePrevious)) {
        result += character;
      } else if (isOperator(previous)) {
        result += character;
      } else if (previous === '(' || previous === ',') {
        result += character;
      } else if (input[index - 1] === ' ') {
        result += `${character} `;
      } else if (
        isDigit(previous) ||
        isDigit(next) ||
        previous === ')' ||
        next === '(' ||
        isOperator(next) ||
        (lastValuePosition !== undefined && lastValuePosition === index - 1)
      ) {
        result += ` ${character} `;
      } else {
        result += character;
      }
      continue;
    }
    result += character;
  }
  return result;
}
