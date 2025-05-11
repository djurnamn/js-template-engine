# @js-template-engine/extension-bem

A BEM (Block Element Modifier) extension for JS Template Engine that generates BEM-style class names for your templates.

## 📦 Installation

```bash
pnpm add @js-template-engine/extension-bem
```

## 🚀 Usage

```typescript
import { TemplateEngine } from '@js-template-engine/core';
import { BemExtension } from '@js-template-engine/extension-bem';
import { TemplateNode } from '@js-template-engine/types';

// Initialize the engine with BEM extension
const engine = new TemplateEngine([new BemExtension()]);

// Define your template with BEM extensions
const template: TemplateNode[] = [
  {
    type: 'element',
    tagName: 'div',
    extensions: {
      bem: {
        block: 'card'
      }
    },
    children: [
      {
        type: 'element',
        tagName: 'div',
        extensions: {
          bem: {
            element: 'header'
          }
        }
      }
    ]
  }
];

// Render the template
await engine.render(template, {
  name: 'my-component',
  outputDir: './dist'
});
```

## 🔌 Features

- Automatic BEM class name generation
- Support for blocks, elements, and modifiers
- Nested BEM structures
- Customizable naming conventions

## 📚 API

### `BemExtension`

```typescript
class BemExtension {
  constructor(verbose?: boolean);
  
  readonly key = 'bem';
  
  nodeHandler(node: TemplateNode): TemplateNode;
}
```

### BEM Node Extension

```typescript
interface BemNodeExtension {
  block?: string;
  element?: string;
  modifiers?: string[];
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