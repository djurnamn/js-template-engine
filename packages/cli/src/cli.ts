#!/usr/bin/env node

import { Command } from 'commander';
import {
  ProcessingPipeline,
  ExtensionRegistry,
} from '@js-template-engine/core';
import {
  loadExtensions,
  loadConfig,
  loadTemplate,
  writeOutput,
} from './loadExtensions';
import type {
  ProcessingOptions,
  FrameworkExtension,
  StylingExtension,
} from '@js-template-engine/core';

const program = new Command();

program
  .name('js-template-engine')
  .description('CLI for JS Template Engine')
  .version('2.0.0');

program
  .command('render')
  .description('Render templates from JSON files')
  .argument('<sourcePath>', 'Path to source JSON file or directory')
  .option('-c, --config <path>', 'Path to config file', './template.config')
  .option('-o, --output-dir <path>', 'Output directory')
  .option('-n, --name <name>', 'Base name for output files')
  .option('-l, --language <lang>', 'Output language', 'javascript')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (sourcePath: string, options: any) => {
    try {
      // Load configuration
      const config = await loadConfig(options.config);

      // Create extension registry
      const registry = new ExtensionRegistry();

      // Load and register extensions
      const extensions = await loadExtensions(config);
      extensions.forEach((extension) => {
        if (extension.metadata.type === 'framework') {
          registry.registerFramework(extension as FrameworkExtension);
        } else if (extension.metadata.type === 'styling') {
          registry.registerStyling(extension as StylingExtension);
        }
      });

      // Create pipeline
      const pipeline = new ProcessingPipeline(registry);

      // Process template
      const template = await loadTemplate(sourcePath);
      const processingOptions: ProcessingOptions = {
        framework: config.framework,
        extensions: config.extensions,
        component: {
          name: options.name || 'Component',
        },
      };

      const result = await pipeline.process(template, processingOptions);

      // Handle output
      await writeOutput(result, options);

      console.log(`✅ Template rendering complete!`);
    } catch (error) {
      console.error(
        '❌ Template rendering failed:',
        error instanceof Error ? error.message : error
      );
      if (options.verbose && error instanceof Error && error.stack) {
        console.error('Full error:', error.stack);
      }
      process.exit(1);
    }
  });

program.parse();
