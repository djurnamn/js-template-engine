# @js-template-engine/core

The core functionality of JS Template Engine, providing the base template engine and extension system.

## 📦 Installation

```bash
pnpm add @js-template-engine/core
```

## 🚀 Usage

```typescript
import { ProcessingPipeline, ExtensionRegistry } from '@js-template-engine/core';
import { TemplateNode } from '@js-template-engine/types';

// Initialize the processing pipeline
const registry = new ExtensionRegistry();
const pipeline = new ProcessingPipeline(registry);

// Define your template
const template: TemplateNode[] = [
  {
    type: 'element',
    tag: 'div',
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

// Process the template
const result = await pipeline.process(template, {
  component: { name: 'my-template' },
  framework: 'react'
});

console.log(result.output);
```

## 🔌 Extensions

The core engine supports extensions that can modify templates during rendering. Extensions can:

- Transform nodes
- Generate styles
- Add custom attributes
- Modify the output format

See the [extension documentation](../../README.md#-using-extensions) for more details.

## 📚 API

### `ProcessingPipeline`

The main class for processing templates with the concept-driven system.

```typescript
class ProcessingPipeline {
  constructor(registry: ExtensionRegistry, options?: ProcessingOptions);
  
  async process(template: TemplateNode[], options: ProcessingOptions): Promise<ProcessingResult>;
}
```

### `ProcessingOptions`

Options for template processing:

```typescript
interface ProcessingOptions {
  framework?: string;
  styling?: string;
  utilities?: string[];
  component?: {
    name?: string;
    props?: Record<string, string>;
  };
  verboseErrors?: boolean;
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
- Extensions are registered using the `ExtensionRegistry` with specific methods for each type:
  - `registerFramework()` for framework extensions
  - `registerStyling()` for styling extensions  
  - `registerUtility()` for utility extensions

## Integration Tests
- Integration tests now live in a dedicated `integration-tests` package.
- These tests verify that the core engine and all official extensions work together as intended, covering end-to-end scenarios and multi-extension contracts.

## Backward Compatibility
- The system has migrated to a concept-driven architecture with `ProcessingPipeline` as the main processing class, replacing the legacy `TemplateEngine`.

## For Extension Authors
- See the [docs/extending.md](../../docs/extending.md) for details on writing extensions and available hooks. 