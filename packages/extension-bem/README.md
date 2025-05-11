# @js-template-engine/extension-bem

A BEM (Block Element Modifier) extension for the JS Template Engine that helps generate consistent and maintainable CSS class names following the BEM methodology.

## Features

- Automatic BEM class name generation
- Support for blocks, elements, and modifiers
- Configurable naming conventions
- Integration with style processing

## Installation

```bash
pnpm add @js-template-engine/extension-bem
```

## Usage

```typescript
import { TemplateEngine } from '@js-template-engine/core';
import { BemExtension } from '@js-template-engine/extension-bem';

const templateEngine = new TemplateEngine([new BemExtension()]);

const template = [
  {
    tag: 'div',
    extensions: {
      bem: {
        block: 'card',
        modifiers: ['featured']
      }
    },
    children: [
      {
        tag: 'h2',
        extensions: {
          bem: {
            element: 'title'
          }
        },
        children: [
          {
            type: 'text',
            content: 'Card Title'
          }
        ]
      }
    ]
  }
];

await templateEngine.render(template, {
  name: 'card',
  writeOutputFile: true
});
```

## API

### BemExtension

```typescript
class BemExtension implements Extension<BemOptions, BemNodeExtensions> {
  constructor(verbose?: boolean);
}
```

### Types

- `BemOptions`: Configuration options for BEM naming
- `BemNodeExtensions`: BEM-specific node properties

## Development

```bash
# Build the package
pnpm build

# Run tests
pnpm test

# Type check
pnpm type-check
``` 