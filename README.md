# JS Template Engine

A dynamic templating engine that translates TypeScript/JavaScript or JSON data into structured templates across multiple languages. At its core this tool generates HTML templates, but the concept is modular and can be extended to render templates for any framework or templating language imaginable.

## Features

- **TypeScript Support**: Full TypeScript support with comprehensive type definitions and type safety
- **Ideal for UI libraries**: Maintain one single source of truth and avoid double maintaining different language variations of your components
- **Customizable**: Does it not yet support your templating language of choice? The abstract logic allows you to create and use your own extensions
- **Native Extensions**: There's a growing ecosystem of extensions, i.e. React to generate JSX components and BEM to enforce consistent class naming
- **CLI Interface**: A convenient CLI tool that can both process single JSON files and traverse through nested folder structures from the command line
- **Flexible Configuration**: Customize the output directory, apply framework-specific extensions, and more through CLI options or configuration files

## Installation

```sh
npm install js-template-engine
```

Or if you prefer using Yarn:

```sh
yarn add js-template-engine
```

## Usage

### CLI

The JS Template Engine CLI provides a straightforward way to render templates from JSON files:

```sh
js-template-engine render <sourcePath> [options]
```

**Arguments:**

- `<sourcePath>`: The path to the JSON file or directory containing JSON templates you wish to render.

**Options:**

- `--outputDir`, `-o`: Specify the output directory for rendered templates
- `--extensions`, `-e`: Choose extensions to use for template processing (e.g., react, bem)
- `--name`, `-n`: Set a base name for output files
- `--componentName`, `-c`: Define a component name for framework-specific templates (useful for React)
- `--verbose`, `-v`: Enable verbose logging for more detailed output
- `--extension`: Choose the extension type ('react', 'bem', or 'none')
- `--fileExtension`: Specify the output file extension ('.html', '.jsx', '.tsx', or '.css')

### Examples

Feel free to check out the [examples folder](examples), to get a better idea of some of the core concepts and extensions. The provided examples can be run using:

```sh
npm run example:react
npm run example:bem
npm run example:slots
```

Or if you prefer using Yarn:

```sh
yarn example:react
yarn example:bem
yarn example:slots
```

### API

You can also use JS Template Engine programmatically in your TypeScript/Node.js projects. This is how you could define and process your template using the BEM extension with styles:

```typescript
import { TemplateEngine, BemExtension } from 'js-template-engine';
import { ExtendedTemplateNode } from 'js-template-engine/types';

// Initialize the engine with extensions - they'll be used for all renders
const templateEngine = new TemplateEngine([new BemExtension(true)]); // Enable verbose logging

const breadcrumbsTemplate: ExtendedTemplateNode[] = [
  {
    tag: 'nav',
    extensions: {
      bem: {
        block: 'breadcrumbs',
      },
    },
    attributes: {
      styles: {
        padding: '1rem',
        backgroundColor: '#f5f5f5',
        borderRadius: '4px',
        '@media (max-width: 768px)': {
          padding: '0.5rem'
        }
      }
    },
    children: [
      {
        tag: 'ul',
        extensions: {
          bem: {
            element: 'list',
          },
        },
        attributes: {
          styles: {
            margin: 0,
            padding: 0,
            listStyle: 'none',
            display: 'flex',
            gap: '1rem'
          }
        },
        children: [
          {
            tag: 'li',
            extensions: {
              bem: {
                element: 'item',
              },
            },
            attributes: {
              styles: {
                position: 'relative',
                ':last-child': {
                  '&::after': {
                    display: 'none'
                  }
                }
              }
            },
            children: [
              {
                tag: 'a',
                extensions: {
                  bem: {
                    element: 'text',
                  },
                },
                attributes: {
                  href: '/',
                  styles: {
                    color: '#333',
                    textDecoration: 'none',
                    ':hover': {
                      color: '#666'
                    }
                  }
                },
                children: [
                  {
                    type: 'text',
                    content: 'Home',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

// No need to pass extensions again - they're inherited from the constructor
await templateEngine.render(breadcrumbsTemplate, {
  name: 'breadcrumbs',
  writeOutputFile: true,
  styles: {
    outputFormat: 'scss'  // Generate SCSS output
  }
});
```

You can also override or add extensions per-render if needed:

```typescript
// Add a new extension just for this render
await templateEngine.render(template, {
  extensions: [new MyCustomExtension()],
  // ... other options
});
```

## Creating Custom Extensions

The JS Template Engine is designed to be extensible. You can create your own extensions by implementing the `Extension` interface. Here's a guide to creating custom extensions:

### 1. Define Extension Types

First, define your extension's types in a new file:

```typescript
import { BaseExtensionOptions, ExtensionKey } from 'js-template-engine/types';

export namespace MyExtension {
  export interface Options extends BaseExtensionOptions {
    // Add your extension-specific options here
    customOption?: string;
  }

  export interface NodeExtensions {
    // Define node-specific extension properties
    customProperty?: string;
  }
}
```

### 2. Create the Extension Class

Implement your extension class:

