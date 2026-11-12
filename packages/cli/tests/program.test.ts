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

  it("gives a prop the alias validate expects, clear of every target's names", async () => {
    // `useAttrs` is a name only Vue's output declares; a React render still
    // aliases `use-attrs` clear of it, as the expression reads it.
    const source = writeTemplate('field.json', {
      type: 'component',
      name: 'Field',
      props: { 'use-attrs': { type: 'string' } },
      children: [
        {
          type: 'element',
          tag: 'span',
          children: [{ type: 'text', expression: 'useAttrsProp' }],
        },
      ],
    });
    const outputDirectory = join(directory, 'output');

    await run(
      'render',
      source,
      '--target',
      'react',
      '--output-directory',
      outputDirectory
    );

    const component = readFileSync(join(outputDirectory, 'Field.tsx'), 'utf8');
    expect(component).toContain("'use-attrs': useAttrsProp");
    expect(component).toContain('{useAttrsProp}');
  });

  it('renders with a target extension', async () => {
    const source = writeTemplate('button.json', buttonTemplate);
    const outputDirectory = join(directory, 'output');

    await run(
      'render',
      source,
      '--target',
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

  it('renders a legacy Svelte component by default', async () => {
    const source = writeTemplate('button.json', buttonTemplate);
    const outputDirectory = join(directory, 'output');

    await run(
      'render',
      source,
      '--target',
      'svelte',
      '--output-directory',
      outputDirectory
    );

    const component = readFileSync(
      join(outputDirectory, 'Button.svelte'),
      'utf8'
    );
    expect(component).not.toContain('$props()');
    expect(component).not.toContain('svelte:options');
  });

  it('renders a Svelte runes component with --svelte-mode runes', async () => {
    const source = writeTemplate('button.json', buttonTemplate);
    const outputDirectory = join(directory, 'output');

    await run(
      'render',
      source,
      '--target',
      'svelte',
      '--svelte-mode',
      'runes',
      '--output-directory',
      outputDirectory
    );

    const component = readFileSync(
      join(outputDirectory, 'Button.svelte'),
      'utf8'
    );
    expect(component).toMatch(/\$props\(\)|svelte:options/);
  });

  it('renders HTML with --target html', async () => {
    const source = writeTemplate('button.json', buttonTemplate);
    const outputDirectory = join(directory, 'output');

    await run(
      'render',
      source,
      '--target',
      'html',
      '--output-directory',
      outputDirectory
    );

    expect(process.exitCode).toBe(exitCodeBefore);
    expect(console.error).not.toHaveBeenCalled();
    const html = readFileSync(join(outputDirectory, 'Button.html'), 'utf8');
    expect(html).toContain('<button class="button">');
  });

  it('puts the styles in a stylesheet of their own with --stylesheet-placement separate-file', async () => {
    const source = writeTemplate('banner.json', {
      type: 'component',
      name: 'Banner',
      children: [
        {
          type: 'element',
          tag: 'div',
          attributes: { class: ['banner'], style: { color: 'red' } },
        },
      ],
    });
    const outputDirectory = join(directory, 'output');

    await run(
      'render',
      source,
      '--stylesheet-placement',
      'separate-file',
      '--output-directory',
      outputDirectory
    );

    expect(console.error).not.toHaveBeenCalled();
    expect(existsSync(join(outputDirectory, 'Banner.css'))).toBe(true);
  });

  it('accepts the deprecated --framework with one warning', async () => {
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

    expect(process.exitCode).toBe(exitCodeBefore);
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      'warning: --framework is deprecated and will be removed in 3.0.0; use --target'
    );
    expect(existsSync(join(outputDirectory, 'Button.tsx'))).toBe(true);
  });

  it('accepts the deprecated --styling-strategy with one warning', async () => {
    const source = writeTemplate('banner.json', {
      type: 'component',
      name: 'Banner',
      children: [
        {
          type: 'element',
          tag: 'div',
          attributes: { class: ['banner'], style: { color: 'red' } },
        },
      ],
    });
    const outputDirectory = join(directory, 'output');

    await run(
      'render',
      source,
      '--styling-strategy',
      'separate-file',
      '--output-directory',
      outputDirectory
    );

    expect(process.exitCode).toBe(exitCodeBefore);
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      'warning: --styling-strategy is deprecated and will be removed in 3.0.0; use --stylesheet-placement'
    );
    expect(existsSync(join(outputDirectory, 'Banner.css'))).toBe(true);
  });

  it('accepts a deprecated flag that agrees with its successor, with the warning', async () => {
    const source = writeTemplate('button.json', buttonTemplate);
    const outputDirectory = join(directory, 'output');

    await run(
      'render',
      source,
      '--target',
      'vue',
      '--framework',
      'vue',
      '--output-directory',
      outputDirectory
    );

    expect(process.exitCode).toBe(exitCodeBefore);
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(existsSync(join(outputDirectory, 'Button.vue'))).toBe(true);
  });

  it('rejects --framework and --target that disagree', async () => {
    const source = writeTemplate('button.json', buttonTemplate);
    const outputDirectory = join(directory, 'output');

    await run(
      'render',
      source,
      '--target',
      'vue',
      '--framework',
      'react',
      '--output-directory',
      outputDirectory
    );

    expect(process.exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      'error: --framework react and --target vue disagree; pass --target alone'
    );
    expect(existsSync(outputDirectory)).toBe(false);
  });

  it('rejects --styling-strategy and --stylesheet-placement that disagree', async () => {
    const source = writeTemplate('button.json', buttonTemplate);
    const outputDirectory = join(directory, 'output');

    await run(
      'render',
      source,
      '--stylesheet-placement',
      'inline',
      '--styling-strategy',
      'separate-file',
      '--output-directory',
      outputDirectory
    );

    expect(process.exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      'error: --styling-strategy separate-file and --stylesheet-placement inline disagree; pass --stylesheet-placement alone'
    );
    expect(existsSync(outputDirectory)).toBe(false);
  });

  it('keeps the deprecated flags out of the help', () => {
    const render = createProgram().commands.find(
      (command) => command.name() === 'render'
    );
    const help = render?.helpInformation() ?? '';
    expect(help).toContain('--target <name>');
    expect(help).toContain('--stylesheet-placement <placement>');
    expect(help).not.toContain('--framework');
    expect(help).not.toContain('--styling-strategy');
  });

  it('rejects an invalid --tailwind-dark-selector once, naming the flag', async () => {
    const source = writeTemplate('button.json', buttonTemplate);
    const outputDirectory = join(directory, 'output');

    await run(
      'render',
      source,
      '--styling',
      'tailwind',
      '--tailwind-output',
      'styles',
      '--tailwind-dark-selector',
      '.dark &, [data-mode="dark"]',
      '--output-directory',
      outputDirectory
    );

    expect(process.exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(vi.mocked(console.error).mock.calls[0][0]).toContain(
      'error: --tailwind-dark-selector takes a selector'
    );
    expect(existsSync(outputDirectory)).toBe(false);
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

  it('reports each error of a failing template on its own line', async () => {
    const source = writeTemplate('pair.json', [
      { type: 'component', name: 'First', children: [] },
      { type: 'component', name: 'Second', children: [] },
    ]);

    await run(
      'render',
      source,
      '--output-directory',
      join(directory, 'output')
    );

    expect(process.exitCode).toBe(1);
    const lines = vi
      .mocked(console.error)
      .mock.calls.map(([line]) => String(line));
    expect(lines).toEqual([
      expect.stringMatching(
        /pair\.json: error: Component nodes are only allowed at the template root \(at \[0\]\)$/
      ),
      expect.stringMatching(
        /pair\.json: error: Component nodes are only allowed at the template root \(at \[1\]\)$/
      ),
    ]);
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

  it('reports each violation of a template on its own line', async () => {
    const source = writeTemplate('tabs.json', [
      {
        type: 'element',
        tag: 'div',
        events: [
          { name: 'keydown', handler: 'go', modifiers: ['home', 'end'] },
        ],
      },
    ]);

    await run('validate', source);

    expect(process.exitCode).toBe(1);
    const lines = vi
      .mocked(console.error)
      .mock.calls.map(([line]) => String(line));
    expect(lines).toEqual([
      expect.stringMatching(
        /tabs\.json: invalid - Unknown event modifier "home".* \(at \[0\]\.events\[0\]\.modifiers\[0\]\)$/
      ),
      expect.stringMatching(
        /tabs\.json: invalid - Unknown event modifier "end".* \(at \[0\]\.events\[0\]\.modifiers\[1\]\)$/
      ),
    ]);
  });

  it('reserves the names any target declares', async () => {
    const source = writeTemplate('field.json', {
      ...buttonTemplate,
      props: { useAttrs: { type: 'string' } },
    });

    await run('validate', source);

    expect(process.exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("The prop 'useAttrs' takes the name of")
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
