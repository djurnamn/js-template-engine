# React Extension

[![npm version](https://img.shields.io/npm/v/@js-template-engine/extension-react.svg)](https://www.npmjs.com/package/@js-template-engine/extension-react)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A React framework extension for the JS Template Engine that generates modern React components with JSX from your templates. Supports TypeScript, props handling, event management, and all template logic node types.

## Installation

```bash
npm install @js-template-engine/extension-react
```

## Quick Start

```typescript
import { ProcessingPipeline, ExtensionRegistry } from '@js-template-engine/core';
import { ReactExtension } from '@js-template-engine/extension-react';
import { TemplateNode } from '@js-template-engine/types';

// Initialize the processing pipeline with React extension
const registry = new ExtensionRegistry();
registry.registerFramework(new ReactExtension());
const pipeline = new ProcessingPipeline(registry);

// Define your template
const template: TemplateNode[] = [
  {
    type: 'element',
    tag: 'div',
    attributes: {
      className: 'container'
    },
    children: [
      {
        type: 'element',
        tag: 'h1',
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

// Process the template as a React component
const result = await pipeline.process(template, {
  framework: 'react',
  component: { name: 'MyComponent' }
});

console.log(result.output); // React JSX code
```

## Features

- **React Component Generation**: Creates modern React functional components with JSX
- **TypeScript Support**: Full TypeScript interface generation and type safety
- **Props Handling**: Automatic props interface generation and runtime validation
- **Event Management**: JSX expression attributes for event handling
- **Template Logic Support**: Complete support for all node types:
  - Element nodes → JSX elements
  - Comment nodes → JSX comments `{/* */}`
  - Fragment nodes → `<React.Fragment>`
  - Conditional nodes → JSX ternary expressions
  - Loop nodes → `Array.map()` with keys
  - Slot nodes → Props-based content
- **Style Integration**: Works seamlessly with BEM and Tailwind extensions

## Usage Examples

### Basic Component

```typescript
const template: TemplateNode[] = [
  {
    type: 'element',
    tag: 'button',
    attributes: {
      className: 'btn btn-primary'
    },
    children: [
      { type: 'text', content: 'Click me!' }
    ]
  }
];

const result = await pipeline.process(template, {
  framework: 'react',
  component: { name: 'Button' }
});
```

**Generated Output:**
```jsx
import React from 'react';

const Button: React.FC = () => {
  return (
    <button className="btn btn-primary">Click me!</button>
  );
};

export default Button;
```

### Component with Props

```typescript
const template: TemplateNode[] = [
  {
    type: 'element',
    tag: 'div',
    attributes: {
      className: 'card'
    },
    children: [
      {
        type: 'element',
        tag: 'h2',
        children: [{ type: 'text', content: '{props.title}' }]
      }
    ]
  }
];

const result = await pipeline.process(template, {
  framework: 'react',
  component: {
    name: 'Card',
    props: {
      title: 'string',
      isActive: 'boolean'
    }
  }
});
```

**Generated Output:**
```jsx
import React from 'react';

interface CardProps {
  title: string;
  isActive: boolean;
}

const Card: React.FC<CardProps> = (props) => {
  return (
    <div className="card">
      <h2>{props.title}</h2>
    </div>
  );
};

export default Card;
```

### Template Logic Examples

#### Comment Nodes
```typescript
{
  type: 'comment',
  content: 'This explains the next section'
}
```
**Output:** `{/* This explains the next section */}`

#### Fragment Nodes
```typescript
{
  type: 'fragment',
  children: [
    { type: 'element', tag: 'h1', children: [{ type: 'text', content: 'Title' }] },
    { type: 'element', tag: 'p', children: [{ type: 'text', content: 'Content' }] }
  ]
}
```
**Output:** `<React.Fragment><h1>Title</h1><p>Content</p></React.Fragment>`

#### Conditional Nodes
```typescript
{
  type: 'if',
  condition: 'isVisible',
  then: [
    { type: 'element', tag: 'div', children: [{ type: 'text', content: 'Visible!' }] }
  ],
  else: [
    { type: 'element', tag: 'div', children: [{ type: 'text', content: 'Hidden!' }] }
  ]
}
```
**Output:** `{props.isVisible ? (<div>Visible!</div>) : (<div>Hidden!</div>)}`

#### Loop Nodes
```typescript
{
  type: 'for',
  items: 'items',
  item: 'item',
  index: 'index',
  key: 'item.id',
  children: [
    { type: 'element', tag: 'li', children: [{ type: 'text', content: '{item.name}' }] }
  ]
}
```
**Output:** `{props.items.map((item, index) => <li key={item.id}>{item.name}</li>)}`

### Event Handling

```typescript
{
  type: 'element',
  tag: 'button',
  extensions: {
    react: {
      expressionAttributes: {
        onClick: 'props.handleClick',
        onMouseOver: 'props.handleHover'
      }
    }
  }
}
```
**Output:** `<button onClick={props.handleClick} onMouseOver={props.handleHover}>...</button>`

## API Reference

### ReactExtension

```typescript
class ReactExtension {
  constructor(verbose?: boolean);
  
  readonly key = 'react';
  
  nodeHandler(node: TemplateNode): TemplateNode;
}
```

**Parameters:**
- `verbose` (optional): Enable detailed logging for debugging

### React Node Extension

```typescript
interface ReactNodeExtension {
  props?: Record<string, any>;
  events?: Record<string, string>;
  expressionAttributes?: Record<string, string>;
  fragment?: boolean;
}
```

## Configuration

### Component Options

```typescript
{
  component: {
    name: 'MyComponent',        // Component name (required)
    props: {                    // Props definition
      title: 'string',
      count: 'number',
      items: 'Array<string>'
    },
    typescript: true,           // Enable TypeScript (default: true)
    imports: [                  // Additional imports
      'import { useState } from "react"'
    ]
  }
}
```

### Extension Configuration

```typescript
const extension = new ReactExtension(true); // Enable verbose logging
```

## Integration

### With BEM Extension

```typescript
import { BemExtension } from '@js-template-engine/extension-bem';

const registry = new ExtensionRegistry();
registry.registerStyling(new BemExtension());
registry.registerFramework(new ReactExtension());

// BEM classes are automatically applied to React components
```

### With Tailwind Extension

```typescript
import { TailwindExtension } from '@js-template-engine/extension-tailwind';

const registry = new ExtensionRegistry();
registry.registerStyling(new TailwindExtension());
registry.registerFramework(new ReactExtension());

// Tailwind classes are processed and applied to React components
```

## TypeScript Support

The React extension provides comprehensive TypeScript support:

- **Automatic Interface Generation**: Props are converted to TypeScript interfaces
- **Type-safe Component Props**: Full type checking for component properties
- **JSX Type Safety**: Proper JSX element typing
- **Generic Support**: Support for generic prop types

```typescript
// Generated TypeScript interface
interface MyComponentProps {
  title: string;
  count: number;
  items?: Array<string>;
  onAction?: (value: string) => void;
}
```

## Contributing

Please see the main [Contributing Guide](../../CONTRIBUTING.md) for development setup and guidelines.

## License

MIT - See [LICENSE](../../LICENSE) for details.