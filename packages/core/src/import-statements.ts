/**
 * The entries of a template's `imports`, partitioned into the import
 * statements among them and every other declaration written beside them.
 */
export interface PartitionedImports {
  /** The import statements, in their authored order. */
  importStatements: string[];
  /**
   * Every other statement - a constant, a counter, a context, an exported
   * type or interface, a re-export - in its authored order.
   */
  declarations: string[];
}

/**
 * Partitions a template's `imports` entries into import statements and the
 * other declarations written among them, so a target can keep its imports in
 * place while emitting the declarations at module scope.
 *
 * An entry may hold several statements: it is split wherever an import
 * statement begins or ends. Strings, template literals, regular expressions
 * and comments are skipped as a whole, so a quote or the word `import` inside
 * one never splits an entry. A comment travels with the statement after it;
 * one ending the line of a statement stays with that statement. A dynamic
 * `import()` and `import.meta` are expressions, not import statements, and
 * an `export ... from` re-export is a declaration.
 *
 * @param entries - The template's `imports` entries.
 * @returns The import statements and the other declarations.
 *
 * @example
 * partitionImports([
 *   "import { createContext } from 'react';",
 *   'let nextId = 0;',
 * ]);
 * // { importStatements: ["import { createContext } from 'react';"],
 * //   declarations: ['let nextId = 0;'] }
 */
export function partitionImports(
  entries: readonly string[]
): PartitionedImports {
  const importStatements: string[] = [];
  const declarations: string[] = [];
  for (const entry of entries) {
    for (const chunk of splitStatements(entry)) {
      (chunk.isImport ? importStatements : declarations).push(chunk.text);
    }
  }
  return { importStatements, declarations };
}

/** A run of an entry's source: one import statement, or the declarations
 *  between two of them. */
interface Chunk {
  isImport: boolean;
  text: string;
}

type TokenKind = 'word' | 'string' | 'template' | 'regex' | 'punctuation';

/** One lexical unit of an entry; strings, templates and regular expressions
 *  are a single token each. */
interface Token {
  kind: TokenKind;
  start: number;
  end: number;
  text: string;
  /** Whether a line break separates this token from the one before it. */
  newlineBefore: boolean;
}

const OPENING_BRACKETS = new Set(['(', '[', '{']);
const CLOSING_BRACKETS = new Set([')', ']', '}']);

/** The punctuation after which a `/` starts a regular expression rather than
 *  dividing. */
const REGEX_PRECEDING_PUNCTUATION = new Set([...'(,=:[!&|?{};+-*%<>~^']);

/** The keywords after which a `/` starts a regular expression. */
const REGEX_PRECEDING_WORDS = new Set([
  'return',
  'typeof',
  'case',
  'do',
  'else',
  'in',
  'of',
  'new',
  'delete',
  'void',
  'throw',
  'instanceof',
  'yield',
  'await',
]);

function isIdentifierCharacter(character: string | undefined): boolean {
  return character !== undefined && /[\w$\u0080-￿]/.test(character);
}

/** Splits one entry into its import statements and the declaration runs
 *  between them. */
function splitStatements(entry: string): Chunk[] {
  const { tokens } = tokenize(entry, 0, false);
  const chunks: Chunk[] = [];
  let chunkStart = 0;
  let declarationOpen = false;
  let depth = 0;
  let previous: Token | undefined;

  const push = (isImport: boolean, start: number, end: number) => {
    const text = entry.slice(start, end).trim();
    if (text !== '') {
      chunks.push({ isImport, text });
    }
  };

  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    // A member access continues an expression, even across a line break.
    const afterMemberAccess =
      previous?.kind === 'punctuation' && previous.text === '.';
    const atStatementStart =
      previous === undefined ||
      (previous.kind === 'punctuation' &&
        (previous.text === ';' || previous.text === '}')) ||
      (token.newlineBefore && !afterMemberAccess);
    if (depth === 0 && atStatementStart && isImportStart(tokens, index)) {
      let boundary = chunkStart;
      if (declarationOpen && previous !== undefined) {
        boundary = withTrailingComment(entry, previous.end);
        push(false, chunkStart, boundary);
      }
      const last = importStatementEnd(tokens, index);
      const end = withTrailingComment(entry, tokens[last].end);
      push(true, boundary, end);
      chunkStart = end;
      declarationOpen = false;
      previous = tokens[last];
      index = last + 1;
      continue;
    }
    if (token.kind === 'punctuation') {
      if (OPENING_BRACKETS.has(token.text)) depth += 1;
      if (CLOSING_BRACKETS.has(token.text)) depth = Math.max(0, depth - 1);
    }
    declarationOpen = true;
    previous = token;
    index += 1;
  }

  if (declarationOpen) {
    push(false, chunkStart, entry.length);
  } else {
    // A comment after the last import statement stays with it.
    const rest = entry.slice(chunkStart).trim();
    if (rest !== '' && chunks.length > 0) {
      const last = chunks[chunks.length - 1];
      last.text = `${last.text}\n${rest}`;
    } else if (rest !== '') {
      chunks.push({ isImport: false, text: rest });
    }
  }
  return chunks;
}

