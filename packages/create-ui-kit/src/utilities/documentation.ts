import fs from 'fs-extra';
import path from 'path';
import {
  ProcessingPipeline,
  ExtensionRegistry,
} from '@js-template-engine/core';
import { ReactExtension } from '@js-template-engine/extension-react';
import { VueExtension } from '@js-template-engine/extension-vue';
import { SvelteExtension } from '@js-template-engine/extension-svelte';
import { BemExtension } from '@js-template-engine/extension-bem';
import { TailwindExtension } from '@js-template-engine/extension-tailwind';

export interface ComponentDoc {
  name: string;
  description?: string;
  props: Record<string, string>;
  supportedFrameworks: string[];
  supportedStyling: string[];
  examples: Record<string, string>; // framework -> code
}

export class DocumentationGenerator {
  private config: any;
  private outputDir: string;

  constructor(outputDir: string = 'docs') {
    this.outputDir = outputDir;
  }

  async loadConfig(configPath: string): Promise<void> {
    // Load the UI kit configuration
    const configModule = await import(configPath);
    this.config = configModule.default || configModule;
  }

  async generateDocumentation(
    componentsDir: string,
    configPath: string
  ): Promise<void> {
    await this.loadConfig(configPath);

    console.log('📚 Generating documentation...');

    // Ensure docs directory exists
    await fs.ensureDir(this.outputDir);
    await fs.ensureDir(path.join(this.outputDir, 'components'));
    await fs.ensureDir(path.join(this.outputDir, 'examples'));

    // Get all component files
    const componentFiles = await fs.readdir(componentsDir);
    const componentDocs: ComponentDoc[] = [];

    for (const file of componentFiles) {
      if (file.endsWith('.json') || file.endsWith('.js')) {
        const componentName = path.basename(file, path.extname(file));
        const componentPath = path.join(componentsDir, file);

        console.log(`📄 Processing ${componentName}...`);

        const doc = await this.generateComponentDoc(
          componentPath,
          componentName
        );
        componentDocs.push(doc);

        // Generate individual component documentation
        await this.writeComponentDoc(doc);
      }
    }

    // Generate overview documentation
    await this.generateOverview(componentDocs);

    console.log(`✅ Documentation generated in ${this.outputDir}/`);
  }

  private async generateComponentDoc(
    componentPath: string,
    componentName: string
  ): Promise<ComponentDoc> {
    let template: any;

    if (componentPath.endsWith('.json')) {
      template = await fs.readJson(componentPath);
    } else {
      template = require(path.resolve(componentPath));
      template = template.default || template;
    }

    const componentConfig = this.config.components?.[componentName] || {};

    // Determine supported frameworks and styling
    const supportedFrameworks =
      componentConfig.frameworks || this.config.capabilities.frameworks;
    const supportedStyling =
      componentConfig.styling || this.config.capabilities.styling;

    // Extract props from component definition
    const props = template.component?.props || {};

    // Generate code examples for each supported framework
    const examples: Record<string, string> = {};

    for (const framework of supportedFrameworks) {
      const example = await this.generateCodeExample(
        template,
        componentName,
        framework
      );
      examples[framework] = example;
    }

    return {
      name: componentName,
      description: template.component?.description,
      props,
      supportedFrameworks,
      supportedStyling,
      examples,
    };
  }

  private async generateCodeExample(
    template: any,
    componentName: string,
    framework: string
  ): Promise<string> {
    try {
      // Set up ProcessingPipeline with appropriate extension
      const registry = new ExtensionRegistry();

      if (framework === 'react') {
        registry.registerFramework(new ReactExtension());
      } else if (framework === 'vue') {
        registry.registerFramework(new VueExtension());
      } else if (framework === 'svelte') {
        registry.registerFramework(new SvelteExtension());
      }

      // Add styling extensions
      registry.registerStyling(new BemExtension());
      registry.registerStyling(new TailwindExtension());

      const pipeline = new ProcessingPipeline(registry);

      // Generate component
      const result = await pipeline.process(template, {
        framework: framework,
        component: {
          name: componentName,
        },
      });

      return result.output || `// Failed to generate ${framework} example`;
    } catch (error) {
      return `// Error generating ${framework} example: ${error}`;
    }
  }

