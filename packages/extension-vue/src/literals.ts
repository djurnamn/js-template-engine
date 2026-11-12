import {
  isIdentifier,
  tokenizeExpression,
} from '@js-template-engine/core/emitter';
import type { JsonValue } from '@js-template-engine/types';

/** Serializes text as a single-quoted JavaScript string literal. */
export function quoteSingle(text: string): string {
  const escaped = text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n');
  return `'${escaped}'`;
}

/**
 * Serializes a JSON-compatible value as JavaScript source, using
 * single-quoted string literals. Used for the prop defaults Vue destructures from `defineProps`.
 */
export function serializeJavaScriptValue(value: JsonValue): string {
  if (typeof value === 'string') {
    return quoteSingle(value);
  }
  if (
    value === null ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(serializeJavaScriptValue).join(', ')}]`;
  }
  const entries = Object.entries(value)
    .filter((entry): entry is [string, JsonValue] => entry[1] !== undefined)
    .map(
      ([key, entryValue]) =>
        `${objectKey(key)}: ${serializeJavaScriptValue(entryValue)}`
    );
  return entries.length === 0 ? '{}' : `{ ${entries.join(', ')} }`;
}

/** A property name as code: bare when it is an identifier, quoted otherwise
 *  (`'onUpdate:modelValue'`). */
export function objectKey(key: string): string {
  return isIdentifier(key) ? key : quoteSingle(key);
}

/**
 * Escapes static text for an element's text content. Static text is always
 * literal, so `{` is escaped to `&#123;` - otherwise a `{{ }}` sequence in
 * the text would be parsed as a Vue interpolation.
 */
export function escapeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\{/g, '&#123;');
}

/** Escapes a static value for a double-quoted attribute (`alt="..."`). */
export function escapeAttributeValue(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/**
 * An expression the template binds, with the template locals - iteration
 * items and indexes, `slotScope` bindings - in scope where it is bound.
 */
export interface RecordedExpression {
  expression: string;
  locals: ReadonlySet<string>;
}

/** The expressions bound while {@link recordingExpressions} renders. */
let recordedExpressions: RecordedExpression[] | undefined;

/** The template locals in scope where the template renders now. */
let templateLocals: ReadonlySet<string> = new Set();

/**
 * Renders with every expression a directive or an interpolation binds
 * recorded, in the order bound: what the template reads, for the globals
 * `<script setup>` declares for it.
 *
 * @param render - Renders the template.
 * @returns What `render` returns, and the expressions it bound.
 */
export function recordingExpressions<Result>(render: () => Result): {
  result: Result;
  expressions: RecordedExpression[];
} {
  const enclosing = recordedExpressions;
  const expressions: RecordedExpression[] = [];
  recordedExpressions = expressions;
  try {
    return { result: render(), expressions };
  } finally {
    recordedExpressions = enclosing;
  }
}

/**
 * Renders a subtree in which template locals are in scope, so an
 * expression bound there reads them rather than a global of their name.
 *
 * @param names - The locals the subtree binds.
 * @param render - Renders the subtree.
 * @returns What `render` returns.
 */
export function withTemplateLocals<Result>(
  names: ReadonlyArray<string | undefined>,
  render: () => Result
): Result {
  const enclosing = templateLocals;
  templateLocals = new Set([
    ...enclosing,
    ...names.filter((name): name is string => name !== undefined),
  ]);
  try {
    return render();
  } finally {
    templateLocals = enclosing;
  }
}

/**
 * Records an expression the template binds without {@link directiveValue},
 * such as a directive an override writes as a plain attribute, while
 * {@link recordingExpressions} renders.
 *
 * @param expression - The expression.
 */
export function recordExpression(expression: string): void {
  recordedExpressions?.push({
    expression: expression.trim(),
    locals: templateLocals,
  });
}

/**
 * The text interpolation of an expression: `{{ expression }}`. Vue ends the
 * interpolation at the first `}}` it meets, wherever it falls, so two
 * adjacent closing braces in the expression are written apart: with a
 * space between them in code (`{ a: { b: n } }`), and as `\x7d` for the
 * first of the pair inside a string or template literal, which reads the
 * same.
 *
 * @param expression - The expression.
 * @returns The interpolation.
 * @example
 * interpolation('JSON.stringify({ a: { b: n }})');
 * // '{{ JSON.stringify({ a: { b: n } }) }}'
 */
export function interpolation(expression: string): string {
  const trimmed = expression.trim();
  recordExpression(trimmed);
  return `{{ ${withoutAdjacentClosingBraces(trimmed)} }}`;
}

/** The expression with no `}}` left in it (see {@link interpolation}). */
function withoutAdjacentClosingBraces(expression: string): string {
  if (!expression.includes('}}')) {
    return expression;
  }
  let output = '';
  for (const token of tokenizeExpression(expression)) {
    if (token.kind === 'string') {
      output += token.text.startsWith('`')
        ? templateWithoutAdjacentClosingBraces(token.text)
        : token.text.replace(/\}(?=\})/g, '\\x7d');
    } else if (token.text === '}' && output.endsWith('}')) {
      output += ' }';
    } else {
      output += token.text;
    }
  }
  return output;
}

