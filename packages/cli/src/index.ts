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
        // Enhanced error handling with actionable guidance
        if (error instanceof Error) {
          console.error('❌ Template rendering failed\n');
          
          // Check for common error types and provide specific guidance
          if (error.message.includes('ENOENT') || error.message.includes('no such file')) {
            console.error('📁 File not found');
            console.error(`   The template file '${argv.sourcePath}' does not exist.`);
            console.error('\n💡 Try:');
            console.error(`   • Check if the path is correct: ${argv.sourcePath}`);
            console.error('   • Make sure you\'re running from the correct directory');
            console.error('   • Use relative paths from your current directory\n');
          } else if (error.message.includes('JSON')) {
            console.error('📝 Invalid JSON in template file');
            console.error(`   The file '${argv.sourcePath}' contains invalid JSON.`);
            console.error('\n💡 Try:');
            console.error('   • Check for missing commas, brackets, or quotes');
            console.error('   • Use a JSON validator to check syntax');
            console.error('   • Ensure the file is properly formatted\n');
          } else if (error.message.includes('No valid extensions found')) {
            console.error('🔌 Extension configuration issue');
            console.error('   No valid extensions were found in your configuration.');
            console.error('\n💡 Try:');
            console.error(`   • Check your config file: ${argv.config}`);
            console.error('   • Ensure extensions are properly installed');
            console.error('   • Verify the config exports extensions correctly\n');
          } else if (error.message.includes('Template validation failed')) {
            console.error('🔍 Template validation error');
            console.error('   Your template contains structural issues.');
            console.error('\n💡 Try:');
            console.error('   • Check that all nodes have required properties');
            console.error('   • Ensure component names are PascalCase');
            console.error('   • Verify template structure matches expected format');
            console.error('   • Run with --verbose for detailed validation errors\n');
          } else {
            console.error('🚨 Unexpected error');
            console.error(`   ${error.message}\n`);
            console.error('💡 For help:');
            console.error('   • Run with --verbose for more details');
            console.error('   • Check the template format documentation');
            console.error('   • Report issues at: https://github.com/djurnamn/js-template-engine/issues\n');
          }
          
          if (argv.verbose && error.stack) {
            console.error('📋 Full error details:');
            console.error(error.stack);
          }
        } else {
          console.error('❌ An unexpected error occurred:', error);
          console.error('\n💡 Run with --verbose for more details');
        }
        
        process.exit(1);
      }
    }
  };

  return command;
}

export default run; 