/** Whether the token at `index` begins an import statement: the word
 *  `import` not followed by `(` (a dynamic import) or `.` (`import.meta`). */
function isImportStart(tokens: readonly Token[], index: number): boolean {
  const token = tokens[index];
  if (token.kind !== 'word' || token.text !== 'import') {
    return false;
  }
  const next = tokens[index + 1];
  if (next === undefined) {
    return false;
  }
  return !(
    next.kind === 'punctuation' &&
    (next.text === '(' || next.text === '.')
  );
}

/**
 * The index of the last token of the import statement starting at `start`:
 * its module specifier, then any `with { ... }` or `assert { ... }`
 * attributes and a closing semicolon. An `import name = ...` alias ends at
 * its semicolon or line break.
 */
function importStatementEnd(tokens: readonly Token[], start: number): number {
  let depth = 0;
  let aliased = false;
  for (let index = start + 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (depth === 0 && aliased && token.newlineBefore) {
      return index - 1;
    }
    if (token.kind === 'punctuation') {
      if (OPENING_BRACKETS.has(token.text)) depth += 1;
      if (CLOSING_BRACKETS.has(token.text)) depth = Math.max(0, depth - 1);
      if (depth === 0 && token.text === ';') return index;
      if (depth === 0 && token.text === '=') aliased = true;
      continue;
    }
    if (token.kind === 'string' && depth === 0) {
      let last = index;
      const keyword = tokens[last + 1];
      const opening = tokens[last + 2];
      if (
        keyword?.kind === 'word' &&
        (keyword.text === 'with' || keyword.text === 'assert') &&
        opening?.kind === 'punctuation' &&
        opening.text === '{'
      ) {
        last = matchingBracket(tokens, last + 2);
      }
      const semicolon = tokens[last + 1];
      if (semicolon?.kind === 'punctuation' && semicolon.text === ';') {
        last += 1;
      }
      return last;
    }
  }
  return tokens.length - 1;
}

/** The index of the bracket closing the one at `opening`. */
function matchingBracket(tokens: readonly Token[], opening: number): number {
  let depth = 0;
  for (let index = opening; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.kind !== 'punctuation') continue;
    if (OPENING_BRACKETS.has(token.text)) depth += 1;
    if (CLOSING_BRACKETS.has(token.text)) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return tokens.length - 1;
}

/** The end of a statement ending at `end`, extended over a comment that
 *  finishes its line. */
function withTrailingComment(text: string, end: number): number {
  let index = end;
  while (text[index] === ' ' || text[index] === '\t') index += 1;
  if (text.startsWith('//', index)) {
    const newline = text.indexOf('\n', index);
    return newline === -1 ? text.length : newline;
  }
  if (text.startsWith('/*', index)) {
    const close = text.indexOf('*/', index + 2);
    const newline = text.indexOf('\n', index);
    if (close !== -1 && (newline === -1 || close < newline)) {
      return close + 2;
    }
  }
  return end;
}

/**
 * Tokenizes `text` from `start`. With `untilClosingBrace`, stops after the
 * `}` that closes a template literal's `${`, returning the index after it.
 */
function tokenize(
  text: string,
  start: number,
  untilClosingBrace: boolean
): { tokens: Token[]; end: number } {
  const tokens: Token[] = [];
  let braceDepth = 0;
  let newlineBefore = false;
  let index = start;
  while (index < text.length) {
    const character = text[index];
    if (character === '\n') {
      newlineBefore = true;
      index += 1;
      continue;
    }
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if (text.startsWith('//', index)) {
      const newline = text.indexOf('\n', index);
      index = newline === -1 ? text.length : newline;
      continue;
    }
    if (text.startsWith('/*', index)) {
      const close = text.indexOf('*/', index + 2);
      const end = close === -1 ? text.length : close + 2;
      if (text.slice(index, end).includes('\n')) newlineBefore = true;
      index = end;
      continue;
    }

    let kind: TokenKind;
    let end: number;
    if (character === '"' || character === "'") {
      kind = 'string';
      end = skipQuoted(text, index);
    } else if (character === '`') {
      kind = 'template';
      end = skipTemplate(text, index);
    } else if (character === '/' && startsRegex(tokens)) {
      kind = 'regex';
      end = skipRegex(text, index);
    } else if (isIdentifierCharacter(character)) {
      kind = 'word';
      end = index + 1;
      while (isIdentifierCharacter(text[end])) end += 1;
    } else {
      kind = 'punctuation';
      end = index + 1;
      if (untilClosingBrace) {
        if (character === '{') braceDepth += 1;
        if (character === '}') {
          if (braceDepth === 0) return { tokens, end };
          braceDepth -= 1;
        }
      }
    }
    tokens.push({
      kind,
      start: index,
      end,
      text: text.slice(index, end),
      newlineBefore,
    });
    newlineBefore = false;
    index = end;
  }
  return { tokens, end: text.length };
}