  private async writeComponentDoc(doc: ComponentDoc): Promise<void> {
    const componentName = doc.name;
    const capitalizedName =
      componentName.charAt(0).toUpperCase() + componentName.slice(1);

    // Generate prop interface
    const propsInterface = this.generatePropsInterface(
      doc.props,
      capitalizedName
    );

    // Generate framework examples
    const frameworkExamples = this.generateFrameworkExamples(doc);

    // Generate installation section
    const installationSection = this.generateInstallationSection(componentName);

    const markdown = `# ${capitalizedName}

${doc.description || `A reusable ${componentName} component.`}

## Props

${propsInterface}

## Supported Frameworks

${doc.supportedFrameworks.map((fw) => `- ${fw.charAt(0).toUpperCase() + fw.slice(1)}`).join('\n')}

## Supported Styling

${doc.supportedStyling.map((style) => `- ${style.toUpperCase()}`).join('\n')}

## Installation

${installationSection}

## Examples

${frameworkExamples}

---

*This documentation is automatically generated from the component template.*
`;

    await fs.writeFile(
      path.join(this.outputDir, 'components', `${componentName}.md`),
      markdown
    );
  }

  private generatePropsInterface(
    props: Record<string, string>,
    componentName: string
  ): string {
    if (Object.keys(props).length === 0) {
      return '_No props defined._';
    }

    const interfaceLines = Object.entries(props)
      .map(([propName, propType]) => `  ${propName}: ${propType};`)
      .join('\n');

    return `\`\`\`typescript
interface ${componentName}Props {
${interfaceLines}
}
\`\`\``;
  }

  private generateFrameworkExamples(doc: ComponentDoc): string {
    return Object.entries(doc.examples)
      .map(([framework, code]) => {
        const language =
          framework === 'vue'
            ? 'vue'
            : this.config.capabilities.typescript
              ? 'tsx'
              : 'jsx';

        return `### ${framework.charAt(0).toUpperCase() + framework.slice(1)}

\`\`\`${language}
${code}
\`\`\``;
      })
      .join('\n\n');
  }

  private generateInstallationSection(componentName: string): string {
    const packageName = this.config.name;

    return `### Using the CLI

\`\`\`bash
npx ${packageName} add ${componentName}
\`\`\`

### Direct Import

\`\`\`javascript
import { ${componentName.charAt(0).toUpperCase() + componentName.slice(1)} } from '${packageName}/react';
\`\`\``;
  }

  private async generateOverview(componentDocs: ComponentDoc[]): Promise<void> {
    const packageName = this.config.name;
    const totalComponents = componentDocs.length;

    // Generate capability matrix
    const capabilityMatrix = this.generateCapabilityMatrix(componentDocs);

    // Generate component list
    const componentList = componentDocs
      .map(
        (doc) =>
          `- [${doc.name.charAt(0).toUpperCase() + doc.name.slice(1)}](components/${doc.name}.md)`
      )
      .join('\n');

    const markdown = `# ${packageName}

A UI kit built with [create-ui-kit](https://github.com/djurnamn/js-template-engine).

## Overview

This UI kit contains **${totalComponents} components** with support for multiple frameworks and styling approaches.

## Components

${componentList}

## Framework & Styling Support

${capabilityMatrix}

## Quick Start

### Installation

\`\`\`bash
npm install ${packageName}
\`\`\`

### Using Components

#### Option 1: Copy Components (Recommended)

\`\`\`bash
# Interactive component selection
npx ${packageName} add

# Add specific component
npx ${packageName} add button --framework react --styling css
\`\`\`

#### Option 2: Direct Import

\`\`\`javascript
import { Button } from '${packageName}/react';
import '${packageName}/styles.css';

function App() {
  return <Button variant="primary">Click me</Button>;
}
\`\`\`

## Supported Frameworks

${this.config.capabilities.frameworks.map((fw: string) => `- ${fw.charAt(0).toUpperCase() + fw.slice(1)}`).join('\n')}

## Supported Styling

${this.config.capabilities.styling.map((style: string) => `- ${style.toUpperCase()}`).join('\n')}

---

*This documentation is automatically generated and stays in sync with your components.*
`;

    await fs.writeFile(path.join(this.outputDir, 'README.md'), markdown);
  }

  private generateCapabilityMatrix(componentDocs: ComponentDoc[]): string {
    const frameworks = this.config.capabilities.frameworks;

    // Create header
    let matrix =
      '| Component | ' +
      frameworks
        .map((fw: string) => fw.charAt(0).toUpperCase() + fw.slice(1))
        .join(' | ') +
      ' |\n';
    matrix += '|-----------|' + frameworks.map(() => '-----').join('|') + '|\n';

    // Add rows for each component
    for (const doc of componentDocs) {
      const name = doc.name.charAt(0).toUpperCase() + doc.name.slice(1);
      const support = frameworks
        .map((fw: string) =>
          doc.supportedFrameworks.includes(fw) ? '✅' : '❌'
        )
        .join(' | ');

      matrix += `| ${name} | ${support} |\n`;
    }

    return matrix;
  }
}
