import type { PropDefinition } from '@js-template-engine/types';

/**
 * A TSDoc comment holding a description, as a target writes it above a
 * generated prop or component: one line as `/** ... *\/`, more as a block,
 * and a `@defaultValue` when a default is given. Markdown passes through; a
 * `*\/` in the text is escaped, since it would end the comment.
 *
 * @param description - The text, or `undefined` for none
 * @param indentation - The indentation of the documented line
 * @param serializedDefault - A default to add as `@defaultValue`, as the
 *   target writes it in code
 * @returns The comment's lines, each indented; empty without a description
 * @example
 * documentationComment('A short label.', '');
 * // ['/** A short label. *\/']
 */
export function documentationComment(
  description: string | undefined,
  indentation: string,
  serializedDefault?: string
): string[] {
  const trimmed = description?.trim();
  if (trimmed === undefined || trimmed === '') {
    return [];
  }
  const escape = (text: string): string => text.replace(/\*\//g, '*\\/');
  const text = escape(trimmed)
    .split('\n')
    .map((line) => line.trimEnd());
  if (serializedDefault === undefined && text.length === 1) {
    return [`${indentation}/** ${text[0]} */`];
  }
  const body = text.map((line) =>
    line === '' ? `${indentation} *` : `${indentation} * ${line}`
  );
  if (serializedDefault !== undefined) {
    body.push(
      `${indentation} *`,
      `${indentation} * @defaultValue \`${escape(serializedDefault)}\``
    );
  }
  return [`${indentation}/**`, ...body, `${indentation} */`];
}

/**
 * The TSDoc comment a target writes above a generated prop: the prop's
 * `description`, and a `@defaultValue` when it declares a default or
 * documents one with `documentedDefault`. A documented default is written
 * as given, in the same place and form as a declared one. A prop with no
 * description gets none, so its output is unchanged. A `*\/` in the text is
 * escaped, since it would end the comment.
 *
 * @param definition - The prop's definition
 * @param indentation - The indentation of the prop's own line
 * @param serializedDefault - The default as the target writes it in code,
 *   when the prop declares one
 * @returns The comment's lines, each indented; empty without a description
 * @example
 * propDocumentation({ type: 'string', description: 'The text.', default: 'Go' }, '  ', "'Go'");
 * // ['  /**', '   * The text.', '   *', "   * @defaultValue `'Go'`", '   *\/']
 * propDocumentation({ type: "'start' | 'end'", description: 'The side.', documentedDefault: "'start'" }, '  ');
 * // ['  /**', '   * The side.', '   *', "   * @defaultValue `'start'`", '   *\/']
 */
export function propDocumentation(
  definition: PropDefinition,
  indentation: string,
  serializedDefault?: string
): string[] {
  return documentationComment(
    definition.description,
    indentation,
    serializedDefault ?? definition.documentedDefault
  );
}
