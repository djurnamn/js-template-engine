# @js-template-engine/extension-react

A React extension for JS Template Engine that generates React components from your templates.

## 📦 Installation

```bash
pnpm add @js-template-engine/extension-react
```

## 🚀 Usage

```typescript
import { TemplateEngine } from '@js-template-engine/core';
import { ReactExtension } from '@js-template-engine/extension-react';
import { TemplateNode } from '@js-template-engine/types';

// Initialize the engine with React extension
const engine = new TemplateEngine([new ReactExtension()]);

// Define your template
const template: TemplateNode[] = [
  {
    type: 'element',
    tagName: 'div',
    attributes: {
      className: 'container'
    },
    children: [
      {
        type: 'element',
        tagName: 'h1',
        children: [
          {
            type: 'text',
            content: 'Hello, React!'
          }
        ]
      }
    ]
  }
];

// Render the template as a React component
await engine.render(template, {
  name: 'MyComponent',
  outputDir: './dist',
  fileExtension: '.tsx'
});
```

## 🔌 Features

- React component generation
- TypeScript support
- Props handling
- Event handling
- Style integration
- Fragment support

## 📚 API

### `ReactExtension`

```typescript
class ReactExtension {
  constructor(verbose?: boolean);
  
  readonly key = 'react';
  
  nodeHandler(node: TemplateNode): TemplateNode;
}
```

### React Node Extension

```typescript
interface ReactNodeExtension {
  props?: Record<string, any>;
  events?: Record<string, string>;
  fragment?: boolean;
}
```

## 🔧 Development

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Run tests
pnpm test

# Type check
pnpm type-check
```

## 📝 License

MIT 