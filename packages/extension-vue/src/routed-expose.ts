/** The result of merging the routed element into an authored `defineExpose`. */
export interface RoutedExposeMerge {
  /** The script with the routed element merged in. */
  script: string;
  /**
   * Whether the authored object literal names its own `element`, which then
   * stays the author's: only `$el` is merged in.
   */
  authoredElement: boolean;
  /**
   * Set when the script seems to call `defineExpose` but the call could not
   * be read: the script is returned unchanged, and nothing may add a second
   * call, which Vue rejects.
   */
  unread?: true;
}

/**
 * Merges the routed element into a `defineExpose` call the author's script
 * already makes, since Vue rejects a second one. It is exposed twice: as
 * `$el`, placed last so it wins, and as `element`, typed after the routed
 * tag, which never overwrites an author's own `element`.
 *
 * `defineExpose({ focus })` becomes
 * `defineExpose({ focus, $el: routedElement, element: routedElement })`, and
 * an empty call takes the two alone. An object literal naming its own
 * `element` keeps it and gains `$el` only. A non-literal argument, or a
 * literal with a spread, may carry an `element` of its own, so `element`
 * leads, inside a spread of its own that TypeScript does not report as
 * overwritten: `defineExpose({ ...{ element: routedElement }, ...api,
 * $el: routedElement })`.
 *
 * @param script - The component's script.
 * @param element - The name holding the routed element.
 * @returns The merged script and whether the author exposes an `element`,
 *   or `undefined` when the script calls no `defineExpose`.
 * @example
 * mergeRoutedExpose('defineExpose({ focus });', 'routedElement')?.script;
 * // 'defineExpose({ focus, $el: routedElement, element: routedElement });'
 */