/** Whether a `/` after the tokens read so far begins a regular expression
 *  literal rather than dividing. */
function startsRegex(tokens: readonly Token[]): boolean {
  const previous = tokens[tokens.length - 1];
  if (previous === undefined) return true;
  if (previous.kind === 'punctuation') {
    // A postfix `++` or `--` ends an operand, so a `/` after it divides.
    const before = tokens[tokens.length - 2];
    if (
      (previous.text === '+' || previous.text === '-') &&
      before?.kind === 'punctuation' &&
      before.text === previous.text &&
      before.end === previous.start
    ) {
      return false;
    }
    return REGEX_PRECEDING_PUNCTUATION.has(previous.text);
  }
  return previous.kind === 'word' && REGEX_PRECEDING_WORDS.has(previous.text);
}

/** The index after the quoted string starting at `start`. */
function skipQuoted(text: string, start: number): number {
  const quote = text[start];
  let index = start + 1;
  while (index < text.length) {
    const character = text[index];
    if (character === '\\') {
      index += 2;
      continue;
    }
    if (character === quote || character === '\n') return index + 1;
    index += 1;
  }
  return text.length;
}

/** The index after the template literal starting at `start`, its `${}`
 *  substitutions included. */
function skipTemplate(text: string, start: number): number {
  let index = start + 1;
  while (index < text.length) {
    const character = text[index];
    if (character === '\\') {
      index += 2;
      continue;
    }
    if (character === '`') return index + 1;
    if (character === '$' && text[index + 1] === '{') {
      index = tokenize(text, index + 2, true).end;
      continue;
    }
    index += 1;
  }
  return text.length;
}

/** The index after the regular expression literal starting at `start`, its
 *  flags included. */
function skipRegex(text: string, start: number): number {
  let index = start + 1;
  let inClass = false;
  while (index < text.length) {
    const character = text[index];
    if (character === '\\') {
      index += 2;
      continue;
    }
    if (character === '\n') return index;
    if (character === '[') inClass = true;
    else if (character === ']') inClass = false;
    else if (character === '/' && !inClass) {
      index += 1;
      while (isIdentifierCharacter(text[index])) index += 1;
      return index;
    }
    index += 1;
  }
  return text.length;
}

/**
 * The local names a list of import statements binds: each default import,
 * namespace import and named import (under its `as` name), type-only
 * imports included. A target that imports a name itself skips one an
 * author's import already binds, so the two never declare it twice.
 *
 * @param statements - Import statements, such as {@link partitionImports}
 *   returns.
 * @returns The bound names.
 * @example
 * importedNames(["import { useState, useId as id } from 'react';"]);
 * // Set { 'useState', 'id' }
 */
export function importedNames(statements: readonly string[]): Set<string> {
  const names = new Set<string>();
  for (const statement of statements) {
    const clause = /^\s*import\s+(?:type\s+)?([^]*?)\s+from\s/.exec(statement);
    if (clause === null) {
      continue;
    }
    const text = clause[1];
    const braces = /\{([^]*)\}/.exec(text);
    if (braces !== null) {
      for (const specifier of braces[1].split(',')) {
        const parts = specifier
          .trim()
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/);
        const local = parts[parts.length - 1]?.trim();
        if (local) {
          names.add(local);
        }
      }
    }
    const outside = text.replace(/\{[^]*\}/, '');
    const namespace = /\*\s*as\s+([A-Za-z_$][\w$]*)/.exec(outside);
    if (namespace !== null) {
      names.add(namespace[1]);
    }
    const defaultImport = /^\s*([A-Za-z_$][\w$]*)/.exec(outside);
    if (defaultImport !== null) {
      names.add(defaultImport[1]);
    }
  }
  return names;
}
