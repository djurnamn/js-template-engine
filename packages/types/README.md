# @js-template-engine/types

Shared TypeScript type definitions for JS Template Engine and its extensions.

## 📦 Installation

```bash
pnpm add @js-template-engine/types
```

## 🚀 Usage

```typescript
import { TemplateNode, Extension, RenderOptions } from '@js-template-engine/types';

// Define a template node
const node: TemplateNode = {
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
};

// Define an extension
class MyExtension implements Extension {
  key = 'my-extension';
  
  nodeHandler(node: TemplateNode): TemplateNode {
    // Process the node
    return node;
  }
}

// Define render options
const options: RenderOptions = {
  name: 'my-template',
  outputDir: './dist',
  fileExtension: '.html',
  verbose: true
};
```

## 📚 API

### Core Types

```typescript
interface TemplateNode {
  type?: 'element' | 'text' | 'slot';
  tagName?: string;
  attributes?: Record<string, string>;
  children?: TemplateNode[];
  content?: string;
  extensions?: Record<string, any>;
}

interface Extension<T extends TemplateNode = TemplateNode> {
  key: string;
  nodeHandler?: (node: T, ancestorNodesContext?: TemplateNode[]) => TemplateNode;
  stylePlugin?: {
    onProcessNode?: (node: TemplateNode) => void;
    generateStyles?: (styles: Record<string, any>, options: RenderOptions, template: TemplateNode[]) => Record<string, any> | undefined;
  };
}

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

# Type check
pnpm type-check
```

## 📝 License

MIT 