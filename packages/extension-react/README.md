# @js-template-engine/extension-react

A React extension for the JS Template Engine that enables the generation of React components from template definitions. This extension provides seamless integration between the template engine and React's component system.

## Features

- React component generation
- JSX/TSX output support
- Props and state handling
- Integration with other extensions (e.g., BEM)
- TypeScript support

## Installation

```bash
pnpm add @js-template-engine/extension-react
```

## Usage

```typescript
import { TemplateEngine } from '@js-template-engine/core';
import { ReactExtension } from '@js-template-engine/extension-react';
import { BemExtension } from '@js-template-engine/extension-bem';

const templateEngine = new TemplateEngine([
  new ReactExtension(),
  new BemExtension()
]);

const template = [
  {
    tag: 'div',
    extensions: {
      react: {
        component: 'Card',
        props: {
          title: 'Card Title',
          featured: true
        }
      },
      bem: {
        block: 'card'
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
            content: '{{title}}'
          }
        ]
      }
    ]
  }
];

await templateEngine.render(template, {
  name: 'Card',
  writeOutputFile: true,
  fileExtension: '.tsx'
});
```

## API

### ReactExtension

```typescript
class ReactExtension implements Extension<ReactOptions, ReactNodeExtensions> {
  constructor(verbose?: boolean);
}
```

### Types

- `ReactOptions`: Configuration options for React component generation
- `ReactNodeExtensions`: React-specific node properties

## Development

```bash
# Build the package
pnpm build

# Run tests
pnpm test

# Type check
pnpm type-check
``` 