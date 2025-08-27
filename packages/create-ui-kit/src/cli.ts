#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init';

const program = new Command();

program
  .name('create-ui-kit')
  .description(
    'Create framework-agnostic UI kits from a single source of truth'
  )
  .version('0.1.0')
  .addHelpText(
    'after',
    `
Examples:
  $ npx create-ui-kit init my-design-system     Create a new UI kit
  $ npx create-ui-kit init --help               Show detailed help

Learn more:
  📖 Documentation: https://docs.js-template-engine.dev/create-ui-kit
  🐛 Report issues: https://github.com/djurnamn/js-template-engine/issues
  💬 Discussions: https://github.com/djurnamn/js-template-engine/discussions
`
  );

// Add the init command
program.addCommand(initCommand);

program.parse();
