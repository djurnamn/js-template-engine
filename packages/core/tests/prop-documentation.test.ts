// A prop's description becomes the TSDoc comment every scripted target writes
// above the generated prop; a prop without one gets none.

import { describe, expect, it } from 'vitest';
import { documentationComment, propDocumentation } from '../src/prop-documentation';

describe('propDocumentation', () => {
  it('writes nothing without a description, or with a blank one', () => {
    expect(propDocumentation({ type: 'string' }, '  ', "'x'")).toEqual([]);
    expect(propDocumentation({ type: 'string', description: '   ' }, '  ')).toEqual([]);
  });

  it('writes a one-line description without a default on one line', () => {
    expect(propDocumentation({ type: 'string', description: 'The text.' }, '  ')).toEqual([
      '  /** The text. */',
    ]);
  });

  it('adds the default as @defaultValue, and keeps paragraphs and markdown', () => {
    expect(
      propDocumentation(
        { type: 'string', default: 'Go', description: 'The text.\n\nShown **bold**.' },
        '',
        "'Go'"
      )
    ).toEqual(['/**', ' * The text.', ' *', ' * Shown **bold**.', ' *', " * @defaultValue `'Go'`", ' */']);
  });

  it('writes a documented default as @defaultValue, as it writes a declared one', () => {
    const declared = propDocumentation(
      { type: "'start' | 'end'", default: 'start', description: 'The side.' },
      '  ',
      "'start'"
    );
    const documented = propDocumentation(
      { type: "'start' | 'end'", documentedDefault: "'start'", description: 'The side.' },
      '  '
    );
    expect(documented).toEqual(declared);
    expect(documented).toEqual(['  /**', '   * The side.', '   *', "   * @defaultValue `'start'`", '   */']);
  });

  it('escapes a comment terminator in a documented default', () => {
    expect(
      propDocumentation(
        { type: 'string', documentedDefault: "'a */ b'", description: 'The text.' },
        ''
      )
    ).toEqual(['/**', ' * The text.', ' *', " * @defaultValue `'a *\\/ b'`", ' */']);
  });

  it('writes nothing for a documented default without a description, as for a declared one', () => {
    expect(propDocumentation({ type: 'boolean', documentedDefault: 'false' }, '  ')).toEqual([]);
  });

  it('escapes a comment terminator in the text', () => {
    expect(propDocumentation({ type: 'string', description: 'ends with */ here' }, '')).toEqual([
      '/** ends with *\\/ here */',
    ]);
  });
});

describe('documentationComment', () => {
  it('writes a component description as a block when it spans lines', () => {
    expect(
      documentationComment('A short label.\n\nUse a `Button` for an action; */ stays inside.', '')
    ).toEqual([
      '/**',
      ' * A short label.',
      ' *',
      ' * Use a `Button` for an action; *\\/ stays inside.',
      ' */',
    ]);
  });

  it('writes nothing without a description', () => {
    expect(documentationComment(undefined, '')).toEqual([]);
  });
});
