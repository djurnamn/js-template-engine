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

You can also use JS Template Engine programmatically in your TypeScript/Node.js projects. This is how you could define and process your template using the BEM extension:

```typescript
import { TemplateEngine, BemExtension } from 'js-template-engine';
import { ExtendedTemplateNode } from 'js-template-engine/types';

const templateEngine = new TemplateEngine();
const bemExtension = new BemExtension();

const breadcrumbsTemplate: ExtendedTemplateNode[] = [
  {
    tag: 'nav',
    extensions: {
      bem: {
        block: 'breadcrumbs',
      },
    },
    children: [
      {
        tag: 'ul',
        extensions: {
          bem: {
            element: 'list',
          },
        },
        children: [
          {
            tag: 'li',
            extensions: {
              bem: {
                element: 'item',
              },
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
          {
            tag: 'li',
            extensions: {
              bem: {
                element: 'item',
                modifier: 'current',
              },
            },
            children: [
              {
                tag: 'span',
                extensions: {
                  bem: {
                    element: 'text',
                  },
                },
                children: [
                  {
                    type: 'text',
                    content: 'About',
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

await templateEngine.render(breadcrumbsTemplate, {
  name: 'breadcrumbs',
  extensions: [bemExtension],
  writeOutputFile: true,
});
```

This is what it would result in:

```html
<nav class="breadcrumbs">
  <ul class="breadcrumbs__list">
    <li class="breadcrumbs__item">
      <a href="/" class="breadcrumbs__text">Home</a>
    </li>
    <li class="breadcrumbs__item breadcrumbs__item--current">
      <span class="breadcrumbs__text">About</span>
    </li>
  </ul>
</nav>
```

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
