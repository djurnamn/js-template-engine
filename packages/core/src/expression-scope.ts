/**
 * A light scope reader for the JavaScript expressions a template carries. It
 * tokenizes an expression and works out, for each identifier, whether it is a
 * free reference to the enclosing component scope or something else: a name
 * the expression binds itself (a function parameter, a `catch` binding, a
 * `const`, `let`, `var`, `function` or `class` declaration inside a function
 * body), a property key, a member-access tail or a type annotation. It is not
 * a parser: it reads the shapes those bindings take, and leaves anything it
 * does not recognize as a free reference.
 */

/** One token of an expression, in source order. */
export interface ExpressionToken {
  /**
   * The token's kind: `space` covers whitespace and comments, `regex` a
   * regular expression literal.
   */
  kind: 'identifier' | 'string' | 'regex' | 'number' | 'punctuator' | 'space';
  /** The token's source text. */
  text: string;
}

/** How an identifier token of an expression reads. */
export interface IdentifierReading {
  /** `true` when the identifier is a free reference to the enclosing scope. */
  free: boolean;
  /**
   * `true` for an object literal's shorthand property (`{ option }`), whose
   * key must stay when its value is rewritten.
   */
  shorthandProperty: boolean;
}

/** The modifiers a class member's name may follow. */
const CLASS_MEMBER_MODIFIERS = new Set([
  'static',
  'readonly',
  'public',
  'private',
  'protected',
  'declare',
  'override',
  'abstract',
  'accessor',
]);

const MULTI_CHARACTER_PUNCTUATORS = ['...', '=>', '?.', '??'];

const CONTROL_KEYWORDS = new Set([
  'if',
  'for',
  'while',
  'switch',
  'with',
  'return',
  'typeof',
  'void',
  'delete',
  'await',
  'new',
  'in',
  'of',
  'instanceof',
]);

/**
 * The keywords after which a `/` starts a regular expression literal, an
 * operand being expected there.
 */
