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

## Modular Architecture

The core engine is now composed of the following modules:
- **AttributeRenderer**: Handles attribute rendering for nodes (HTML, JSX, etc.).
- **NodeTraverser**: Walks and transforms the template node tree.
- **ExtensionManager**: Manages extension lifecycle, ordering, and hook calls.
- **StyleManager**: Centralizes style processing, formatting, and plugin support.
- **FileOutputManager**: Handles output path resolution, directory creation, and file writing.

## Extension System
- Extensions can add or override rendering logic, attributes, styles, and output.
- **Only one renderer extension (framework) can be used at a time** (e.g., React, Vue). The engine will throw an error if multiple renderer extensions are provided.
- Extensions are registered by passing them to the `TemplateEngine` constructor.

## Integration Tests
- Integration tests now live in a dedicated `integration-tests` package.
- These tests verify that the core engine and all official extensions work together as intended, covering end-to-end scenarios and multi-extension contracts.

## Backward Compatibility
- The public API of `TemplateEngine` remains stable, but internal responsibilities are now delegated to the new modules above.

## For Extension Authors
- See the [docs/extending.md](../../docs/extending.md) for details on writing extensions and available hooks. 