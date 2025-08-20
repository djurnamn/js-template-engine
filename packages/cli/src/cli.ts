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
import type { Extension } from '@js-template-engine/types';
import { BemExtension } from '@js-template-engine/extension-bem';
import { ReactExtension } from '@js-template-engine/extension-react';
import { VueExtension } from '@js-template-engine/extension-vue';
import { CliOptions, CliCommand } from './types/cli';

function loadExtensions(): Record<string, new (verbose?: boolean) => any> {
  return {
    bem: BemExtension,
    react: ReactExtension,
    vue: VueExtension
  };
}

const availableExtensions: Record<string, new (verbose?: boolean) => any> = loadExtensions();

// Utility function for error handling and extension validation
function validateExtensions(
  requestedExtensions: string[],
  availableExtensions: Record<string, new (verbose?: boolean) => any>
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

  // Check for potentially conflicting renderer extensions
  const rendererExtensions = requestedExtensions.filter(ext => 
    ['react', 'vue'].includes(ext)
  );
  
  if (rendererExtensions.length > 1) {
    console.warn(
      '⚠️  Multiple renderer extensions detected:',
      rendererExtensions.join(', ')
    );
    console.warn('   This may cause conflicts or unexpected output.');
    console.warn('   Consider using only one renderer extension at a time.');
    console.warn('   You can still proceed, but results may be unpredictable.\n');
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
        choices: ['react', 'vue', 'bem', 'none'],
        default: 'none',
      })
      .option('language', {
        describe: 'Programming language for output (determines file extensions automatically)',
        type: 'string',
        choices: ['typescript', 'javascript'],
        default: 'javascript',
      }) as any; // Type assertion needed due to yargs type limitations
  },
  handler: async (argv: CliOptions) => {
    const { verbose = false } = argv;
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
        argv.componentName,
        verbose
      );
    }
  },
};

yargs(hideBin(process.argv))
  .command(renderCommand)
  .demandCommand(1, 'You need at least one command before moving on')
  .help().argv; 