const REGEX_PRECEDING_KEYWORDS = new Set([
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

/**
 * Whether a `/` after the tokens read so far starts a regular expression
 * literal: at the start, after a punctuator other than a closing `)` or `]`
 * or a postfix `++`/`--`, or after a keyword that expects an operand. After
 * an identifier, a number, a string, a closing bracket or a postfix
 * increment (`a-- / 2`) it divides.
 */
function startsRegex(tokens: readonly ExpressionToken[]): boolean {
  const significant = (from: number): number => {
    let index = from;
    while (index >= 0 && tokens[index].kind === 'space') {
      index -= 1;
    }
    return index;
  };
  const last = significant(tokens.length - 1);
  const previous = last === -1 ? undefined : tokens[last];
  if (previous === undefined) {
    return true;
  }
  if (previous.kind === 'punctuator') {
    if (
      (previous.text === '+' || previous.text === '-') &&
      tokens[last - 1]?.text === previous.text
    ) {
      // A postfix increment: `++` or `--` right after an operand.
      const operand = tokens[significant(last - 2)];
      if (
        operand !== undefined &&
        ((operand.kind === 'identifier' &&
          !REGEX_PRECEDING_KEYWORDS.has(operand.text)) ||
          operand.text === ')' ||
          operand.text === ']')
      ) {
        return false;
      }
    }
    return previous.text !== ')' && previous.text !== ']';
  }
  return (
    previous.kind === 'identifier' &&
    REGEX_PRECEDING_KEYWORDS.has(previous.text)
  );
}

/**
 * The end of a regular expression literal starting at `start` (its opening
 * `/`), flags included, or `undefined` when no closing `/` follows on the
 * same line.
 */
function regexEnd(expression: string, start: number): number | undefined {
  let index = start + 1;
  let inClass = false;
  while (index < expression.length) {
    const char = expression[index];
    if (char === '\n' || char === '\r') {
      return undefined;
    }
    if (char === '\\') {
      index += 2;
      continue;
    }
    if (char === '[') {
      inClass = true;
    } else if (char === ']') {
      inClass = false;
    } else if (char === '/' && !inClass) {
      index += 1;
      while (index < expression.length && /[A-Za-z]/.test(expression[index])) {
        index += 1;
      }
      return index;
    }
    index += 1;
  }
  return undefined;
}

/**
 * Splits an expression into tokens. String and template literals are single
 * tokens (their contents are never read as identifiers), as is a regular
 * expression literal, told from a division by the token before it; comments
 * are `space`.
 *
 * @param expression - The expression.
 * @returns The tokens, whose texts concatenate back to `expression`.
 */
export function tokenizeExpression(expression: string): ExpressionToken[] {
  const tokens: ExpressionToken[] = [];
  const { length } = expression;
  let index = 0;
  while (index < length) {
    const start = index;
    const char = expression[index];
    if (
      char === '/' &&
      !expression.startsWith('//', index) &&
      !expression.startsWith('/*', index) &&
      startsRegex(tokens)
    ) {
      const end = regexEnd(expression, index);
      if (end !== undefined) {
        index = end;
        tokens.push({ kind: 'regex', text: expression.slice(start, index) });
        continue;
      }
    }
    if (char === "'" || char === '"' || char === '`') {
      index += 1;
      while (index < length) {
        const inner = expression[index];
        index += 1;
        if (inner === '\\') {
          index += 1;
          continue;
        }
        if (inner === char) {
          break;
        }
      }
      tokens.push({ kind: 'string', text: expression.slice(start, index) });
      continue;
    }
    if (expression.startsWith('//', index)) {
      const end = expression.indexOf('\n', index);
      index = end === -1 ? length : end;
      tokens.push({ kind: 'space', text: expression.slice(start, index) });
      continue;
    }
    if (expression.startsWith('/*', index)) {
      const end = expression.indexOf('*/', index + 2);
      index = end === -1 ? length : end + 2;
      tokens.push({ kind: 'space', text: expression.slice(start, index) });
      continue;
    }
    if (/\s/.test(char)) {
      while (index < length && /\s/.test(expression[index])) {
        index += 1;
      }
      tokens.push({ kind: 'space', text: expression.slice(start, index) });
      continue;
    }
    if (/[A-Za-z_$]/.test(char)) {
      while (index < length && /[\w$]/.test(expression[index])) {
        index += 1;
      }
      tokens.push({ kind: 'identifier', text: expression.slice(start, index) });
      continue;
    }
    if (/\d/.test(char)) {
      while (index < length && /[\w.]/.test(expression[index])) {
        index += 1;
      }
      tokens.push({ kind: 'number', text: expression.slice(start, index) });
      continue;
    }
    const punctuator =
      MULTI_CHARACTER_PUNCTUATORS.find(
        (candidate) =>
          expression.startsWith(candidate, index) &&
          // `a ?.5 : b` is a conditional, not optional chaining.
          !(candidate === '?.' && /\d/.test(expression[index + 2] ?? ''))
      ) ?? char;
    index += punctuator.length;
    tokens.push({ kind: 'punctuator', text: punctuator });
  }
  return tokens;
}

/** A range of significant tokens in which some names are bound locally. */
interface Scope {
  names: Set<string>;
  /** The first significant-token index inside the scope. */
  from: number;
  /** The significant-token index just past the scope. */
  to: number;
}

/**
 * Reads every identifier of an expression: whether it is a free reference to
 * the enclosing scope, and whether it is an object literal's shorthand
 * property. Bound locally, and so not free inside their scope, are arrow and
 * `function` parameters (plain, destructured, defaulted and rest), a named
 * function expression's own name, method parameters, `catch` bindings, and
 * `const`, `let`, `var`, `function` and `class` declarations inside a block
 * (`var` read as block-scoped). Never free are property keys, member-access
 * tails and the identifiers of a parameter's type annotation.
 *
 * @param tokens - The expression's tokens ({@link tokenizeExpression}).
 * @returns The reading of each identifier token, keyed by token index.
 * @example
 * const tokens = tokenizeExpression('options.find((option) => option.value)');
 * // `options` is free; both `option`s are bound by the parameter.
 */
export function readExpressionIdentifiers(
  tokens: readonly ExpressionToken[]
): Map<number, IdentifierReading> {
  // Work on the significant tokens only; `positions` maps back.
  const positions: number[] = [];
  tokens.forEach((token, index) => {
    if (token.kind !== 'space') {
      positions.push(index);
    }
  });
  const significant = positions.map((position) => tokens[position]);
  const count = significant.length;
  const text = (index: number): string =>
    index >= 0 && index < count ? significant[index].text : '';
  const isPunctuator = (index: number, value: string): boolean =>
    index >= 0 &&
    index < count &&
    significant[index].kind === 'punctuator' &&
    significant[index].text === value;
  const isIdentifierAt = (index: number): boolean =>
    index >= 0 && index < count && significant[index].kind === 'identifier';

  // Matching brackets, and each token's innermost enclosing opening bracket.
  const match = new Map<number, number>();
  const enclosing: number[] = new Array(count).fill(-1);
  const stack: number[] = [];
  for (let index = 0; index < count; index += 1) {
    enclosing[index] = stack.length > 0 ? stack[stack.length - 1] : -1;
    if (significant[index].kind !== 'punctuator') {
      continue;
    }
    const value = significant[index].text;
    if (value === '(' || value === '[' || value === '{') {
      stack.push(index);
    } else if (value === ')' || value === ']' || value === '}') {
      const opening = stack.pop();
      if (opening !== undefined) {
        match.set(opening, index);
        match.set(index, opening);
      }
    }
  }
  const closingOf = (index: number): number => match.get(index) ?? count - 1;

  const notFree = new Set<number>();
  // The significant-token ranges of parameter type annotations.
  const annotations: Array<[number, number]> = [];
  const scopes: Scope[] = [];
  const blockBraces = new Set<number>();
  // The opening braces of function bodies, the scope a `var` belongs to.
  const functionBodies = new Set<number>();
  // Whether a line break separates significant token `index` from the one
  // before it.
  const lineBreakBefore = (index: number): boolean => {
    if (index <= 0 || index >= count) {
      return false;
    }
    for (
      let position = positions[index - 1] + 1;
      position < positions[index];
      position += 1
    ) {
      if (/[\n\r]/.test(tokens[position].text)) {
        return true;
      }
    }
    return false;
  };

  // Skips an expression from `index` to the first `,` (or any of `stops`) at
  // its own depth, or to a closing bracket that ends the enclosing group.
  const skipExpression = (
    index: number,
    stops: readonly string[] = [',', ';']
  ): number => {
    let depth = 0;
    for (; index < count; index += 1) {
      const token = significant[index];
      if (token.kind !== 'punctuator' && token.kind !== 'identifier') {
        continue;
      }
      const value = token.text;
      if (token.kind === 'punctuator') {
        if (value === '(' || value === '[' || value === '{') {
          depth += 1;
          continue;
        }
        if (value === ')' || value === ']' || value === '}') {
          if (depth === 0) {
            return index;
          }
          depth -= 1;
          continue;
        }
      }
      if (depth === 0 && stops.includes(value)) {
        return index;
      }
    }
    return count;
  };

  // Reads a binding pattern at `index` into `names`, marking its binding
  // identifiers and keys not free. Returns the index just past it.
  const readPattern = (index: number, names: Set<string>): number => {
    if (isIdentifierAt(index)) {
      names.add(text(index));
      notFree.add(index);
      return index + 1;
    }
    if (isPunctuator(index, '[') || isPunctuator(index, '{')) {
      const isObject = text(index) === '{';
      const closing = closingOf(index);
      let cursor = index + 1;
      while (cursor < closing) {
        if (isPunctuator(cursor, ',')) {
          cursor += 1;
          continue;
        }
        if (isPunctuator(cursor, '...')) {
          cursor = readPattern(cursor + 1, names);
        } else if (isObject) {
          // A key: an identifier, a literal or a computed `[expression]`.
          const key = cursor;
          cursor = isPunctuator(key, '[') ? closingOf(key) + 1 : key + 1;
          if (isPunctuator(cursor, ':')) {
            if (isIdentifierAt(key)) {
              notFree.add(key);
            }
            cursor = readPattern(cursor + 1, names);
          } else if (isIdentifierAt(key)) {
            names.add(text(key));
            notFree.add(key);
          }
        } else {
          cursor = readPattern(cursor, names);
        }
        if (isPunctuator(cursor, '=')) {
          cursor = skipExpression(cursor + 1, [',']);
        }
        if (!isPunctuator(cursor, ',')) {
          // Something unrecognized: move on to the next element.
          cursor = Math.max(cursor, skipExpression(cursor, [',']));
        }
      }
      return closing + 1;
    }
    return index + 1;
  };

  // Reads a parameter list between `from` and `to` (exclusive) into `names`.
  const readParameters = (from: number, to: number, names: Set<string>) => {
    let cursor = from;
    while (cursor < to) {
      if (isPunctuator(cursor, ',')) {
        cursor += 1;
        continue;
      }
      if (isPunctuator(cursor, '...')) {
        cursor += 1;
      }
      cursor = readPattern(cursor, names);
      if (isPunctuator(cursor, '?')) {
        cursor += 1;
      }
      if (isPunctuator(cursor, ':')) {
        // A type annotation: none of its identifiers is a reference.
        const end = Math.min(skipExpression(cursor + 1, [',', '=']), to);
        annotations.push([cursor + 1, end]);
        for (let index = cursor + 1; index < end; index += 1) {
          if (isIdentifierAt(index)) {
            notFree.add(index);
          }
        }
        cursor = end;
      }
      if (isPunctuator(cursor, '=')) {
        cursor = skipExpression(cursor + 1, [',']);
      }
      if (cursor < to && !isPunctuator(cursor, ',')) {
        cursor = Math.max(cursor + 1, skipExpression(cursor, [',']));
      }
    }
  };

  // The end of an arrow function's expression body starting at `index`.
  const expressionBodyEnd = (index: number): number => {
    let depth = 0;
    let conditionals = 0;
    for (; index < count; index += 1) {
      const token = significant[index];
      if (token.kind !== 'punctuator') {
        continue;
      }
      const value = token.text;
      if (value === '(' || value === '[' || value === '{') {
        depth += 1;
      } else if (value === ')' || value === ']' || value === '}') {
        if (depth === 0) {
          return index;
        }
        depth -= 1;
      } else if (depth === 0) {
        if (value === ',' || value === ';') {
          return index;
        }
        if (value === '?') {
          conditionals += 1;
        } else if (value === ':') {
          if (conditionals === 0) {
            return index;
          }
          conditionals -= 1;
        }
      }
    }
    return count;
  };

  // The innermost `{` enclosing `index`, or -1.
  const enclosingBrace = (index: number): number => {
    let opening = enclosing[index];
    while (opening !== -1 && text(opening) !== '{') {
      opening = enclosing[opening];
    }
    return opening;
  };

  // `function` expressions and declarations, methods and `catch` clauses: a
  // parenthesized list followed by a block. Read ahead of the arrows, so
  // their parameters' type annotations are recorded first.
  for (let index = 0; index < count; index += 1) {
    if (!isPunctuator(index, '(')) {
      continue;
    }
    const closing = closingOf(index);
    if (!isPunctuator(closing + 1, '{')) {
      continue;
    }
    const body = closing + 1;
    const before = index - 1;
    const keyword = text(before);
    const names = new Set<string>();
    if (keyword === 'catch') {
      readPattern(index + 1, names);
    } else if (keyword === 'function' || isPunctuator(before, '*')) {
      readParameters(index + 1, closing, names);
    } else if (isIdentifierAt(before) && !CONTROL_KEYWORDS.has(keyword)) {
      const declarer = isPunctuator(before - 1, '*') ? before - 2 : before - 1;
      if (text(declarer) === 'function') {
        // A named function: its name is bound inside it too.
        names.add(keyword);
      }
      notFree.add(before);
      readParameters(index + 1, closing, names);
    } else {
      if (CONTROL_KEYWORDS.has(keyword)) {
        blockBraces.add(body);
      }
      continue;
    }
    blockBraces.add(body);
    if (keyword !== 'catch') {
      functionBodies.add(body);
    }
    scopes.push({ names, from: index, to: closingOf(body) + 1 });
  }

  // Arrow functions, last first: an arrow's parameter list records its type
  // annotations before the `=>` of a function type inside one is reached,
  // which is a type, not an arrow.
  for (let index = count - 1; index >= 0; index -= 1) {
    if (
      !isPunctuator(index, '=>') ||
      annotations.some(([from, to]) => from <= index && index < to)
    ) {
      continue;
    }
    const names = new Set<string>();
    const before = index - 1;
    let from: number;
    if (
      isIdentifierAt(before) &&
      isPunctuator(before - 1, ':') &&
      isPunctuator(before - 2, ')')
    ) {
      // A parenthesized list with a return type: `(option): boolean =>`.
      notFree.add(before);
      from = closingOf(before - 2);
      readParameters(from + 1, before - 2, names);
    } else if (isIdentifierAt(before)) {
      names.add(text(before));
      notFree.add(before);
      from = before;
    } else if (isPunctuator(before, ')')) {
      from = closingOf(before);
      readParameters(from + 1, before, names);
    } else {
      continue;
    }
    const body = index + 1;
    let to: number;
    if (isPunctuator(body, '{')) {
      blockBraces.add(body);
      functionBodies.add(body);
      to = closingOf(body) + 1;
    } else {
      to = expressionBodyEnd(body);
    }
    scopes.push({ names, from, to });
  }

  // Whether the `:` at `colon` ends a label or a `case`/`default` clause
  // rather than a conditional's branch: its statement starts with `case` or
  // `default`, or is a single identifier.
  const opensLabeledBlock = (colon: number): boolean => {
    let start = colon - 1;
    if (isPunctuator(start, ')') || isPunctuator(start, ']')) {
      start = closingOf(start);
    }
    while (
      start > 0 &&
      !['{', '}', ';', ':', '?'].some((value) => isPunctuator(start - 1, value))
    ) {
      start -= 1;
      if (isPunctuator(start, ')') || isPunctuator(start, ']')) {
        start = closingOf(start);
      }
    }
    if (isPunctuator(start - 1, '?') || isPunctuator(start - 1, ':')) {
      // A conditional's branch, or a key's value.
      return false;
    }
    const first = text(start);
    return (
      first === 'case' ||
      first === 'default' ||
      (start === colon - 1 && isIdentifierAt(start))
    );
  };

  // Blocks opened by a keyword or at a statement's start.
  for (let index = 0; index < count; index += 1) {
    if (!isPunctuator(index, '{') || blockBraces.has(index)) {
      continue;
    }
    const before = text(index - 1);
    if (
      ['else', 'try', 'catch', 'finally', 'do'].includes(before) ||
      ((before === ';' ||
        before === '}' ||
        before === '{' ||
        (before === ':' && opensLabeledBlock(index - 1))) &&
        enclosingBrace(index) !== -1 &&
        blockBraces.has(enclosingBrace(index)))
    ) {
      blockBraces.add(index);
    }
  }

  // Declarations inside blocks.
  for (let index = 0; index < count; index += 1) {
    if (!isIdentifierAt(index) || isPunctuator(index - 1, '.')) {
      continue;
    }
    const keyword = text(index);
    const brace = enclosingBrace(index);
    const blockTo = brace === -1 ? count : closingOf(brace) + 1;
    if (keyword === 'const' || keyword === 'let' || keyword === 'var') {
      const names = new Set<string>();
      let cursor = index + 1;
      for (;;) {
        cursor = readPattern(cursor, names);
        if (isPunctuator(cursor, '=')) {
          cursor = skipExpression(cursor + 1, [',', ';', 'of', 'in']);
        }
        if (!isPunctuator(cursor, ',')) {
          break;
        }
        cursor += 1;
      }
      let from = brace === -1 ? 0 : brace;
      let to = blockTo;
      if (keyword === 'var') {
        // A `var` belongs to its function, whatever block it sits in.
        let body = brace;
        while (body !== -1 && !functionBodies.has(body)) {
          body = enclosingBrace(body);
        }
        from = body === -1 ? 0 : body;
        to = body === -1 ? count : closingOf(body) + 1;
      } else if (isPunctuator(index - 1, '(') && text(index - 2) === 'for') {
        // A `for` header: the binding lives in the loop.
        from = index - 2;
        const header = closingOf(index - 1);
        to = isPunctuator(header + 1, '{')
          ? closingOf(header + 1) + 1
          : skipExpression(header + 1, [';']);
      }
      scopes.push({ names, from, to });
    } else if (
      (keyword === 'function' || keyword === 'class') &&
      brace !== -1 &&
      blockBraces.has(brace)
    ) {
      const nameIndex = isPunctuator(index + 1, '*') ? index + 2 : index + 1;
      if (isIdentifierAt(nameIndex)) {
        notFree.add(nameIndex);
        scopes.push({
          names: new Set([text(nameIndex)]),
          from: brace,
          to: blockTo,
        });
      }
    }
  }

  // Class bodies: the first `{` after `class` outside brackets.
  const classBodies = new Set<number>();
  for (let index = 0; index < count; index += 1) {
    if (
      !isIdentifierAt(index) ||
      text(index) !== 'class' ||
      isPunctuator(index - 1, '.') ||
      isPunctuator(index - 1, '?.') ||
      // An object key or method named `class`, not a declaration.
      isPunctuator(index + 1, ':') ||
      isPunctuator(index + 1, '(')
    ) {
      continue;
    }
    let depth = 0;
    for (let cursor = index + 1; cursor < count; cursor += 1) {
      const value = text(cursor);
      if (significant[cursor].kind !== 'punctuator') {
        continue;
      }
      if (value === '{' && depth === 0) {
        classBodies.add(cursor);
        break;
      }
      if (value === '(' || value === '[' || value === '<') {
        depth += 1;
      } else if (value === ')' || value === ']' || value === '>') {
        depth -= 1;
      } else if (value === ';' || value === '}') {
        break;
      }
    }
  }

  // Labels and the `break` or `continue` naming one.
  for (let index = 0; index < count; index += 1) {
    if (!isIdentifierAt(index)) {
      continue;
    }
    const previous = text(index - 1);
    if (
      (previous === 'break' || previous === 'continue') &&
      isIdentifierAt(index - 1) &&
      !lineBreakBefore(index)
    ) {
      notFree.add(index);
      continue;
    }
    const opening = enclosing[index];
    const atStatementStart =
      index === 0 ||
      ((previous === ';' || previous === '}' || previous === '{') &&
        significant[index - 1].kind === 'punctuator');
    if (
      atStatementStart &&
      isPunctuator(index + 1, ':') &&
      (opening === -1 || blockBraces.has(opening)) &&
      !classBodies.has(opening)
    ) {
      notFree.add(index);
    }
  }

  // Object literal keys, class field names and member-access tails.
  const shorthand = new Set<number>();
  for (let index = 0; index < count; index += 1) {
    if (!isIdentifierAt(index) || notFree.has(index)) {
      continue;
    }
    if (
      isPunctuator(index - 1, '.') ||
      isPunctuator(index - 1, '?.') ||
      isPunctuator(index - 1, '#')
    ) {
      // A member-access tail, or a private name (`#count`, `this.#count`).
      notFree.add(index);
      continue;
    }
    const opening = enclosing[index];
    if (classBodies.has(opening)) {
      // A field's name starts a member: after the body's `{`, a `;`, a
      // method's `}`, a modifier or a line break, ahead of its initializer,
      // annotation or the member's end.
      const startsMember =
        isPunctuator(index - 1, '{') ||
        isPunctuator(index - 1, ';') ||
        isPunctuator(index - 1, '}') ||
        CLASS_MEMBER_MODIFIERS.has(text(index - 1)) ||
        (lineBreakBefore(index) &&
          !(
            significant[index - 1].kind === 'punctuator' &&
            text(index - 1) !== ')' &&
            text(index - 1) !== ']'
          ));
      const endsName =
        ['=', ';', ':', '?', '!', '}'].some((value) =>
          isPunctuator(index + 1, value)
        ) || lineBreakBefore(index + 1);
      if (
        startsMember &&
        endsName &&
        !CLASS_MEMBER_MODIFIERS.has(text(index))
      ) {
        notFree.add(index);
      }
      continue;
    }
    const inObjectLiteral =
      opening !== -1 && text(opening) === '{' && !blockBraces.has(opening);
    const startsEntry =
      isPunctuator(index - 1, '{') || isPunctuator(index - 1, ',');
    if (!inObjectLiteral || !startsEntry) {
      continue;
    }
    if (isPunctuator(index + 1, ':')) {
      notFree.add(index);
    } else if (isPunctuator(index + 1, ',') || isPunctuator(index + 1, '}')) {
      shorthand.add(index);
    }
  }

  const readings = new Map<number, IdentifierReading>();
  for (let index = 0; index < count; index += 1) {
    if (!isIdentifierAt(index)) {
      continue;
    }
    const name = text(index);
    const bound = scopes.some(
      (scope) =>
        scope.names.has(name) && scope.from <= index && index < scope.to
    );
    readings.set(positions[index], {
      free: !notFree.has(index) && !bound,
      shorthandProperty: shorthand.has(index),
    });
  }
  return readings;
}

/** Keywords an expression continues after, as after an operator. */
const OPERATOR_KEYWORDS = new Set([
  'await',
  'new',
  'return',
  'typeof',
  'void',
  'delete',
  'yield',
  'in',
  'of',
  'instanceof',
  'export',
  'default',
]);

/** Keywords that start a statement, ending the declaration before them. */
const DECLARATION_KEYWORDS = new Set([
  'const',
  'let',
  'var',
  'import',
  'export',
]);

/**
 * The names a script declares at its top level: each `const`, `let` or `var`
 * binding outside every bracket (each identifier a destructuring pattern
 * binds, not its keys, type annotation or defaults), each top-level
 * `function`, `class` and `enum` name, and each import binding (a default, a
 * namespace and named ones, under their local `as` names). A declaration inside a function body, block or callback is that
 * scope's own and is not read.
 *
 * @param script - The script.
 * @returns The declared names.
 * @example
 * topLevelDeclarations('const value = computed(() => { const inner = 1; return inner; });');
 * // Set { 'value' }
 */
export function topLevelDeclarations(script: string): Set<string> {
  const significant = tokenizeExpression(script).filter(
    (token) => token.kind !== 'space'
  );
  const names = new Set<string>();
  const count = significant.length;
  const text = (index: number): string =>
    index >= 0 && index < count ? significant[index].text : '';
  const isOpening = (value: string): boolean =>
    value === '(' || value === '[' || value === '{';
  const isClosing = (value: string): boolean =>
    value === ')' || value === ']' || value === '}';

  // Whether a token can end an expression, so a declaration keyword after it
  // starts a new statement (a line without a semicolon).
  const endsExpression = (index: number): boolean => {
    const token = significant[index];
    return (
      token !== undefined &&
      (token.kind === 'punctuator'
        ? isClosing(token.text)
        : !OPERATOR_KEYWORDS.has(token.text))
    );
  };

  // Whether the token is the `const` of a TypeScript `as const` assertion,
  // which ends an expression rather than starting a declaration.
  const isConstAssertion = (index: number): boolean =>
    text(index) === 'const' && text(index - 1) === 'as';

  // Skips a balanced group or an expression to `,`, `;`, a closing bracket or
  // the next declaration at its own depth.
  const skip = (index: number): number => {
    let depth = 0;
    for (; index < count; index += 1) {
      const value = text(index);
      if (significant[index].kind === 'identifier') {
        if (
          depth === 0 &&
          ((DECLARATION_KEYWORDS.has(value) && !isConstAssertion(index)) ||
            ((value === 'function' || value === 'class') &&
              endsExpression(index - 1)))
        ) {
          return index;
        }
        continue;
      }
      if (significant[index].kind !== 'punctuator') {
        continue;
      }
      if (isOpening(value)) {
        depth += 1;
      } else if (isClosing(value)) {
        if (depth === 0) {
          return index;
        }
        depth -= 1;
      } else if (depth === 0 && (value === ',' || value === ';')) {
        return index;
      }
    }
    return count;
  };

  // Reads a binding pattern; returns the index just past it.
  const readPattern = (index: number): number => {
    const token = significant[index];
    if (token === undefined) {
      return index;
    }
    if (token.kind === 'identifier') {
      names.add(token.text);
      return index + 1;
    }
    if (token.text !== '[' && token.text !== '{') {
      return index + 1;
    }
    const isObject = token.text === '{';
    const closing = isObject ? '}' : ']';
    let cursor = index + 1;
    while (cursor < count && text(cursor) !== closing) {
      if (text(cursor) === ',') {
        cursor += 1;
        continue;
      }
      if (text(cursor) === '...') {
        cursor = readPattern(cursor + 1);
      } else if (isObject) {
        const key = cursor;
        cursor = text(key) === '[' ? skip(key + 1) + 1 : key + 1;
        if (text(cursor) === ':') {
          cursor = readPattern(cursor + 1);
        } else if (significant[key].kind === 'identifier') {
          names.add(significant[key].text);
        }
      } else {
        cursor = readPattern(cursor);
      }
      if (text(cursor) === '=') {
        cursor = skip(cursor + 1);
      }
      if (text(cursor) !== ',' && text(cursor) !== closing) {
        cursor = skip(cursor);
      }
    }
    return cursor + 1;
  };

  // Skips a type annotation to the `=`, `,` or `;` that ends it, reading
  // `<` and `>` as brackets.
  const skipAnnotation = (index: number): number => {
    let depth = 0;
    for (; index < count; index += 1) {
      const value = text(index);
      if (significant[index].kind !== 'punctuator') {
        continue;
      }
      if (isOpening(value) || value === '<') {
        depth += 1;
      } else if (isClosing(value) || value === '>') {
        if (depth === 0) {
          return index;
        }
        depth -= 1;
      } else if (
        depth === 0 &&
        (value === '=' || value === ',' || value === ';')
      ) {
        return index;
      }
    }
    return count;
  };

  // Reads an import declaration's bindings after `import`: a default, a
  // namespace (`* as name`) and named ones (`{ a, b as c }`), `type`
  // modifiers included. Returns the index just past its last binding.
  const readImport = (index: number): number => {
    let cursor = index;
    if (
      text(cursor) === 'type' &&
      text(cursor + 1) !== 'from' &&
      text(cursor + 1) !== ','
    ) {
      cursor += 1;
    }
    for (;;) {
      const token = significant[cursor];
      if (token === undefined || token.kind === 'string') {
        return cursor;
      }
      if (token.text === '*') {
        // `* as name`
        if (significant[cursor + 2]?.kind === 'identifier') {
          names.add(significant[cursor + 2].text);
        }
        cursor += 3;
      } else if (token.text === '{') {
        cursor += 1;
        while (cursor < count && text(cursor) !== '}') {
          if (text(cursor) === ',') {
            cursor += 1;
            continue;
          }
          if (
            text(cursor) === 'type' &&
            text(cursor + 1) !== ',' &&
            text(cursor + 1) !== '}' &&
            text(cursor + 1) !== 'as'
          ) {
            cursor += 1;
          }
          const imported = cursor;
          cursor += 1;
          if (text(cursor) === 'as') {
            if (significant[cursor + 1]?.kind === 'identifier') {
              names.add(significant[cursor + 1].text);
            }
            cursor += 2;
          } else if (significant[imported]?.kind === 'identifier') {
            names.add(significant[imported].text);
          }
        }
        cursor += 1;
      } else if (token.kind === 'identifier' && token.text !== 'from') {
        names.add(token.text);
        cursor += 1;
      } else {
        return cursor;
      }
      if (text(cursor) !== ',') {
        return cursor;
      }
      cursor += 1;
    }
  };

  let depth = 0;
  for (let index = 0; index < count; index += 1) {
    const token = significant[index];
    if (token.kind === 'punctuator') {
      if (isOpening(token.text)) {
        depth += 1;
      } else if (isClosing(token.text)) {
        depth = Math.max(0, depth - 1);
      }
      continue;
    }
    if (depth !== 0 || token.kind !== 'identifier' || text(index - 1) === '.') {
      continue;
    }
    if (token.text === 'import' && text(index + 1) !== '(') {
      index = readImport(index + 1) - 1;
    } else if (
      token.text === 'enum' ||
      (token.text === 'const' && text(index + 1) === 'enum')
    ) {
      const nameIndex = token.text === 'enum' ? index + 1 : index + 2;
      if (significant[nameIndex]?.kind === 'identifier') {
        names.add(significant[nameIndex].text);
      }
      index = nameIndex;
    } else if (
      (token.text === 'const' && !isConstAssertion(index)) ||
      token.text === 'let' ||
      token.text === 'var'
    ) {
      let cursor = index + 1;
      for (;;) {
        cursor = readPattern(cursor);
        if (text(cursor) === ':') {
          cursor = skipAnnotation(cursor + 1);
        }
        if (text(cursor) === '=') {
          cursor = skip(cursor + 1);
        }
        if (text(cursor) !== ',') {
          break;
        }
        cursor += 1;
      }
      // Resume at the end of the declaration, where the depth is 0 again.
      index = cursor - 1;
    } else if (token.text === 'function' || token.text === 'class') {
      const nameIndex = text(index + 1) === '*' ? index + 2 : index + 1;
      if (significant[nameIndex]?.kind === 'identifier') {
        names.add(significant[nameIndex].text);
      }
    }
  }
  return names;
}

/**
 * Splits each template literal token at its placeholders: the literal's
 * text around them stays string tokens and each placeholder's expression
 * becomes tokens of its own, so {@link readExpressionIdentifiers} reads it
 * where it sits. The tokens' texts still concatenate back to the source.
 *
 * @param tokens - The tokens ({@link tokenizeExpression}).
 * @returns The tokens with each template literal split.
 * @example
 * flattenTemplateLiterals(tokenizeExpression('`${count} rows`')).map((token) => token.text);
 * // ['`${', 'count', '} rows`']
 */
export function flattenTemplateLiterals(
  tokens: readonly ExpressionToken[]
): ExpressionToken[] {
  const flattened: ExpressionToken[] = [];
  for (const token of tokens) {
    if (token.kind !== 'string' || !token.text.startsWith('`')) {
      flattened.push(token);
      continue;
    }
    const { text } = token;
    let literalStart = 0;
    let index = 0;
    while (index < text.length) {
      if (text[index] === '\\') {
        index += 2;
        continue;
      }
      if (!text.startsWith('${', index)) {
        index += 1;
        continue;
      }
      const expressionStart = index + 2;
      const end = placeholderEnd(text, expressionStart);
      flattened.push({
        kind: 'string',
        text: text.slice(literalStart, expressionStart),
      });
      flattened.push(
        ...flattenTemplateLiterals(
          tokenizeExpression(text.slice(expressionStart, end))
        )
      );
      literalStart = end;
      index = end + 1;
    }
    flattened.push({ kind: 'string', text: text.slice(literalStart) });
  }
  return flattened;
}

/** The index of the `}` closing a placeholder whose expression starts at
 *  `start`, skipping the strings and brackets inside it. */
function placeholderEnd(text: string, start: number): number {
  let depth = 0;
  let offset = start;
  for (const token of tokenizeExpression(text.slice(start))) {
    if (token.kind === 'punctuator' && token.text === '{') {
      depth += 1;
    } else if (token.kind === 'punctuator' && token.text === '}') {
      if (depth === 0) {
        return offset;
      }
      depth -= 1;
    }
    offset += token.text.length;
  }
  return text.length;
}
