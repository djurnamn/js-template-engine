import { Command } from 'commander';
import enquirer from 'enquirer';
const { prompt } = enquirer;
import path from 'path';
import fs from 'fs-extra';
import { InitOptions, FrameworkOption, StylingOption } from '../types';
import { createProjectStructure } from '../utilities';
import { validateProjectName } from '../validation';

const frameworkOptions: FrameworkOption[] = [
  { name: 'React', value: 'react', description: 'React components with JSX' },
  { name: 'Vue', value: 'vue', description: 'Vue single file components' },
];

const stylingOptions: StylingOption[] = [
  {
    name: 'CSS (separate files)',
    value: 'css',
    description: 'Generate separate .css files (BEM optional)',
  },
  {
    name: 'SCSS (separate files)',
    value: 'scss',
    description: 'Generate .scss files with nesting (BEM optional)',
  },
  {
    name: 'Inline styles',
    value: 'inline',
    description: 'Styles directly in component attributes',
  },
];

export class InitCommand {
  async execute(options: {
    name: string;
    description?: string;
    author?: string;
    frameworks: string[];
    styling: string[];
    typescript: boolean;
    outputDir: string;
  }): Promise<void> {
    const targetDir = path.resolve(options.outputDir, options.name);

    // Validate project name
    const nameValidation = validateProjectName(options.name);
    if (nameValidation !== true) {
      throw new Error(nameValidation);
    }

    const initOptions: InitOptions = {
      projectName: options.name,
      frameworks: options.frameworks,
      styling: options.styling,
      typescript: options.typescript,
      targetDir,
    };

    // Create project structure
    await createProjectStructure(initOptions);
  }
}

