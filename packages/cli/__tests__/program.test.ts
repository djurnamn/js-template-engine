import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { InvalidArgumentError } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createProgram, parseStylingList } from '../src/program';

let directory: string;
let exitCodeBefore: number | string | undefined;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'cli-program-'));
  exitCodeBefore = process.exitCode;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
  process.exitCode = exitCodeBefore;
  vi.restoreAllMocks();
});

function run(...commandArguments: string[]): Promise<unknown> {
  return createProgram().parseAsync([
    'node',
    'js-template-engine',
    ...commandArguments,
  ]);
}

function writeTemplate(name: string, template: unknown): string {
  const filePath = join(directory, name);
  writeFileSync(filePath, JSON.stringify(template));
  return filePath;
}

const buttonTemplate = {
  type: 'component',
  name: 'Button',
  children: [
    {
      type: 'element',
      tag: 'button',
      attributes: { class: ['button'] },
      children: [{ type: 'text', content: 'Click me' }],
    },
  ],
};

describe('parseStylingList', () => {
  it('splits a comma-separated list, keeping order', () => {
    expect(parseStylingList('tailwind,bem')).toEqual(['tailwind', 'bem']);
  });

  it('trims whitespace and drops empty entries', () => {
    expect(parseStylingList(' bem , ')).toEqual(['bem']);
  });

  it('rejects unknown names', () => {
    expect(() => parseStylingList('bem,scss')).toThrow(InvalidArgumentError);
  });
});

describe('render', () => {
  it('renders a template to the output directory', async () => {
    const source = writeTemplate('button.json', buttonTemplate);
    const outputDirectory = join(directory, 'output');

    await run('render', source, '--output-directory', outputDirectory);

    expect(process.exitCode).toBe(exitCodeBefore);
    const html = readFileSync(join(outputDirectory, 'Button.html'), 'utf8');
    expect(html).toContain('<button class="button">');
  });

  it('renders with a framework extension', async () => {
    const source = writeTemplate('button.json', buttonTemplate);
    const outputDirectory = join(directory, 'output');

    await run(
      'render',
      source,
      '--framework',
      'react',
      '--output-directory',
      outputDirectory
    );

    const component = readFileSync(
      join(outputDirectory, 'Button.tsx'),
      'utf8'
    );
    expect(component).toContain('export function Button');
  });

  it('derives the component name from the filename', async () => {
    const source = writeTemplate('icon-badge.json', [
      { type: 'element', tag: 'span' },
    ]);
    const outputDirectory = join(directory, 'output');

    await run('render', source, '--output-directory', outputDirectory);

    expect(existsSync(join(outputDirectory, 'IconBadge.html'))).toBe(true);
  });

  it('prefers --component-name over the filename', async () => {
    const source = writeTemplate('icon-badge.json', [
      { type: 'element', tag: 'span' },
    ]);
    const outputDirectory = join(directory, 'output');

    await run(
      'render',
      source,
      '--component-name',
      'Badge',
      '--output-directory',
      outputDirectory
    );

    expect(existsSync(join(outputDirectory, 'Badge.html'))).toBe(true);
  });

  it('continues past a failing template in a directory and exits non-zero', async () => {
    writeTemplate('good.json', [{ type: 'element', tag: 'div' }]);
    writeTemplate('bad.json', [{ type: 'mystery' }]);
    const outputDirectory = join(directory, 'output');

    await run('render', directory, '--output-directory', outputDirectory);

    expect(process.exitCode).toBe(1);
    expect(existsSync(join(outputDirectory, 'Good.html'))).toBe(true);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('bad.json: error:')
    );
  });

  it('reports a missing source and exits non-zero', async () => {
    await run('render', join(directory, 'missing.json'));

    expect(process.exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('does not exist')
    );
  });
});

describe('validate', () => {
  it('confirms a valid template', async () => {
    const source = writeTemplate('button.json', buttonTemplate);

    await run('validate', source);

    expect(process.exitCode).toBe(exitCodeBefore);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('valid')
    );
  });

  it('reports an invalid template and exits non-zero', async () => {
    const source = writeTemplate('broken.json', [{ type: 'mystery' }]);

    await run('validate', source);

    expect(process.exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('invalid')
    );
  });
});
