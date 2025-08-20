import fs from 'fs-extra';
import path from 'path';
import { InitOptions, UIKitConfig } from '../types';
import { ConfigValidator } from '../validation/config';
import { FileSystemUtils } from './file-system';
import { DependencyValidator } from '../validation/dependency';

export async function createProjectStructure(
  options: InitOptions
): Promise<void> {
  const { projectName, frameworks, styling, typescript, targetDir } = options;

  if (!targetDir) {
    throw new Error('Target directory is required');
  }

  // Ensure target directory exists
  await fs.ensureDir(targetDir);

  // Create directory structure
  await createDirectories(targetDir);

  // Create configuration file
  await createConfigFile(targetDir, options);

  // Create package.json
  await createPackageJson(targetDir, options);

  // Create example components (optional)
  if (options.includeExamples !== false) {
    await createExampleComponents(targetDir, options);
  }

  // Create build scripts
  await createBuildScripts(targetDir, options);

  // Create documentation scripts
  await createDocumentationScript(targetDir, options);

  // Create consumer CLI
  await createConsumerCli(targetDir, options);

  // Copy documentation generator
  await copyDocumentationGenerator(targetDir);

  // Create README
  await createReadme(targetDir, options);

  // Create TypeScript config if needed
  if (typescript) {
    await createTsConfig(targetDir);
  }

  // Validate dependencies and provide guidance
  await validateDependencies(targetDir, options);
}

async function createDirectories(targetDir: string): Promise<void> {
  const dirs = ['src/components', 'src', 'dist', 'scripts'];

  for (const dir of dirs) {
    const fullPath = path.join(targetDir, dir);
    const result = await FileSystemUtils.ensureDirSafe(fullPath, {
      retries: 3,
    });

    if (!result.success) {
      const errorDetails = FileSystemUtils.getErrorDetails(result.error!);
      const message = `Failed to create directory ${dir}: ${errorDetails.message}`;
      const suggestions =
        errorDetails.suggestions.length > 0
          ? `\n\nSuggestions:\n${errorDetails.suggestions
              .map((s) => `• ${s}`)
              .join('\n')}`
          : '';
      throw new Error(message + suggestions);
    }
  }
}

async function createConfigFile(
  targetDir: string,
  options: InitOptions
): Promise<void> {
  const config: UIKitConfig = {
    name: options.projectName,
    version: '0.1.0',
    capabilities: {
      frameworks: options.frameworks,
      styling: options.styling,
      typescript: options.typescript,
    },
    components: {
      // Will be populated as components are added
    },
    conflictResolution: {
      default: 'prompt',
      allowDiff: true,
      allowMerge: true,
      createBackups: true,
    },
  };

  // Validate the configuration before writing
  try {
    ConfigValidator.validateOrThrow(config, 'create-ui-kit.config.js');
  } catch (error) {
    throw new Error(
      `Generated configuration is invalid: ${
        error instanceof Error ? error.message : error
      }`
    );
  }

  const configContent = `// UI Kit Configuration
export default ${JSON.stringify(config, null, 2)};
`;

  const configPath = path.join(targetDir, 'create-ui-kit.config.js');
  const result = await FileSystemUtils.writeFileSafe(
    configPath,
    configContent,
    {
      retries: 3,
      createBackup: false,
      overwrite: true,
    }
  );

  if (!result.success) {
    const errorDetails = FileSystemUtils.getErrorDetails(result.error!);
    const message = `Failed to create configuration file: ${errorDetails.message}`;
    const suggestions =
      errorDetails.suggestions.length > 0
        ? `\n\nSuggestions:\n${errorDetails.suggestions
            .map((s) => `• ${s}`)
            .join('\n')}`
        : '';
    throw new Error(message + suggestions);
  }
}

