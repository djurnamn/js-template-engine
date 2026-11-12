// The React name of each attribute React renames, checked against React's
// own list of standard names in the development build of react-dom, where
// the workspace has it.

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { attributeName, REACT_ATTRIBUTE_NAMES } from '../src';

/** React's `possibleStandardNames`, read from react-dom's development build. */
function reactStandardNames(): Record<string, string> | undefined {
  let root: string;
  try {
    const require = createRequire(join(__dirname, '../../preview/package.json'));
    root = dirname(require.resolve('react-dom/package.json'));
  } catch {
    return undefined;
  }
  const file = join(root, 'cjs/react-dom-server-legacy.node.development.js');
  if (!existsSync(file)) return undefined;
  const source = readFileSync(file, 'utf8');
  const start = source.indexOf('possibleStandardNames = {');
  if (start === -1) return undefined;
  const end = source.indexOf('}', start);
  return Function(`return ${source.slice(start + 'possibleStandardNames = '.length, end + 1)}`)();
}

/** Names React lists that the table leaves to the extension or to React alone. */
const LEFT_OUT = new Set([
  'class',
  'classname',
  'htmlfor',
  'dangerouslysetinnerhtml',
  'innerhtml',
  'defaultchecked',
  'defaultvalue',
  'suppresscontenteditablewarning',
  'suppresshydrationwarning',
]);

describe('REACT_ATTRIBUTE_NAMES', () => {
  it('spells HTML, SVG and namespaced names as React does', () => {
    expect(attributeName('formnovalidate')).toBe('formNoValidate');
    expect(attributeName('enterkeyhint')).toBe('enterKeyHint');
    expect(attributeName('accept-charset')).toBe('acceptCharset');
    expect(attributeName('http-equiv')).toBe('httpEquiv');
    expect(attributeName('popovertarget')).toBe('popoverTarget');
    expect(attributeName('xlink:href')).toBe('xlinkHref');
    expect(attributeName('xml:lang')).toBe('xmlLang');
    expect(attributeName('aria-label')).toBe('aria-label');
    expect(attributeName('viewBox')).toBe('viewBox');
  });

  it('holds every name React renames, and each as React spells it', () => {
    const standard = reactStandardNames();
    if (!standard) return;
    const missing = Object.entries(standard).filter(
      ([name, react]) => name !== react && !LEFT_OUT.has(name) && REACT_ATTRIBUTE_NAMES[name] !== react
    );
    expect(missing).toEqual([]);
  });
});