```typescript
import { Extension, DeepPartial } from 'js-template-engine/types';
import { MyExtension } from './types';

export class MyCustomExtension implements Extension<MyExtension.Options, MyExtension.NodeExtensions> {
  public readonly key = 'myExtension' as const;
  private logger: ReturnType<typeof createLogger>;

  constructor(verbose = false) {
    this.logger = createLogger(verbose, 'MyExtension');
  }

  // Handle extension options
  public optionsHandler(
    defaultOptions: MyExtension.Options,
    options: DeepPartial<MyExtension.Options>
  ): MyExtension.Options {
    return {
      ...defaultOptions,
      ...options,
    };
  }

  // Process individual nodes
  public nodeHandler(
    node: TemplateNode & { extensions?: { myExtension?: MyExtension.NodeExtensions } },
    ancestorNodesContext: TemplateNode[] = []
  ): TemplateNode {
    // Implement your node processing logic here
    return node;
  }

  // Optional: Add style processing capabilities
  public readonly stylePlugin: StyleProcessorPlugin = {
    onProcessNode: (node) => {
      // Process node styles
    },
    generateStyles: (styles, options, templateTree) => {
      // Generate custom style output
      return null;
    }
  };
}
```

### 3. Using Your Extension

Register and use your extension:

```typescript
// Option 1: Register at engine creation (recommended for most cases)
const templateEngine = new TemplateEngine([new MyCustomExtension()]);

await templateEngine.render(template, {
  // Your extension options
  myExtension: {
    customOption: 'value'
  }
});

// Option 2: Register per-render (for one-off usage)
const templateEngine = new TemplateEngine();

await templateEngine.render(template, {
  extensions: [new MyCustomExtension()],
  // Your extension options
  myExtension: {
    customOption: 'value'
  }
});
```

### Extension Features

Extensions can provide several types of functionality:

1. **Node Processing**: Transform nodes during template rendering
2. **Style Processing**: Generate custom style output (CSS, SCSS, etc.)
3. **Options Handling**: Process and validate extension-specific options
4. **Root Template Processing**: Modify the entire template output

### Best Practices

- Use TypeScript for type safety and better IDE support
- Implement proper logging for debugging
- Handle edge cases and provide meaningful error messages
- Document your extension's API and usage
- Add unit tests for your extension
- Follow the existing extension patterns for consistency

## TypeScript Support

The project is written in TypeScript and provides comprehensive type definitions:

- Full type safety for template nodes and extensions
- Type guards for runtime type checking
- Generic types for extension options
- Proper type definitions for all public APIs

## Contributing

Contributions are welcome! Feel free to open pull requests or issues to suggest features, report bugs, or contribute to the code.

## Reporting Issues

Found a bug or have a suggestion? Please use the GitHub Issues page to report issues or request features.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Monorepo Structure

This project is organized as a monorepo using `pnpm` workspaces. The main packages are:

- `@js-template-engine/core`: Core functionality for the templating engine.
- `@js-template-engine/extension-bem`: BEM extension for generating BEM-style CSS classes.
- `@js-template-engine/extension-react`: React extension for generating React components.
- `@js-template-engine/cli`: Command-line interface for rendering templates.
- `@js-template-engine/examples`: Example usage of the templating engine.

## Running Examples

To run all examples:

```bash
pnpm --filter @js-template-engine/examples start
```

To run individual examples:

```bash
pnpm --filter @js-template-engine/examples start:bem
pnpm --filter @js-template-engine/examples start:react
pnpm --filter @js-template-engine/examples start:slots
pnpm --filter @js-template-engine/examples start:styles
```

## Development

- `pnpm build`: Build all packages.
- `pnpm test`: Run tests for all packages.
- `pnpm lint`: Lint all packages.
- `pnpm type-check`: Type-check all packages.

## 🔌 Using Extensions

JS Template Engine supports a powerful, modular extension system. You can dynamically load only the extensions you need by defining them in a simple config file.

### 📁 Step 1: Create a `template.config.ts` File

At the root of your project (or where you run the CLI), create a file:

```ts
// template.config.ts
export default {
  extensions: [
    '@js-template-engine/extension-bem',
    '@js-template-engine/extension-react'
  ]
};
```

Each entry should be the name of a package that exports an extension class as its default export.

### 🚀 Step 2: Run the CLI

From your project root or the `examples` folder:

```bash
pnpm cli render path/to/template.json
```

The CLI will:

1. Read your `template.config.ts`
2. Dynamically load each listed extension
3. Inject them into the engine before rendering

### 🧩 Writing Your Own Extensions

You can create a custom extension by following this pattern:

```ts
import { Extension, TemplateNode } from '@js-template-engine/types';

export default class MyCustomExtension implements Extension {
  key = 'custom';

  nodeHandler(node: TemplateNode) {
    if (node.tag === 'button') {
      node.attributes = node.attributes || {};
      node.attributes['data-custom'] = 'true';
    }
    return node;
  }
}
```

Then either:

* **Publish it** as an npm package: `@your-scope/js-template-engine-extension-myfeature`
* Or use a relative path in your config:

```ts
export default {
  extensions: [
    './my-local-extension.ts'
  ]
};
```

> ✅ All extensions must export a default class implementing the `Extension` interface.

### ⚠️ Troubleshooting

* **Extension not found?** Make sure it's installed and listed in your dependencies.
* **No default export?** Your extension must export a class by default.
* **No `nodeHandler` method?** The CLI will skip any extension that doesn't handle nodes.

## 📦 Packages

This is a monorepo containing the following packages:

- `@js-template-engine/core` - Core template engine functionality
- `@js-template-engine/extension-bem` - BEM class name generation
- `@js-template-engine/extension-react` - React component generation
- `@js-template-engine/examples` - Example usage and templates
- `@js-template-engine/cli` - Command-line interface
- `@js-template-engine/types` - Shared TypeScript types

## 🚀 Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Build all packages:
   ```bash
   pnpm build
   ```

3. Run examples:
   ```bash
   cd packages/examples
   pnpm start
   ```

## 📝 License

MIT
