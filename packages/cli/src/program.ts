import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { svelteModes } from '@js-template-engine/extension-svelte';
import { Command, InvalidArgumentError, Option } from 'commander';

import { renderCommand } from './commands/render';
import { validateCommand } from './commands/validate';
import { stylingNames, targetNames, type StylingName } from './extensions';

const stylesheetPlacements = ['inline', 'in-file', 'separate-file'];
const stylesheetLinks = ['component', 'none'];

/**
 * Parses the `--styling` value: a comma-separated list of styling
 * extension names, kept in the order given.
 *
 * @param value - The raw flag value, e.g. `'bem,tailwind'`.
 * @returns The styling extension names.
 */
export function parseStylingList(value: string): StylingName[] {
  const names = value
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  for (const name of names) {
    if (!(stylingNames as readonly string[]).includes(name)) {
      throw new InvalidArgumentError(
        `Unknown styling extension '${name}'. Allowed choices are ${stylingNames.join(', ')}.`
      );
    }
  }
  return names as StylingName[];
}

/**
 * Parses the `--styling-layer-order` value: a comma-separated list of
 * cascade-layer names, kept in the order given.
 *
 * @param value - The raw flag value, e.g. `'kit.reset,kit.components'`.
 * @returns The layer names.
 */
export function parseLayerOrder(value: string): string[] {
  return value
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

/**
 * Collects a repeatable option's values into an array, preserving order.
 * Used for `--load-path`, which may be given more than once.
 *
 * @param value - One occurrence's value.
 * @param previous - The values accumulated so far.
 * @returns The accumulated values including this one.
 */
export function collectRepeated(value: string, previous: string[]): string[] {
  return [...previous, value];
}

/**
 * Creates the `js-template-engine` command-line program.
 *
 * @returns The configured program; call `parseAsync` to run it.
 */
export function createProgram(): Command {
  const { version } = JSON.parse(
    readFileSync(join(__dirname, '..', 'package.json'), 'utf8')
  ) as { version: string };

  const program = new Command();
  program
    .name('js-template-engine')
    .description(
      'Render data-defined component templates to HTML, React, Vue, or Svelte'
    )
    .version(version);

  program
    .command('render')
    .description(
      'Render a template file, or every template in a directory, to output files'
    )
    .argument('<source>', 'template file or directory of template files')
    .addOption(
      new Option(
        '--target <name>',
        "target to render to; html is annotated HTML and CSS (default 'html')"
      ).choices(targetNames)
    )
    .addOption(
      new Option('--framework <name>', 'deprecated alias of --target')
        .choices(targetNames.filter((name) => name !== 'html'))
        .hideHelp()
    )
    .option(
      '--styling <names>',
      `comma-separated styling extensions (${stylingNames.join(', ')}), applied in order`,
      parseStylingList,
      [] as StylingName[]
    )
    .option(
      '-o, --output-directory <path>',
      'directory generated files are written to',
      './output'
    )
    .option(
      '-n, --component-name <name>',
      'component name for templates that declare none; defaults to the source filename in PascalCase'
    )
    .addOption(
      new Option(
        '--stylesheet-placement <placement>',
        "where the component's styles go: inline style attributes, a style block in the component, or a stylesheet file of its own (default 'in-file')"
      ).choices(stylesheetPlacements)
    )
    .addOption(
      new Option(
        '--styling-strategy <placement>',
        'deprecated alias of --stylesheet-placement'
      )
        .choices(stylesheetPlacements)
        .hideHelp()
    )
    .addOption(
      new Option('--styling-language <language>', 'stylesheet output language')
        .choices(['css', 'scss'])
        .default('css')
    )
    .addOption(
      new Option(
        '--stylesheet-link <mode>',
        "whether the component links the stylesheet emitted by --stylesheet-placement separate-file; 'none' emits it unlinked"
      )
        .choices(stylesheetLinks)
        .default('component')
    )
    .option(
      '--styling-layer <name>',
      'cascade layer emitted stylesheet rules are wrapped in; omitted emits them unlayered'
    )
    .option(
      '--styling-layer-order <names>',
      'comma-separated cascade layer order declared ahead of the wrapper, e.g. kit.reset,kit.components',
      parseLayerOrder,
      [] as string[]
    )
    .option(
      '--load-path <path>',
      'sass load-path directory for resolving @use/@include under styling-language css (repeatable)',
      collectRepeated,
      [] as string[]
    )
    .addOption(
      new Option(
        '--scripting-strategy <strategy>',
        'deprecated, has no effect: no output contains a script'
      ).choices(stylesheetPlacements)
    )
    .addOption(
      new Option(
        '--scripting-language <language>',
        'deprecated, has no effect: no output contains a script'
      ).choices(['javascript', 'typescript'])
    )
    .option(
      '--bem-element-separator <separator>',
      "separator between BEM block and element (default '__')"
    )
    .option(
      '--bem-modifier-separator <separator>',
      "separator before a BEM modifier (default '--')"
    )
    .addOption(
      new Option(
        '--bem-mode <mode>',
        "how BEM classes are rendered: literal class strings, or use-bem bem(...) calls for the react, vue and svelte targets (default 'literal')"
      ).choices(['literal', 'runtime'])
    )
    .option(
      '--bem-import-source <package>',
      "package the use-bem helper is imported from in runtime mode (default 'use-bem')"
    )
    .addOption(
      new Option(
        '--tailwind-output <output>',
        "what the Tailwind extension contributes: utility classes, or styles converted from them (default 'classes')"
      ).choices(['classes', 'styles'])
    )
    .option(
      '--tailwind-dark-selector <selector>',
      "with --tailwind-output styles, the selector dark: utilities follow instead of prefers-color-scheme, such as ':root[data-mode=\"dark\"] &' or '.dark'"
    )
    .option(
      '--tailwind-convert-styles',
      "convert each element's authored style into Tailwind utility classes"
    )
    .addOption(
      new Option(
        '--svelte-mode <mode>',
        "how the Svelte target emits: classic component syntax, or Svelte 5 runes components with $props() and snippets (default 'legacy')"
      ).choices(svelteModes)
    )
    .action(renderCommand);

  program
    .command('validate')
    .description('Validate a template file, or every template in a directory')
    .argument('<source>', 'template file or directory of template files')
    .action(validateCommand);

  return program;
}