export const initCommand = new Command('init')
  .description('Initialize a new UI kit project with interactive setup')
  .argument(
    '[project-name]',
    'Name of the UI kit project (kebab-case, e.g., "my-design-system")'
  )
  .option(
    '-d, --dir <directory>',
    'Target directory for project creation (default: current directory)',
    process.cwd()
  )
  .addHelpText(
    'before',
    `
🎨 Create UI Kit - Project Initialization

This command creates a complete UI kit project with:
  • Sample components (button, navigation)  
  • Multi-framework build configuration (React, Vue)
  • Consumer CLI for end users
  • Documentation generation
  • Testing setup with comprehensive examples
`
  )
  .addHelpText(
    'after',
    `
Examples:
  $ npx create-ui-kit init                      # Interactive setup
  $ npx create-ui-kit init my-design-system     # Create "my-design-system" project
  $ npx create-ui-kit init --dir ./projects     # Create in specific directory

Project Structure Created:
  my-design-system/
  ├── src/
  │   ├── components/           # Component templates (JSON)
  │   ├── cli.ts               # Consumer CLI script  
  │   └── utilities/           # Build and documentation tools
  ├── dist/                    # Generated components
  ├── create-ui-kit.config.js  # Capabilities configuration
  ├── package.json             # NPM package with CLI script
  └── README.md               # Auto-generated documentation

After creation:
  1. cd my-design-system
  2. pnpm install              # Install dependencies
  3. pnpm build               # Generate components
  4. npm publish              # Publish to NPM (when ready)

Learn more: https://docs.js-template-engine.dev/create-ui-kit
`
  )
  .action(async (projectName?: string, options?: { dir?: string }) => {
    console.log('🎨 Welcome to Create UI Kit!\n');

    try {
      // Get project name
      if (!projectName) {
        const nameResponse = await prompt<{ projectName: string }>({
          type: 'input',
          name: 'projectName',
          message: 'What is your UI kit called?',
          initial: 'my-design-system',
          validate: validateProjectName,
        });
        projectName = nameResponse.projectName;
      }

      // Validate project name
      const nameValidation = validateProjectName(projectName);
      if (nameValidation !== true) {
        console.error(`❌ ${nameValidation}`);
        process.exit(1);
      }

      // Determine target directory - project will be created inside the specified/current directory
      const parentDir = options?.dir || process.cwd();
      const targetDir = path.resolve(parentDir, projectName);

      // Only check if the specific project directory exists and isn't empty
      if (await fs.pathExists(targetDir)) {
        const files = await fs.readdir(targetDir);
        if (files.length > 0) {
          const overwriteResponse = await prompt<{ overwrite: boolean }>({
            type: 'confirm',
            name: 'overwrite',
            message: `Directory ${projectName} already exists and is not empty. Continue anyway?`,
            initial: false,
          });

          if (!overwriteResponse.overwrite) {
            console.log('❌ Operation cancelled');
            process.exit(1);
          }
        }
      }

      // Framework selection
      const frameworkResponse = await prompt<{ frameworks: string[] }>({
        type: 'multiselect',
        name: 'frameworks',
        message: 'Which frameworks do you want to support?',
        choices: frameworkOptions.map((fw) => ({
          name: fw.value,
          message: `${fw.name} - ${fw.description}`,
          enabled: fw.value === 'react', // Default to React
        })),
        validate: (value: any) =>
          Array.isArray(value) && value.length > 0
            ? true
            : 'Please select at least one framework',
      });

      // Filter styling options based on selected frameworks
      const availableStyling = stylingOptions.filter(
        (style) =>
          !style.frameworks ||
          style.frameworks.some((fw) =>
            frameworkResponse.frameworks.includes(fw)
          )
      );

      // Styling selection
      const stylingResponse = await prompt<{ styling: string[] }>({
        type: 'multiselect',
        name: 'styling',
        message: 'Which styling approaches do you want to support?',
        choices: availableStyling.map((style) => ({
          name: style.value,
          message: `${style.name} - ${style.description}`,
          enabled: style.value === 'css', // Default to CSS
        })),
        validate: (value: any) =>
          Array.isArray(value) && value.length > 0
            ? true
            : 'Please select at least one styling approach',
      });

      // BEM methodology support (only if CSS or SCSS is selected)
      let bemEnabled = false;
      if (
        stylingResponse.styling.includes('css') ||
        stylingResponse.styling.includes('scss')
      ) {
        const bemResponse = await prompt<{ bem: boolean }>({
          type: 'confirm',
          name: 'bem',
          message: 'Enable BEM class naming methodology?',
          initial: false,
        });
        bemEnabled = bemResponse.bem;
      }

      // Example components
      const examplesResponse = await prompt<{ includeExamples: boolean }>({
        type: 'confirm',
        name: 'includeExamples',
        message: 'Include example components (button, navigation)?',
        initial: true,
      });

      // TypeScript support
      const typescriptResponse = await prompt<{ typescript: boolean }>({
        type: 'confirm',
        name: 'typescript',
        message: 'Do you want TypeScript support?',
        initial: true,
      });

      // Add BEM to styling options if enabled
      const finalStyling = [...stylingResponse.styling];
      if (bemEnabled) {
        finalStyling.push('bem');
      }

      const initOptions: InitOptions = {
        projectName,
        frameworks: frameworkResponse.frameworks,
        styling: finalStyling,
        typescript: typescriptResponse.typescript,
        includeExamples: examplesResponse.includeExamples,
        targetDir,
      };

      console.log('\n🚀 Creating your UI kit...\n');

      // Create project structure
      await createProjectStructure(initOptions);

      console.log('✅ UI kit created successfully!\n');
      console.log('Next steps:');
      console.log(`  cd ${path.relative(process.cwd(), targetDir)}`);
      console.log('  pnpm install');
      console.log('  pnpm build');
      console.log('\n📚 Check the README.md for more information.');
    } catch (error) {
      console.error('\n❌ Failed to create UI kit\n');

      if (error instanceof Error) {
        // Provide specific guidance based on error type
        if (
          error.message.includes('EACCES') ||
          error.message.includes('permission denied')
        ) {
          console.error('🔐 Permission error');
          console.error(
            "   You don't have permission to create files in this location."
          );
          console.error('\n💡 Try:');
          console.error(
            '   • Use sudo (if appropriate): sudo npx create-ui-kit init'
          );
          console.error(
            '   • Choose a different directory where you have write access'
          );
          console.error('   • Check directory permissions\n');
        } else if (error.message.includes('ENOSPC')) {
          console.error('💾 Disk space error');
          console.error('   Not enough disk space to create the UI kit.');
          console.error('\n💡 Try:');
          console.error('   • Free up some disk space');
          console.error('   • Choose a different location with more space\n');
        } else if (error.message.includes('ENOTDIR')) {
          console.error('📁 Directory error');
          console.error('   The target path exists but is not a directory.');
          console.error('\n💡 Try:');
          console.error('   • Choose a different project name');
          console.error('   • Remove the existing file with the same name\n');
        } else if (error.message.includes('Project name')) {
          console.error('📝 Invalid project name');
          console.error(`   ${error.message}`);
          console.error('\n💡 Try:');
          console.error(
            '   • Use only lowercase letters, numbers, hyphens, and underscores'
          );
          console.error('   • Start and end with alphanumeric characters');
          console.error('   • Keep the name between 2-214 characters');
          console.error(
            '   • Avoid reserved names like "package.json" or "node_modules"\n'
          );
        } else if (
          error.message.includes('frameworks') ||
          error.message.includes('styling')
        ) {
          console.error('⚙️  Configuration error');
          console.error('   Invalid framework or styling selection.');
          console.error('\n💡 Try:');
          console.error('   • Select at least one framework');
          console.error('   • Choose compatible styling options');
          console.error('   • Check that all selections are valid\n');
        } else {
          console.error('🚨 Unexpected error');
          console.error(`   ${error.message}\n`);
          console.error('💡 For help:');
          console.error('   • Try running the command again');
          console.error('   • Check file permissions in the target directory');
          console.error(
            '   • Report issues at: https://github.com/djurnamn/js-template-engine/issues\n'
          );
        }

        // Show stack trace in verbose mode or for development
        if (process.env.NODE_ENV === 'development' && error.stack) {
          console.error('📋 Full error details:');
          console.error(error.stack);
        }
      } else {
        console.error('❌ An unexpected error occurred:', error);
      }

      process.exit(1);
    }
  });
