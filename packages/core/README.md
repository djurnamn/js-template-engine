# @js-template-engine/core

The core functionality of JS Template Engine, providing the base template engine and extension system.

## 📦 Installation

```bash
pnpm add @js-template-engine/core
```

## 🚀 Usage

```typescript
import { TemplateEngine } from '@js-template-engine/core';
import { TemplateNode } from '@js-template-engine/types';

// Initialize the engine
const engine = new TemplateEngine();

// Define your template
const template: TemplateNode[] = [
  {
    type: 'element',
    tagName: 'div',
    attributes: {
      class: 'container'
    },
    children: [
      {
        type: 'text',
        content: 'Hello, World!'
      }
    ]
  }
];

// Render the template
await engine.render(template, {
  name: 'my-template',
  outputDir: './dist'
});
```

## 🔌 Extensions

The core engine supports extensions that can modify templates during rendering. Extensions can:

- Transform nodes
- Generate styles
- Add custom attributes
- Modify the output format

See the [extension documentation](../../README.md#-using-extensions) for more details.

## 📚 API

### `TemplateEngine`

The main class for rendering templates.

```typescript
class TemplateEngine {
  constructor(extensions?: Extension[], verbose?: boolean);
  
  async render(template: TemplateNode[], options: RenderOptions): Promise<void>;
}
```

### `RenderOptions`

Options for template rendering:

```typescript
interface RenderOptions {
  name?: string;
  outputDir?: string;
  fileExtension?: '.html' | '.jsx' | '.tsx' | '.css';
  verbose?: boolean;
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