/**
 * A template literal with no `}}` left in it: a brace of its text that
 * follows another becomes `\x7d`, and a brace closing a `${` expression,
 * or an object inside one, follows another with a space between them.
 */
function templateWithoutAdjacentClosingBraces(literal: string): string {
  let output = '';
  const endsWithBrace = (): boolean => output.endsWith('}');
  let depth = 0;
  let index = 0;
  while (index < literal.length) {
    const character = literal[index];
    if (depth === 0) {
      if (character === '\\') {
        output += literal.slice(index, index + 2);
        index += 2;
        continue;
      }
      if (character === '$' && literal[index + 1] === '{') {
        output += '${';
        depth = 1;
        index += 2;
        continue;
      }
      output += character === '}' && endsWithBrace() ? '\\x7d' : character;
      index += 1;
      continue;
    }
    if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      output += endsWithBrace() ? ' }' : '}';
      index += 1;
      continue;
    }
    output += character;
    index += 1;
  }
  return output;
}

/**
 * A directive's value with its delimiters (`:src="..."`, `v-if="..."`,
 * `@click="..."`). The expression is written verbatim - Vue tooling keeps
 * `&&`, `>` and `<` raw - in the quote that needs no escaping: double quotes,
 * or single quotes when the expression holds a `"` and no `'`. An expression
 * holding both has its double-quoted string literals rewritten single-quoted
 * and every other `"` written `\x22`, so the value stays double-quoted with no
 * `"` inside. An expression the rewrite leaves alone - one with a `/` (a
 * regular expression, a comment or a division) or a tagged template - keeps
 * its `"` as the entity `&quot;`, which Vue compiles but vue-tsc does not
 * read.
 *
 * @param expression - The binding expression.
 * @returns The quoted value.
 * @example
 * directiveValue('open ? "Close" : "Open"'); // `'open ? "Close" : "Open"'`
 * directiveValue(`open ? "Don't" : 'Do'`); // `"open ? 'Don\'t' : 'Do'"`
 */
export function directiveValue(expression: string): string {
  const trimmed = expression.trim();
  recordExpression(trimmed);
  if (!trimmed.includes('"')) {
    return `"${trimmed}"`;
  }
  if (!trimmed.includes("'")) {
    return `'${trimmed}'`;
  }
  const rewritten = withoutDoubleQuotes(trimmed);
  return `"${rewritten ?? trimmed.replace(/"/g, '&quot;')}"`;
}

/**
 * Writes an expression without a `"`: a double-quoted string literal becomes
 * single-quoted (its `'` escaped), and a `"` inside a string or a template
 * literal's text becomes `\x22`, which reads the same. Returns `undefined`
 * when a string never closes, or the code holds a `/` (a regular expression,
 * a comment or a division, which it does not tell apart) or a tagged template.
 */
function withoutDoubleQuotes(expression: string): string | undefined {
  let output = '';
  // A template literal's text, or code with its open-brace count, which
  // tells a `}` closing a `${` from one closing an object.
  const stack: Array<{ template: true } | { template: false; braces: number }> =
    [{ template: false, braces: 0 }];
  let i = 0;
  while (i < expression.length) {
    const top = stack[stack.length - 1];
    const character = expression[i];
    if (top.template) {
      if (character === '\\') {
        output += escapeSequence(expression[i + 1]);
        i += 2;
      } else if (character === '`') {
        output += character;
        stack.pop();
        i += 1;
      } else if (character === '$' && expression[i + 1] === '{') {
        output += '${';
        stack.push({ template: false, braces: 0 });
        i += 2;
      } else {
        output += character === '"' ? '\\x22' : character;
        i += 1;
      }
      continue;
    }
    if (character === '"' || character === "'") {
      let content = '';
      let end = i + 1;
      while (end < expression.length && expression[end] !== character) {
        if (expression[end] === '\\') {
          content += escapeSequence(expression[end + 1]);
          end += 2;
        } else {
          const inner = expression[end];
          content += inner === '"' ? '\\x22' : inner === "'" ? "\\'" : inner;
          end += 1;
        }
      }
      if (end >= expression.length) {
        return undefined;
      }
      output += `'${content}'`;
      i = end + 1;
      continue;
    }
    // A `/` may open a regular expression, whose quotes are not strings, and
    // a tagged template reads its raw text, which `\x22` would change: both
    // are left to the entity.
    if (character === '/') {
      return undefined;
    }
    if (character === '`') {
      if (/[\w$)\]]$/.test(output.trimEnd())) {
        return undefined;
      }
      stack.push({ template: true });
    } else if (character === '{') {
      top.braces += 1;
    } else if (character === '}') {
      if (top.braces === 0 && stack.length > 1) {
        stack.pop();
      } else {
        top.braces -= 1;
      }
    }
    output += character;
    i += 1;
  }
  return stack.length === 1 ? output : undefined;
}

/** An escape sequence written again without a `"`: `\"` becomes `\x22`. */
function escapeSequence(character: string | undefined): string {
  return character === '"' ? '\\x22' : `\\${character ?? ''}`;
}
