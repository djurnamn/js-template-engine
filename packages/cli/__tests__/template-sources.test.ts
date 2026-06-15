import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadTemplate, resolveTemplateSources } from '../src/template-sources';

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'cli-template-sources-'));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

const template = { type: 'element', tag: 'div' };

describe('resolveTemplateSources', () => {
  it('resolves a file to itself', () => {
    const filePath = join(directory, 'button.json');
    writeFileSync(filePath, JSON.stringify(template));
    expect(resolveTemplateSources(filePath)).toEqual([filePath]);
  });

  it('resolves a directory to its template files, sorted by name', () => {
    writeFileSync(join(directory, 'b.json'), '{}');
    writeFileSync(join(directory, 'a.ts'), 'export default {}');
    writeFileSync(join(directory, 'c.mjs'), 'export default {}');
    writeFileSync(join(directory, 'notes.md'), '# not a template');
    writeFileSync(join(directory, 'types.d.ts'), 'export {}');
    mkdirSync(join(directory, 'nested'));
    writeFileSync(join(directory, 'nested', 'd.json'), '{}');

    expect(resolveTemplateSources(directory)).toEqual([
      join(directory, 'a.ts'),
      join(directory, 'b.json'),
      join(directory, 'c.mjs'),
    ]);
  });

  it('rejects a missing path', () => {
    expect(() => resolveTemplateSources(join(directory, 'missing.json'))).toThrow(
      /does not exist/
    );
  });

  it('rejects a directory without template files', () => {
    expect(() => resolveTemplateSources(directory)).toThrow(
      /No template files found/
    );
  });
});

describe('loadTemplate', () => {
  it('parses a .json template', async () => {
    const filePath = join(directory, 'button.json');
    writeFileSync(filePath, JSON.stringify(template));
    await expect(loadTemplate(filePath)).resolves.toEqual(template);
  });

  it('imports the default export of a .ts template', async () => {
    const filePath = join(directory, 'button.ts');
    writeFileSync(
      filePath,
      "const template = { type: 'element', tag: 'div' } as const;\nexport default template;\n"
    );
    await expect(loadTemplate(filePath)).resolves.toEqual(template);
  });

  it('imports the default export of an .mjs template', async () => {
    const filePath = join(directory, 'button.mjs');
    writeFileSync(
      filePath,
      "export default { type: 'element', tag: 'div' };\n"
    );
    await expect(loadTemplate(filePath)).resolves.toEqual(template);
  });

  it('imports a .cjs template assigned to module.exports', async () => {
    const filePath = join(directory, 'button.cjs');
    writeFileSync(
      filePath,
      "module.exports = { type: 'element', tag: 'div' };\n"
    );
    await expect(loadTemplate(filePath)).resolves.toEqual(template);
  });

  it('rejects a module without a default export', async () => {
    const filePath = join(directory, 'button.ts');
    writeFileSync(filePath, "export const template = { type: 'element' };\n");
    await expect(loadTemplate(filePath)).rejects.toThrow(
      /does not default-export a template/
    );
  });
});
