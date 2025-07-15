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

// Render the template as a React component
await engine.render(template, {
  name: 'MyComponent',
  outputDir: './dist',
  fileExtension: '.tsx'
});
```

## 🔌 Features

- React component generation with JSX
- TypeScript support with proper interfaces
- Props handling and expression attributes
- Event handling with JSX expressions
- Style integration
- **Full support for all node types:**
  - Element nodes → JSX elements
  - Comment nodes → JSX comments `{/* */}`
  - Fragment nodes → `<React.Fragment>`
  - Conditional nodes → JSX ternary expressions
  - Loop nodes → `Array.map()` with keys
  - Slot nodes → Props-based content

## 🎯 Template Logic Node Types

### Comment Nodes
```typescript
{
  type: 'comment',
  content: 'This explains the next section'
}
```
**Output:** `{/* This explains the next section */}`

### Fragment Nodes
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

### Conditional Nodes
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

### Loop Nodes
```typescript
{
  type: 'for',
  items: 'items',
  item: 'item',
  index: 'index',
  key: 'item.id',
  children: [
    { type: 'element', tag: 'li', children: [{ type: 'text', content: 'Item' }] }
  ]
}
```
**Output:** `{props.items.map((item, index) => <React.Fragment key={item.id}><li>Item</li></React.Fragment>)}`

### Expression Attributes
```typescript
{
  type: 'element',
  tag: 'button',
  extensions: {
    react: {
      expressionAttributes: {
        onClick: 'props.handleClick'
      }
    }
  }
}
```
**Output:** `<button onClick={props.handleClick}>...</button>`

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