#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { TemplateEngine } from '@js-template-engine/core';
import {
  getSourcePathType,
  processFile,
  processDirectory,
} from '@js-template-engine/core';
import { createLogger } from '@js-template-engine/core';
import { TemplateExtension } from '@js-template-engine/core';
import { BemExtension } from '@js-template-engine/extension-bem';
import { ReactExtension } from '@js-template-engine/extension-react';
import { CliOptions, CliCommand } from './types/cli';

function loadExtensions(): Record<string, new (verbose?: boolean) => TemplateExtension> {
  return {
    bem: BemExtension,
    react: ReactExtension
  };
}

const availableExtensions = loadExtensions();

// Utility function for error handling and extension validation
function validateExtensions(
  requestedExtensions: string[],
  availableExtensions: Record<string, new (verbose?: boolean) => TemplateExtension>
): boolean {
  const missingExtensions = requestedExtensions.filter(
    (ext) => !availableExtensions[ext]
  );
  if (missingExtensions.length > 0) {
    console.error(
      'One or more specified extensions could not be loaded:',
      missingExtensions.join(', ')
    );
    return false;
  }
  return true;
}

const renderCommand: CliCommand = {
  command: 'render <sourcePath> [options]',
  describe: 'Render templates from JSON to HTML/JSX',
  builder: (yargs) => {
    return yargs
      .positional('sourcePath', {
        describe: 'Source file or directory containing JSON templates',
        type: 'string',
        demandOption: true,
      })
      .option('outputDir', {
        alias: 'o',
        describe: 'Output directory for rendered templates',
        type: 'string',
      })
      .option('extensions', {
        alias: 'e',
        describe: 'Extensions to use for template processing',
        type: 'array',
        default: [],
      })
      .option('name', {
        alias: 'n',
        describe: 'Base name for output files',
        type: 'string',
      })
      .option('componentName', {
        alias: 'c',
        describe: 'Component name for framework-specific templates',
        type: 'string',
      })
      .option('verbose', {
        alias: 'v',
        type: 'boolean',
        description: 'Run with verbose logging',
      })
      .option('extension', {
        describe: 'Extension type to use',
        type: 'string',
        choices: ['react', 'bem', 'none'],
        default: 'none',
      })
      .option('fileExtension', {
        describe: 'File extension for output files',
        type: 'string',
        choices: ['.html', '.jsx', '.tsx', '.css'],
        default: '.html',
      }) as any; // Type assertion needed due to yargs type limitations
  },
  handler: async (argv: CliOptions) => {
    const { verbose } = argv;
    const logger = createLogger(verbose, 'cli');
    logger.info('Starting template rendering process...');

    // Validate requested extensions before attempting to use them
    if (!validateExtensions(argv.extensions ?? [], availableExtensions)) {
      // Exit if validation fails
      return;
    }

    // Instantiate extensions with verbosity
    const extensions = (argv.extensions ?? []).map(
      (extension: string) => new availableExtensions[extension](verbose)
    );

    const { name } = argv;
    const sourcePath = path.join(process.cwd(), argv.sourcePath);
    const outputDir = argv.outputDir ?? '';
    const sourcePathType = await getSourcePathType(sourcePath);
    const templateEngine = new TemplateEngine();

    if (sourcePathType === 'directory') {
      await processDirectory(
        sourcePath,
        outputDir,
        extensions,
        templateEngine,
        verbose
      );
    } else if (sourcePathType === 'file') {
      await processFile(
        sourcePath,
        outputDir,
        extensions,
        templateEngine,
        name,
        undefined, // TODO: componentName is kind of React specific, probably shouldn't be an argument to processFile
        verbose
      );
    }
  },
};

yargs(hideBin(process.argv))
  .command(renderCommand)
  .demandCommand(1, 'You need at least one command before moving on')
  .help().argv; 