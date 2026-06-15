import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Command, InvalidArgumentError, Option } from 'commander';

import { renderCommand } from './commands/render';
import { validateCommand } from './commands/validate';
import { frameworkNames, stylingNames, type StylingName } from './extensions';

const outputStrategies = ['inline', 'in-file', 'separate-file'];

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
        '--framework <name>',
        'framework to render with; omitted renders HTML'
      ).choices(frameworkNames)
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
      new Option('--styling-strategy <strategy>', 'style output strategy')
        .choices(outputStrategies)
        .default('in-file')
    )
    .addOption(
      new Option('--styling-language <language>', 'stylesheet output language')
        .choices(['css', 'scss'])
        .default('css')
    )
    .addOption(
      new Option('--scripting-strategy <strategy>', 'script output strategy')
        .choices(outputStrategies)
        .default('in-file')
    )
    .addOption(
      new Option('--scripting-language <language>', 'script output language')
        .choices(['javascript', 'typescript'])
        .default('javascript')
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
        '--tailwind-output <output>',
        "what the Tailwind extension contributes: utility classes, or styles converted from them (default 'classes')"
      ).choices(['classes', 'styles'])
    )
    .option(
      '--tailwind-convert-styles',
      "convert each element's authored style into Tailwind utility classes"
    )
    .action(renderCommand);

  program
    .command('validate')
    .description('Validate a template file, or every template in a directory')
    .argument('<source>', 'template file or directory of template files')
    .action(validateCommand);

  return program;
}
