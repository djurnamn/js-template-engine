/**
 * Candidate-string parsing shared by the conversion table: variant
 * splitting, modifier splitting, and arbitrary-value decoding. All
 * splitting respects brackets, so arbitrary values may contain `:` and
 * `/` freely.
 */

import { addWhitespaceAroundMathOperators } from './data-types';

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
 * Decodes an arbitrary value's text as Tailwind v4 does: underscores become
 * spaces and escaped underscores stay literal (`max(100%,_300px)` →
 * `max(100%, 300px)`), except inside a `url()` and in a `var()`'s custom
 * property name, which keep theirs; and math functions get whitespace
 * around their operators (`calc(100%-2rem)` → `calc(100% - 2rem)`).
 */
export function decodeArbitraryValue(raw: string): string {
  let decoded = '';
  let index = 0;
  while (index < raw.length) {
    const segment = keptSegment(raw, index);
    if (segment !== undefined) {
      const text = raw.slice(index, segment.end);
      // A `url()` stays verbatim; a `var()` name only unescapes `\_`.
      decoded += segment.kind === 'url' ? text : text.replace(/\\_/g, '_');
      index = segment.end;
      continue;
    }
    if (raw.startsWith('\\_', index)) {
      decoded += '_';
      index += 2;
      continue;
    }
    decoded += raw[index] === '_' ? ' ' : raw[index];
    index += 1;
  }
  return addWhitespaceAroundMathOperators(decoded);
}

/** A stretch of an arbitrary value whose underscores are not spaces. */
export interface KeptSegment {
  /** `url` for a whole `url()`, `variable` for `var(--` and its name. */
  kind: 'url' | 'variable';
  /** The index just past the segment. */
  end: number;
}

/**
 * Returns the kept segment starting at `index`, if one does: a `url(...)`
 * through its matching parenthesis, or `var(--name` up to the name's end.
 * The function name must start a word (`myvar(` is no `var(`).
 */
export function keptSegment(
  text: string,
  index: number
): KeptSegment | undefined {
  if (index > 0 && /[a-zA-Z0-9-]/.test(text[index - 1])) {
    return undefined;
  }
  if (text.startsWith('url(', index)) {
    let depth = 0;
    for (let position = index + 3; position < text.length; position += 1) {
      if (text[position] === '(') {
        depth += 1;
      } else if (text[position] === ')') {
        depth -= 1;
        if (depth === 0) {
          return { kind: 'url', end: position + 1 };
        }
      }
    }
    return { kind: 'url', end: text.length };
  }
  const variable = /^var\(--[^,)]*/.exec(text.slice(index));
  if (variable !== null) {
    return { kind: 'variable', end: index + variable[0].length };
  }
  return undefined;
}

/** An arbitrary value split at its leading type hint, if one is present. */
export interface TypeHintedValue {
  value: string;
  dataType?: string;
}

/**
 * Splits an arbitrary value's raw text at a leading type hint
 * (`length:var(--size)` → `length` and `var(--size)`). As in Tailwind v4,
 * a hint is a run of lowercase letters and dashes ending in `:`.
 */
export function splitTypeHint(raw: string): TypeHintedValue {
  const hint = /^([a-z-]+):/.exec(raw);
  if (hint === null) {
    return { value: raw };
  }
  return { value: raw.slice(hint[0].length), dataType: hint[1] };
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
