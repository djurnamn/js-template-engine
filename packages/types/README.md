# @js-template-engine/types

Shared TypeScript type definitions for JS Template Engine and its extensions.

## 📦 Installation

```bash
pnpm add @js-template-engine/types
```

## 🚀 Usage

```typescript
import { TemplateNode, Extension, RenderOptions } from '@js-template-engine/types';

// Define a template node (type defaults to 'element')
const node: TemplateNode = {
  tag: 'div',
  attributes: {
    class: 'container'
  },
  children: [
    {
      type: 'text',
      content: 'Hello, World!'
    },
    {
      type: 'slot',
      name: 'content',
      fallback: [{ type: 'text', content: 'Default content' }]
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
  language: 'javascript',
  verbose: true
};
```

## 📚 API

### Core Types

```typescript
type TemplateNode = 
  | {
      type?: 'element'; // Optional, defaults to 'element'
      tag: string;
      attributes?: Record<string, any>;
      children?: TemplateNode[];
      extensions?: Record<string, any>;
    }
  | {
      type: 'text';
      content: string;
      extensions?: Record<string, any>;
    }
  | {
      type: 'slot';
      name: string;
      fallback?: TemplateNode[]; // Default content for plain HTML
      extensions?: Record<string, any>;
    };

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
  language?: 'typescript' | 'javascript';
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