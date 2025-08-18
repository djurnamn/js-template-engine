#!/usr/bin/env node

import { loadExtensions } from './loadExtensions';
import { TemplateEngine } from '@js-template-engine/core';
import type { Extension } from '@js-template-engine/types';
import { CliCommand, CliOptions } from './types/cli';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Argv } from 'yargs';

async function run() {
  const command: CliCommand = {
    command: 'render <sourcePath>',
    describe: 'Render templates from JSON files',
    builder: (yargs: Argv<{}>): Argv<CliOptions> => {
      return yargs
        .positional('sourcePath', {
          describe: 'Path to the source JSON file or directory',
          type: 'string',
          demandOption: true
        })
        .option('config', {
          describe: 'Path to template config file',
          type: 'string',
          default: './template.config'
        })
        .option('outputDir', {
          alias: 'o',
          describe: 'Output directory for rendered templates',
          type: 'string'
        })
        .option('name', {
          alias: 'n',
          describe: 'Base name for output files',
          type: 'string'
        })
        .option('language', {
          describe: 'Programming language for output (determines file extensions automatically)',
          type: 'string',
          choices: ['typescript', 'javascript'],
          default: 'javascript'
        })
        .option('verbose', {
          alias: 'v',
          describe: 'Enable verbose logging',
          type: 'boolean',
          default: false
        }) as Argv<CliOptions>;
    },
    handler: async (argv) => {
      try {
        // Load extensions
        const extensions = await loadExtensions(argv.config);
        if (extensions.length === 0) {
          console.error('No valid extensions found');
          process.exit(1);
        }

        // Initialize template engine
        const templateEngine = new TemplateEngine(extensions as Extension[]);

        // Read and parse the template file
        const templatePath = join(process.cwd(), argv.sourcePath);
        const templateContent = readFileSync(templatePath, 'utf-8');
        const template = JSON.parse(templateContent);

        await templateEngine.render(template, {
          name: argv.name,
          outputDir: argv.outputDir,
          language: argv.language,
          verbose: argv.verbose
        });
      } catch (error) {
        console.error('Error rendering template:', error);
        process.exit(1);
      }
    }
  };

  return command;
}

export default run; 