export function mergeRoutedExpose(
  script: string,
  element: string
): RoutedExposeMerge | undefined {
  const call = defineExposeCall(script);
  if (call === undefined) {
    return /(?<![\w$.])defineExpose\s*[<(]/.test(script)
      ? { script, authoredElement: false, unread: true }
      : undefined;
  }
  const { open, typeArgument } = call;
  const start = open + 1;
  const end = closingIndex(script, open);
  if (end === undefined) {
    return { script, authoredElement: false, unread: true };
  }
  // A trailing comment stays where it is, after what is merged in.
  const inside = script.slice(start, end);
  const argumentStart = start + inside.length - inside.trimStart().length;
  const argument = inside.slice(0, lastSignificantIndex(inside) + 1).trim();
  const exposed = `$el: ${element}`;
  const typed = `element: ${element}`;
  const leading = `...{ ${typed} }`;
  let merged: string;
  let authoredElement = false;
  if (argument === '') {
    merged = `{ ${exposed}, ${typed} }`;
  } else if (
    argument.startsWith('{') &&
    closingIndex(argument, 0) === argument.length - 1
  ) {
    const body = argument.slice(1, -1);
    const entries = topLevelEntries(body);
    authoredElement = entries.some(namesElement);
    const last = lastSignificantIndex(body);
    if (last === -1) {
      merged = `{ ${exposed}, ${typed} }`;
    } else {
      // The merged entries go right after the last authored one, in place
      // of a trailing comma, so a comment after it stays a comment.
      const kept = body.slice(0, body[last] === ',' ? last : last + 1);
      const rest = body.slice(last + 1);
      const spread = entries.some((entry) => entry.startsWith('...'));
      const lead = !authoredElement && spread ? ` ${leading},` : '';
      const added =
        authoredElement || spread ? exposed : `${exposed}, ${typed}`;
      merged = `{${lead}${kept}, ${added}${rest.trim() === '' ? ' ' : rest}}`;
    }
  } else {
    merged = `{ ${leading}, ...${argument}, ${exposed} }`;
  }
  // A type argument describes the exposed object, so it gains the two
  // keys too, typed as the ref the routed element is held in.
  const head =
    typeArgument === undefined
      ? script.slice(0, start)
      : `${script.slice(0, typeArgument.start)}<(${script.slice(typeArgument.start + 1, typeArgument.end).trim()}) & { $el: typeof ${element}${authoredElement ? '' : `; element: typeof ${element}`} }>${script.slice(typeArgument.end + 1, start)}`;
  return {
    script: `${head}${merged}${script.slice(argumentStart + argument.length)}`,
    authoredElement,
  };
}

/**
 * The index of the opening parenthesis of the script's `defineExpose` call,
 * a generic type argument (`defineExpose<Api>(...)`) allowed, skipping
 * strings, template literals and comments, or `undefined` when it makes none.
 */
function defineExposeCall(
  script: string
): { open: number; typeArgument?: { start: number; end: number } } | undefined {
  for (let index = 0; index < script.length; index++) {
    const skipped = skipIgnored(script, index);
    if (skipped !== index) {
      index = skipped;
      continue;
    }
    if (
      !script.startsWith('defineExpose', index) ||
      /[\w$.]/.test(script[index - 1] ?? '')
    ) {
      continue;
    }
    let cursor = index + 'defineExpose'.length;
    while (/\s/.test(script[cursor] ?? '')) cursor++;
    let typeArgument: { start: number; end: number } | undefined;
    if (script[cursor] === '<') {
      const typeStart = cursor;
      let depth = 0;
      for (; cursor < script.length; cursor++) {
        const character = script[cursor];
        if (character === '<') depth++;
        else if (character === '>' && script[cursor - 1] !== '=') {
          depth--;
          if (depth === 0) break;
        }
      }
      typeArgument = { start: typeStart, end: cursor };
      cursor++;
      while (/\s/.test(script[cursor] ?? '')) cursor++;
    }
    if (script[cursor] === '(') {
      return { open: cursor, typeArgument };
    }
  }
  return undefined;
}

/**
 * The last index of a string, template literal or comment starting at
 * `index` (a line comment's newline included), so a loop's increment lands
 * after it, or `index` itself when none starts there.
 */
function skipIgnored(source: string, index: number): number {
  const character = source[index];
  if (character === '"' || character === "'" || character === '`') {
    return stringEnd(source, index);
  }
  if (character === '/' && source[index + 1] === '/') {
    const lineEnd = source.indexOf('\n', index);
    return lineEnd === -1 ? source.length : lineEnd;
  }
  if (character === '/' && source[index + 1] === '*') {
    const commentEnd = source.indexOf('*/', index + 2);
    return commentEnd === -1 ? source.length : commentEnd + 1;
  }
  if (character === '/' && startsRegularExpression(source, index)) {
    return regularExpressionEnd(source, index);
  }
  return index;
}

/**
 * Whether a `/` at `index` opens a regular expression literal rather than
 * dividing, read from the token before it: an opening bracket, an operator
 * or punctuation that a value cannot end with, `return`, or nothing.
 */
function startsRegularExpression(source: string, index: number): boolean {
  const before = source.slice(0, index).trimEnd();
  return before === '' || /[(,=:[!&|?{};]$|(?<![\w$])return$/.test(before);
}

/**
 * The last index of the regular expression literal opened at `start`, its
 * flags included, skipping escapes and character classes; `start` itself
 * when the line ends first, so it is read as a plain `/`.
 */
function regularExpressionEnd(source: string, start: number): number {
  let inClass = false;
  for (let index = start + 1; index < source.length; index++) {
    const character = source[index];
    if (character === '\\') {
      index++;
    } else if (character === '\n') {
      return start;
    } else if (character === '[') {
      inClass = true;
    } else if (character === ']') {
      inClass = false;
    } else if (character === '/' && !inClass) {
      let end = index;
      while (/[a-z]/i.test(source[end + 1] ?? '')) end++;
      return end;
    }
  }
  return start;
}

/**
 * The index of the last character outside comments and whitespace, or `-1`
 * when there is none.
 */
function lastSignificantIndex(source: string): number {
  let last = -1;
  for (let index = 0; index < source.length; index++) {
    const skipped = skipIgnored(source, index);
    if (skipped !== index) {
      const comment = /^\/[/*]/.test(source.slice(index, index + 2));
      index = skipped;
      if (!comment) last = Math.min(index, source.length - 1);
      continue;
    }
    if (!/\s/.test(source[index])) {
      last = index;
    }
  }
  return last;
}

/**
 * Whether an object literal entry names `element`: a property, a shorthand,
 * a method or an accessor, its key bare, quoted or a computed string
 * (`['element']`). A computed key read from a variable cannot be known here.
 */
function namesElement(entry: string): boolean {
  return /^(?:(?:get|set|async)\s+)?\*?\s*(?:(['"]?)element\1|\[\s*(['"])element\2\s*\])\s*(?:[:(]|$)/.test(
    entry
  );
}

/**
 * An object literal body's entries, split at its top-level commas, each
 * trimmed, with comments removed.
 */
function topLevelEntries(body: string): string[] {
  const entries: string[] = [];
  let current = '';
  let depth = 0;
  for (let index = 0; index < body.length; index++) {
    const character = body[index];
    const skipped = skipIgnored(body, index);
    if (skipped !== index) {
      // A string or regular expression is kept; a comment is dropped.
      const comment = /^\/[/*]/.test(body.slice(index, index + 2));
      if (!comment) current += body.slice(index, skipped + 1);
      index = skipped;
      continue;
    }
    if (character in CLOSING) {
      depth++;
    } else if (character === ')' || character === ']' || character === '}') {
      depth--;
    } else if (character === ',' && depth === 0) {
      entries.push(current.trim());
      current = '';
      continue;
    }
    current += character;
  }
  entries.push(current.trim());
  return entries.filter((entry) => entry !== '');
}

const CLOSING: Readonly<Record<string, string>> = {
  '(': ')',
  '[': ']',
  '{': '}',
};

/**
 * The index of the bracket closing the one at `open`, skipping strings,
 * template literals and comments, or `undefined` when it is not closed.
 */
function closingIndex(source: string, open: number): number | undefined {
  const stack: string[] = [];
  for (let index = open; index < source.length; index++) {
    const skipped = skipIgnored(source, index);
    if (skipped !== index) {
      index = skipped;
      continue;
    }
    const character = source[index];
    if (character in CLOSING) {
      stack.push(CLOSING[character]);
    } else if (character === stack[stack.length - 1]) {
      stack.pop();
      if (stack.length === 0) {
        return index;
      }
    }
  }
  return undefined;
}

/** The index of the quote closing the string opened at `start`. */
function stringEnd(source: string, start: number): number {
  const quote = source[start];
  for (let index = start + 1; index < source.length; index++) {
    if (source[index] === '\\') {
      index++;
    } else if (source[index] === quote) {
      return index;
    }
  }
  return source.length;
}
