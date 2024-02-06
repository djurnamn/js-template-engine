# JS Template Engine

A dynamic templating engine that translates JavaScript or JSON data into structured templates across multiple languages. At its core this tool generates HTML templates, but the concept is modular and can be extended to render templates for any framework or templating language imaginable.

## Features

- Ideal for UI libraries: Maintain one single source of truth and avoid double maintaining different language variations of your components.
- Customizable: Does it not yet support your templating language of choice? The abstract logic allows you to create and use your own extensions.
- Native Extensions: There's a growing ecosystem of extensions, i.e. React to generate JSX components and BEM to enforce consistent class naming.
- CLI Interface: A convenient CLI tool that can both process single JSON files and traverse through nested folder structures from the command line.
- Flexible Configuration: Customize the output directory, apply framework-specific extensions, and more through CLI options or configuration files.

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

- `--outputDir`, `-o`: Specify the output directory for rendered templates.
- `--extensions`, `-e`: Choose extensions to use for template processing (e.g., react, bem).
- `--name`, `-n`: Set a base name for output files.
- `--componentName`, `-c`: Define a component name for framework-specific templates (useful for React).
- `--verbose`, `-v`: Enable verbose logging for more detailed output.

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

You can also use JS Template Engine programmatically in your Node.js projects. This is how you could define and process your template using the BEM extension:

```javascript
const { TemplateEngine, BemExtension } = require("js-template-engine");

const templateEngine = new TemplateEngine();
const bemExtension = new BemExtension();

const breadcrumbsTemplate = [
  {
    tag: "nav",
    extensions: {
      bem: {
        block: "breadcrumbs",
      },
    },
    children: [
      {
        tag: "ul",

        extensions: {
          bem: {
            element: "list",
          },
        },
        children: [
          {
            tag: "li",

            extensions: {
              bem: {
                element: "item",
              },
            },
            children: [
              {
                tag: "a",
                extensions: {
                  bem: {
                    element: "text",
                  },
                },
                attributes: {
                  href: "/",
                },
                children: [
                  {
                    type: "text",
                    content: "Home",
                  },
                ],
              },
            ],
          },
          {
            tag: "li",
            extensions: {
              bem: {
                element: "item",
                modifier: "current",
              },
            },
            children: [
              {
                tag: "span",
                extensions: {
                  bem: {
                    element: "text",
                  },
                },
                children: [
                  {
                    type: "text",
                    content: "About",
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

templateEngine.render(breadcrumbsTemplate, {
  name: "breadcrumbs",
  extensions: [bemExtension],
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

## Contributing

Contributions are welcome! Feel free to open pull requests or issues to suggest features, report bugs, or contribute to the code.

## Reporting Issues

Found a bug or have a suggestion? Please use the GitHub Issues page to report issues or request features.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