async function createPackageJson(
  targetDir: string,
  options: InitOptions
): Promise<void> {
  const packageJson = {
    name: options.projectName,
    version: '0.1.0',
    description: `A UI kit built with create-ui-kit`,
    type: 'module',
    main: 'dist/index.js',
    bin: {
      [options.projectName]: 'dist/cli.js',
    },
    scripts: {
      build: 'tsc && node scripts/build.js && node scripts/generate-docs.js',
      'build:cli': 'tsc',
      'build:docs': 'node scripts/generate-docs.js',
      dev: 'node scripts/build.js --watch',
      clean: 'rimraf dist',
      prepublishOnly: 'pnpm build',
    },
    keywords: [
      'ui-kit',
      'component-library',
      ...options.frameworks,
      ...options.styling,
    ],
    dependencies: {
      '@js-template-engine/core': '^1.0.0',
      '@js-template-engine/extension-react': '^1.0.0',
      '@js-template-engine/extension-vue': '^1.0.0',
      '@js-template-engine/extension-bem': '^1.0.0',
      '@js-template-engine/types': '^1.0.0',
      commander: '^12.0.0',
      enquirer: '^2.4.1',
      'fs-extra': '^11.2.0',
    },
    devDependencies: {
      rimraf: '^5.0.0',
      ...(options.typescript
        ? {
            typescript: '^5.0.0',
            '@types/node': '^20.0.0',
            '@types/fs-extra': '^11.0.4',
          }
        : {}),
    },
    files: ['dist', 'src', 'create-ui-kit.config.js', 'README.md'],
  };

  await fs.writeFile(
    path.join(targetDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
}

async function createExampleComponents(
  targetDir: string,
  options: InitOptions
): Promise<void> {
  // Copy example components from our templates
  const componentsDir = path.join(targetDir, 'src/components');

  // Copy existing template files from the package
  const templateDir = path.join(__dirname, '../../src');
  const templateFiles = ['button.json', 'navigation.json'];

  for (const templateFile of templateFiles) {
    const sourcePath = path.join(templateDir, templateFile);
    const targetPath = path.join(componentsDir, templateFile);

    if (await fs.pathExists(sourcePath)) {
      await fs.copy(sourcePath, targetPath);
    }
  }

  // If no template files were found, create a basic button component
  if (!(await fs.pathExists(path.join(componentsDir, 'button.json')))) {
    const buttonComponent = {
      component: {
        name: 'Button',
        props: {
          children: 'React.ReactNode',
          onClick: '() => void',
          variant: '"primary" | "secondary"',
        },
      },
      template: [
        {
          tag: 'button',
          attributes: {
            type: 'button',
          },
          children: [
            {
              type: 'text',
              content: 'Button Text',
            },
          ],
          extensions: {
            react: {
              expressionAttributes: {
                onClick: 'props.onClick',
                className:
                  'props.variant === "primary" ? "btn btn-primary" : "btn btn-secondary"',
              },
            },
            vue: {
              expressionAttributes: {
                '@click': 'onClick',
                ':class': '`btn btn-${variant}`',
              },
            },
            bem: {
              block: 'button',
              modifiers: ['{{variant}}'],
            },
          },
        },
      ],
    };

    await fs.writeFile(
      path.join(componentsDir, 'button.json'),
      JSON.stringify(buttonComponent, null, 2)
    );
  }
}

async function createBuildScripts(
  targetDir: string,
  options: InitOptions
): Promise<void> {
  const buildScript = `import { TemplateEngine } from '@js-template-engine/core';
import { ReactExtension } from '@js-template-engine/extension-react';
import { VueExtension } from '@js-template-engine/extension-vue';
import { BemExtension } from '@js-template-engine/extension-bem';
import fs from 'fs-extra';
import path from 'path';
import config from '../create-ui-kit.config.js';

async function build() {
  console.log('🏗️  Building UI kit...');
  
  // Clear only component build directories (preserve TypeScript compiled files)
  const componentDirs = ['react', 'vue'];
  for (const dir of componentDirs) {
    const dirPath = path.join('dist', dir);
    if (await fs.pathExists(dirPath)) {
      await fs.emptyDir(dirPath);
    }
  }
  
  // Build for each framework
  for (const framework of config.capabilities.frameworks) {
    console.log(\`📦 Building \${framework} components...\`);
    
    const extensions = [];
    
    // Add styling extensions first
    if (config.capabilities.styling.includes('bem')) {
      extensions.push(new BemExtension());
    }
    
    // Add framework extension last to handle transformations after styling
    if (framework === 'react') {
      extensions.push(new ReactExtension());
    } else if (framework === 'vue') {
      extensions.push(new VueExtension());
    }
    
    const engine = new TemplateEngine(extensions);
    
    // Process each component
    const componentsDir = 'src/components';
    const files = await fs.readdir(componentsDir);
    
    for (const file of files) {
      if (file.endsWith('.json') || file.endsWith('.js')) {
        const componentPath = path.join(componentsDir, file);
        const componentName = path.basename(file, path.extname(file));
        
        let template;
        if (file.endsWith('.json')) {
          template = await fs.readJson(componentPath);
        } else {
          const module = await import(path.resolve(componentPath));
          template = module.default || module;
        }
        
        await engine.render(template, {
          name: componentName,
          outputDir: \`dist/\${framework}\`,
          language: config.capabilities.typescript ? 'typescript' : 'javascript',
          writeOutputFile: true,
          extensions,
        });
      }
    }
  }
  
  console.log('✅ Build complete!');
}

// Run build if this script is executed directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  build().catch(console.error);
}

export { build };
`;

  await fs.writeFile(path.join(targetDir, 'scripts/build.js'), buildScript);
}

async function createDocumentationScript(
  targetDir: string,
  options: InitOptions
): Promise<void> {
  const docScript = `import path from 'path';
import fs from 'fs-extra';

async function generateDocs() {
  console.log('📚 Generating documentation...');
  
  try {
    // Check if documentation utilities are available
    const utilsPath = path.resolve('dist/utilities/documentation.js');
    if (!(await fs.pathExists(utilsPath))) {
      console.log('⚠️  Documentation utilities not found, skipping documentation generation');
      console.log('   This is normal during development. Documentation will be available after publishing to NPM.');
      return;
    }
    
    // Dynamic import to handle missing dependencies gracefully
    const { DocumentationGenerator } = await import('../dist/utilities/documentation.js');
    const generator = new DocumentationGenerator();
    const configPath = path.resolve('create-ui-kit.config.js');
    const componentsDir = path.resolve('src/components');
    
    await generator.generateDocumentation(componentsDir, configPath);
    console.log('✅ Documentation generated successfully!');
  } catch (error) {
    console.log('⚠️  Could not generate documentation:', error.message);
    console.log('   This is normal during development. Documentation will be available after publishing to NPM.');
  }
}

generateDocs().catch(console.error);
`;

  await fs.writeFile(
    path.join(targetDir, 'scripts/generate-docs.js'),
    docScript
  );
}

async function createReadme(
  targetDir: string,
  options: InitOptions
): Promise<void> {
  const frameworkList = options.frameworks.map((fw) => `- ${fw}`).join('\n');
  const stylingList = options.styling.map((style) => `- ${style}`).join('\n');

  const content = `# ${options.projectName}

A UI kit built with [create-ui-kit](https://github.com/djurnamn/js-template-engine).

## Supported Frameworks
${frameworkList}

## Supported Styling
${stylingList}

## Installation

\`\`\`bash
npm install ${options.projectName}
\`\`\`

## Usage

### As Pre-built Components

\`\`\`jsx
import { Button } from '${options.projectName}/react';
import '${options.projectName}/styles.css';

function App() {
  return <Button variant="primary">Click me</Button>;
}
\`\`\`

### As Copy-Paste Components

\`\`\`bash
npx ${options.projectName} add button --framework react --styling css
\`\`\`

## Development

\`\`\`bash
# Install dependencies
pnpm install

# Build all framework variants
pnpm build

# Watch for changes
pnpm dev
\`\`\`

## Adding Components

Create new component templates in \`src/components/\` directory. See existing components for examples.

## Publishing

\`\`\`bash
# Build and publish to npm
pnpm build
npm publish
\`\`\`
`;

  await fs.writeFile(path.join(targetDir, 'README.md'), content);
}

async function createConsumerCli(
  targetDir: string,
  options: InitOptions
): Promise<void> {
  // Generate extension imports
  const extensionImports = options.frameworks
    .map((framework) => {
      const className =
        framework === 'react'
          ? 'ReactExtension'
          : framework === 'vue'
          ? 'VueExtension'
          : `${
              framework.charAt(0).toUpperCase() + framework.slice(1)
            }Extension`;
      return `import { ${className} } from '@js-template-engine/extension-${framework}';`;
    })
    .join('\n');

  // Generate extension initialization
  const extensionInit = options.frameworks
    .map((framework) => {
      const className =
        framework === 'react'
          ? 'ReactExtension'
          : framework === 'vue'
          ? 'VueExtension'
          : `${
              framework.charAt(0).toUpperCase() + framework.slice(1)
            }Extension`;
      return `      if (framework === '${framework}') {
        extensions.push(new ${className}(true));
      }`;
    })
    .join('\n');

  const cliContent = `#!/usr/bin/env node

import { Command } from 'commander';
import enquirer from 'enquirer';
const { prompt } = enquirer;
import fs from 'fs-extra';
import path from 'path';
import { TemplateEngine } from '@js-template-engine/core';
${extensionImports}
// @ts-ignore
import config from '../create-ui-kit.config.js';

const program = new Command();

interface ComponentChoice {
  name: string;
  message: string;
  enabled?: boolean;
}

interface AddOptions {
  framework?: string;
  styling?: string;
  typescript?: boolean;
  outputDir?: string;
}

// Get available components based on user's framework/styling choices
async function getAvailableComponents(framework: string, styling: string): Promise<ComponentChoice[]> {
  const components: ComponentChoice[] = [];
  const componentsDir = path.join(__dirname, '..', 'src', 'components');
  
  try {
    // Scan for component files in the filesystem
    const files = await fs.readdir(componentsDir);
    
    for (const file of files) {
      if (file.endsWith('.json') || file.endsWith('.js') || file.endsWith('.ts')) {
        const componentName = path.basename(file, path.extname(file));
        const componentPath = path.join(componentsDir, file);
        
        try {
          // Load component template to check its extensions
          let template;
          if (file.endsWith('.json')) {
            template = await fs.readJson(componentPath);
          } else {
            const module = await import(path.resolve(componentPath));
            template = module.default || module;
          }
          
          // Check if component supports the selected framework and styling
          const supportsFramework = checkComponentSupportsCapability(template, 'framework', framework);
          const supportsStyling = checkComponentSupportsCapability(template, 'styling', styling);
          
          if (supportsFramework && supportsStyling) {
            components.push({
              name: componentName,
              message: \`\${componentName.charAt(0).toUpperCase() + componentName.slice(1)}\`,
              enabled: false
            });
          }
        } catch (error) {
          console.warn(\`Warning: Could not load component \${componentName}:\`, error.message);
        }
      }
    }
  } catch (error) {
    console.warn('Warning: Could not scan components directory:', error.message);
  }
  
  return components;
}

// Helper function to check if a component template supports a specific capability
function checkComponentSupportsCapability(template: any, capabilityType: 'framework' | 'styling', value: string): boolean {
  if (!template?.template) return false;
  
  // Recursively check all template nodes for extensions
  function hasExtension(nodes: any[]): boolean {
    for (const node of nodes) {
      if (node.extensions) {
        if (capabilityType === 'framework') {
          // Check for framework extensions (react, vue, etc.)
          if (node.extensions[value]) {
            return true;
          }
        } else if (capabilityType === 'styling') {
          // Check for styling extensions (bem, styled-components, etc.)
          if (value === 'bem' && node.extensions.bem) {
            return true;
          }
          // For css/scss/inline, components are generally compatible
          if (['css', 'scss', 'inline'].includes(value)) {
            return true;
          }
        }
      }
      
      // Recursively check children
      if (node.children && Array.isArray(node.children)) {
        if (hasExtension(node.children)) {
          return true;
        }
      }
      
      // Check conditional branches
      if (node.then && Array.isArray(node.then) && hasExtension(node.then)) {
        return true;
      }
      if (node.else && Array.isArray(node.else) && hasExtension(node.else)) {
        return true;
      }
    }
    return false;
  }
  
  return hasExtension(Array.isArray(template.template) ? template.template : [template.template]);
}

// Check if file exists and handle conflicts
async function handleFileConflict(filePath: string, newContent: string): Promise<boolean> {
  if (!await fs.pathExists(filePath)) {
    return true; // No conflict, proceed
  }
  
  const conflictBehavior = config.conflictResolution?.default || 'prompt';
  
  if (conflictBehavior === 'overwrite') {
    return true;
  }
  
  if (conflictBehavior === 'skip') {
    console.log(\`⚠️  Skipping \${filePath} (already exists)\`);
    return false;
  }
  
  // Prompt user for decision
  const choices = ['overwrite', 'skip'];
  if (config.conflictResolution?.allowDiff) {
    choices.unshift('diff');
  }
  if (config.conflictResolution?.createBackups) {
    choices.push('backup');
  }
  
  const response = await prompt<{ action: string }>({
    type: 'select',
    name: 'action',
    message: \`File \${path.relative(process.cwd(), filePath)} already exists. What would you like to do?\`,
    choices: choices.map(choice => ({
      name: choice,
      message: choice === 'diff' ? 'Show differences' : 
               choice === 'backup' ? 'Create backup and overwrite' :
               choice.charAt(0).toUpperCase() + choice.slice(1)
    }))
  });
  
  switch (response.action) {
    case 'skip':
      console.log(\`⚠️  Skipping \${filePath}\`);
      return false;
      
    case 'diff':
      // Show diff and ask again
      const existingContent = await fs.readFile(filePath, 'utf-8');
      console.log('\\n📊 Differences:');
      console.log(\`--- Existing \${filePath}\`);
      console.log(\`+++ New \${filePath}\`);
      // Simple diff display (could be enhanced with a proper diff library)
      const existingLines = existingContent.split('\\n');
      const newLines = newContent.split('\\n');
      const maxLines = Math.max(existingLines.length, newLines.length);
      
      for (let i = 0; i < maxLines; i++) {
        const existing = existingLines[i] || '';
        const newLine = newLines[i] || '';
        if (existing !== newLine) {
          if (existing) console.log(\`- \${existing}\`);
          if (newLine) console.log(\`+ \${newLine}\`);
        }
      }
      
      return await handleFileConflict(filePath, newContent);
      
    case 'backup':
      if (config.conflictResolution?.createBackups) {
        const backupPath = filePath + '.backup';
        await fs.copy(filePath, backupPath);
        console.log(\`📋 Backup created: \${backupPath}\`);
      }
      return true;
      
    case 'overwrite':
    default:
      return true;
  }
}

const addCommand = new Command('add')
  .description('Add components to your project with interactive selection')
  .option('-f, --framework <framework>', \`Target framework (\${config.capabilities.frameworks.join('|')})\`)
  .option('-s, --styling <styling>', \`Styling approach (\${config.capabilities.styling.join('|')})\`) 
  .option('-t, --typescript', 'Use TypeScript', config.capabilities.typescript)
  .option('-o, --output-dir <dir>', 'Output directory for generated components', 'src/components/ui')
  .addHelpText('before', \`
📦 \${config.name} - Component Library

Interactive component selection for your project.
This CLI helps you add framework-specific components with proper styling.

Available capabilities:
  • Frameworks: \${config.capabilities.frameworks.join(', ')}
  • Styling: \${config.capabilities.styling.join(', ')}
  • TypeScript: \${config.capabilities.typescript ? 'Yes' : 'No'}
\`)
  .addHelpText('after', \`
Examples:
  $ npx \${config.name} add                      # Interactive selection
  $ npx \${config.name} add -f react -s css      # Specific framework/styling
  $ npx \${config.name} add --output-dir ./ui    # Custom output directory

Features:
  ✅ Framework filtering - Only compatible combinations shown
  ✅ File conflict detection - Backup, merge, or skip existing files  
  ✅ Dependency management - Auto-update package.json
  ✅ TypeScript support - Generate .tsx/.ts files when enabled

Need help? Visit: https://docs.js-template-engine.dev/create-ui-kit
\`)
  .action(async (options: AddOptions) => {
    console.log('🎨 Welcome to ${options.projectName}!\\n');
    
    try {
      // Get framework preference
      let framework = options.framework;
      if (!framework) {
        const frameworkResponse = await prompt<{ framework: string }>({
          type: 'select',
          name: 'framework',
          message: 'Which framework are you using?',
          choices: config.capabilities.frameworks.map((fw: string) => ({
            name: fw,
            message: fw.charAt(0).toUpperCase() + fw.slice(1)
          }))
        });
        framework = frameworkResponse.framework;
      }
      
      // Get styling preference  
      let styling = options.styling;
      if (!styling) {
        const stylingResponse = await prompt<{ styling: string }>({
          type: 'select',
          name: 'styling',
          message: 'How do you want to style components?',
          choices: config.capabilities.styling.map((style: string) => ({
            name: style,
            message: style.toUpperCase()
          }))
        });
        styling = stylingResponse.styling;
      }
      
      // Get TypeScript preference
      let useTypeScript = options.typescript;
      if (useTypeScript === undefined && config.capabilities.typescript) {
        const tsResponse = await prompt<{ typescript: boolean }>({
          type: 'confirm',
          name: 'typescript',
          message: 'Do you want TypeScript?',
          initial: true
        });
        useTypeScript = tsResponse.typescript;
      }
      
      // Get output directory
      let outputDir = options.outputDir;
      if (!outputDir) {
        const dirResponse = await prompt<{ outputDir: string }>({
          type: 'input',
          name: 'outputDir',
          message: 'Where should components be installed?',
          initial: 'src/components/ui'
        });
        outputDir = dirResponse.outputDir;
      }
      
      // Get available components for selected options
      const availableComponents = await getAvailableComponents(framework, styling);
      
      if (availableComponents.length === 0) {
        console.log(\`❌ No components available for \${framework} + \${styling}\`);
        console.log('Available combinations:');
        // Show available combinations
        process.exit(1);
      }
      
      // Component selection
      const componentResponse = await prompt<{ components: string[] }>({
        type: 'multiselect',
        name: 'components',
        message: \`Available components for \${framework} + \${styling}:\`,
        choices: availableComponents,
        validate: (value: any) => Array.isArray(value) && value.length > 0 ? true : 'Please select at least one component'
      });
      
      console.log('\\n✨ Installing components...\\n');
      
      // Ensure output directory exists
      await fs.ensureDir(outputDir);
      
      // Set up template engine with selected framework and styling
      const extensions: any[] = [];
      
      // Add styling extensions first
      if (styling === 'bem') {
        const { BemExtension } = await import('@js-template-engine/extension-bem');
        extensions.push(new BemExtension(true));
      }
      
      // Add framework extensions last
${extensionInit}
      
      const engine = new TemplateEngine(extensions, true);
      let successCount = 0;
      let skippedCount = 0;
      
      // Generate each selected component
      for (const componentName of componentResponse.components) {
        try {
          // Load component template
          const templatePath = path.join(__dirname, '..', 'src', 'components', \`\${componentName}.json\`);
          const template = await fs.readJson(templatePath);
          
          // Generate component
          const result = await engine.render(template, {
            name: componentName,
            outputDir: outputDir,
            language: useTypeScript ? 'typescript' : 'javascript',
            writeOutputFile: false, // We'll handle file writing with conflict detection
            extensions: extensions,
            prettierParser: useTypeScript ? 'typescript' : 'babel',
          });
          
          // Determine file extension based on framework and language
          const fileExt = framework === 'vue' ? '.vue' : 
                         useTypeScript ? (framework === 'react' ? '.tsx' : '.ts') :
                         (framework === 'react' ? '.jsx' : '.js');
          
          const filePath = path.join(outputDir, \`\${componentName}\${fileExt}\`);
          
          // Handle file conflicts
          const shouldWrite = await handleFileConflict(filePath, result.output || '');
          
          if (shouldWrite) {
            await fs.writeFile(filePath, result.output || '');
            console.log(\`✅ \${componentName} → \${path.relative(process.cwd(), filePath)}\`);
            successCount++;
          } else {
            skippedCount++;
          }
          
        } catch (error) {
          console.error(\`❌ Failed to generate \${componentName}:\`, error);
        }
      }
      
      console.log(\`\\n🎉 Installation complete!\`);
      console.log(\`   ✅ \${successCount} components installed\`);
      if (skippedCount > 0) {
        console.log(\`   ⚠️  \${skippedCount} components skipped\`);
      }
      
      console.log('\\nNext steps:');
      console.log(\`   Import: import { Button } from './\${path.relative(process.cwd(), outputDir)}/button'\`);
      
    } catch (error) {
      console.error('❌ Failed to add components:', error);
      process.exit(1);
    }
  });

program
  .name('${options.projectName}')
  .description('Add framework-agnostic components to your project')
  .version('0.1.0')
  .addHelpText('after', \`
Quick Start:
  $ npx \${config.name} add        # Interactive component selection

This CLI tool allows you to selectively add components from \${config.name} 
to your project with your preferred framework and styling choices.

Generated with Create UI Kit: https://docs.js-template-engine.dev/create-ui-kit
\`)
  .addCommand(addCommand);

program.parse();
`;

  // Write CLI file
  await fs.writeFile(path.join(targetDir, 'src', 'cli.ts'), cliContent);
}

async function copyDocumentationGenerator(targetDir: string): Promise<void> {
  // Copy the source TypeScript file from the source directory
  const sourceDir = path.join(__dirname, '../../src/utilities');
  const sourceDocGenerator = path.join(sourceDir, 'documentation.ts');
  const targetDocGenerator = path.join(
    targetDir,
    'src/utilities/documentation.ts'
  );

  // Ensure utilities directory exists
  await fs.ensureDir(path.join(targetDir, 'src/utilities'));

  // Copy the documentation generator
  await fs.copy(sourceDocGenerator, targetDocGenerator);
}

async function createTsConfig(targetDir: string): Promise<void> {
  const tsConfig = {
    compilerOptions: {
      target: 'ES2020',
      module: 'ES2020',
      moduleResolution: 'node',
      lib: ['ES2020'],
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      declaration: true,
      declarationMap: true,
      sourceMap: true,
    },
    include: ['src/**/*', 'src/cli.ts'],
    exclude: ['node_modules', 'dist'],
  };

  await fs.writeFile(
    path.join(targetDir, 'tsconfig.json'),
    JSON.stringify(tsConfig, null, 2)
  );
}

async function validateDependencies(
  targetDir: string,
  options: InitOptions
): Promise<void> {
  console.log('\n🔍 Validating project dependencies...');

  try {
    const result = await DependencyValidator.validateUIKitProject(targetDir);

    if (!result.isValid) {
      console.warn('\n⚠️  Dependency validation issues found:');
      result.errors.forEach((error) => console.warn(`   ❌ ${error}`));

      // Generate and display fix suggestions
      const suggestions = DependencyValidator.generateDependencyFixSuggestions(
        result,
        options.projectName
      );
      if (suggestions.length > 0) {
        console.log('\n' + suggestions.join('\n'));
      }

      // Ask if user wants to create development-friendly package.json
      const hasWorkspaceDeps = result.missingDependencies.some((dep) =>
        dep.startsWith('@js-template-engine/')
      );

      if (hasWorkspaceDeps) {
        console.log(
          '💡 Creating development-friendly package.json with file: paths...'
        );
        try {
          await DependencyValidator.createDevelopmentPackageJson(
            path.join(targetDir, 'package.json')
          );
          console.log('✅ Development package.json created');
          console.log('   Original backed up as package.json.original');
          console.log('   Run "npm install" to link workspace packages');
        } catch (error) {
          console.warn(
            `   ⚠️  Could not create development package.json: ${
              error instanceof Error ? error.message : error
            }`
          );
        }
      }
    } else {
      console.log('✅ All dependencies validated successfully');
    }

    if (result.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      result.warnings.forEach((warning) => console.warn(`   • ${warning}`));
    }
  } catch (error) {
    console.warn(
      `⚠️  Could not validate dependencies: ${
        error instanceof Error ? error.message : error
      }`
    );
    console.warn(
      '   Project should still work, but manual dependency verification recommended.'
    );
  }
}
