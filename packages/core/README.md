# @js-template-engine/core

The core package provides the fundamental functionality for the JS Template Engine. It includes the base template engine, type definitions, and essential utilities for template processing.

## Features

- Template rendering engine
- Type definitions for templates and extensions
- Style processing utilities
- Logging and debugging tools
- Extension system for custom template processing

## Installation

```bash
pnpm add @js-template-engine/core
```

## Usage

```typescript
import { TemplateEngine } from '@js-template-engine/core';

const templateEngine = new TemplateEngine();

const template = [
  {
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

await templateEngine.render(template, {
  name: 'example',
  writeOutputFile: true
});
```

## API

### TemplateEngine

The main class for template processing.

```typescript
class TemplateEngine {
  constructor(extensions?: Extension[]);
  
  render(template: TemplateNode[], options: RenderOptions): Promise<void>;
}
```

### Types

- `TemplateNode`: Base type for template nodes
- `RenderOptions`: Options for template rendering
- `Extension`: Interface for custom extensions

## Development

```bash
# Build the package
pnpm build

# Run tests
pnpm test

# Type check
pnpm type-check
``` 