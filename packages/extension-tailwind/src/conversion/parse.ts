/**
 * Candidate-string parsing shared by the conversion table: variant
 * splitting, modifier splitting, and arbitrary-value decoding. All
 * splitting respects brackets, so arbitrary values may contain `:` and
 * `/` freely.
 */

/** A candidate split into its variant prefixes and the utility part. */
export interface SplitCandidate {
  variants: string[];
  base: string;
}

/** Splits `md:hover:bg-blue-700` into variants and the utility part. */
export function splitCandidate(candidate: string): SplitCandidate {
  const segments = splitOutsideBrackets(candidate, ':');
  return {
    variants: segments.slice(0, -1),
    base: segments[segments.length - 1] ?? '',
  };
}

/** A utility body split at its `/` modifier, if one is present. */
export interface SplitModifier {
  body: string;
  modifier?: { value: string; arbitrary: boolean };
}

/** Splits `bg-blue-600/75` into the utility body and its modifier. */
export function splitModifier(text: string): SplitModifier {
  const segments = splitOutsideBrackets(text, '/');
  if (segments.length === 1) {
    return { body: text };
  }
  const rawModifier = segments[segments.length - 1];
  const body = segments.slice(0, -1).join('/');
  if (rawModifier.startsWith('[') && rawModifier.endsWith(']')) {
    return {
      body,
      modifier: { value: rawModifier.slice(1, -1), arbitrary: true },
    };
  }
  return { body, modifier: { value: rawModifier, arbitrary: false } };
}

/**
 * Decodes an arbitrary value's text: underscores become spaces, escaped
 * underscores stay literal (`max(100%,_300px)` → `max(100%, 300px)`).
 */
export function decodeArbitraryValue(raw: string): string {
  return raw.replace(/\\_|_/g, (match) => (match === '_' ? ' ' : '_'));
}

function splitOutsideBrackets(text: string, separator: string): string[] {
  const segments: string[] = [];
  let depth = 0;
  let current = '';
  for (const character of text) {
    if (character === '[' || character === '(') {
      depth += 1;
    } else if (character === ']' || character === ')') {
      depth -= 1;
    }
    if (character === separator && depth === 0) {
      segments.push(current);
      current = '';
    } else {
      current += character;
    }
  }
  segments.push(current);
  return segments;
}
