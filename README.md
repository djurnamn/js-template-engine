# 📦 JS Template Engine

> A framework-agnostic, extensible engine that turns structured JSON/JS/TS templates into frontend components across multiple platforms (HTML, React, BEM, etc.).

## ✨ Why Use This?

* **Write Once, Render Anywhere**
  Define your UI structure once in JSON or JS, and render it as React, HTML, or BEM-styled markup.

* **Ideal for Component Libraries**
  Maintain a single source of truth for your components across multiple frameworks or environments.

* **Extensible by Design**
  Build custom extensions for Vue, Svelte, Angular, or any templating system.

## 🚀 Getting Started

### 1. Install

```bash
pnpm install
pnpm build
```

### 2. Define a Template

```ts
const myComponent = [
  {
    tag: 'button',
    attributes: { class: 'btn', onclick: 'handleClick' },
    children: [{ type: 'text', content: 'Click me' }],
    extensions: {
      react: {
        tag: 'DefaultButton',
        expressionAttributes: {
          onClick: 'handleClick',
        },
      },
    },
  },
];

// Template with slots for reusable components
const cardTemplate = [
  {
    tag: 'div',
    attributes: { class: 'card' },
    children: [
      {
        tag: 'header',
        children: [
          {
            type: 'slot',
            name: 'header',
            fallback: [{ type: 'text', content: 'Default Header' }]
          }
        ]
      },
      {
        tag: 'main',
        children: [
          {
            type: 'slot', 
            name: 'content'
          }
        ]
      }
    ]
  }
];
```

### 3. Render with CLI

```bash
pnpm cli render src/button.json --ext react bem
```

Or via API:

```ts
const engine = new TemplateEngine([new ReactExtension(), new BemExtension()]);
await engine.render(myComponent, {
  name: 'MyComponent',
  outputDir: 'dist/react',
  extensions: [new ReactExtension()],
});
```

## 📝 Node Types Reference

The JS Template Engine supports multiple node types for building rich, dynamic templates:

### Basic Node Types

Structural elements that form the foundation of templates:

### Element Nodes
Standard HTML/component elements with attributes and children:

```ts
{
  type: 'element',  // or omit for default
  tag: 'div',
  attributes: { class: 'container', id: 'main' },
  children: [/* child nodes */]
}
```

### Text Nodes
Simple text content:

```ts
{
  type: 'text',
  content: 'Hello World'
}
```

### Slot Nodes
Reusable content placeholders:

```ts
{
  type: 'slot',
  name: 'header',
  fallback: [{ type: 'text', content: 'Default content' }]
}
// React: {props.header || 'Default content'}
// Vue: <slot name="header">Default content</slot>
```

## Template Logic Node Types

Advanced nodes that add logical capabilities, control flow, and semantic meaning to templates:

### Comment Nodes
Comments that render appropriately for each framework:

```ts
{
  type: 'comment',
  content: 'This is a helpful comment'
}
// React: {/* This is a helpful comment */}
// Vue/HTML: <!-- This is a helpful comment -->
```

### Fragment Nodes
Grouping wrapper without extra DOM elements:

```ts
{
  type: 'fragment',
  children: [
    { type: 'element', tag: 'h1', children: [{ type: 'text', content: 'Title' }] },
    { type: 'element', tag: 'p', children: [{ type: 'text', content: 'Content' }] }
  ]
}
// React: <React.Fragment>...</React.Fragment>
// Vue: Multiple elements without wrapper
```

### Conditional Nodes
Dynamic content based on conditions:

```ts
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
// React: {props.isVisible ? (<div>Visible!</div>) : (<div>Hidden!</div>)}
// Vue: <div v-if="isVisible">Visible!</div><div v-else>Hidden!</div>
```

### Loop Nodes
Iterate over collections:

```ts
{
  type: 'for',
  items: 'items',
  item: 'item',
  index: 'index',
  key: 'item.id',
  children: [
    { type: 'element', tag: 'li', children: [{ type: 'text', content: 'List item' }] }
  ]
}
// React: {props.items.map((item, index) => <React.Fragment key={item.id}>...</React.Fragment>)}
// Vue: <li v-for="(item, index) in items" :key="item.id">List item</li>
```

## 📂 Project Structure

```txt
packages/
├── core                # Core engine logic
├── cli                 # CLI tool
├── extension-react     # JSX-specific transformations
├── extension-bem       # BEM + SCSS output
├── types               # Shared TypeScript interfaces
├── examples            # Usage examples
```

## 🔌 Writing Your Own Extension

To build a custom extension:

```ts
export class MyExtension implements Extension {
  key = 'my';
  nodeHandler(node) { /* mutate or enhance nodes */ }
  rootHandler(html, options) { return wrappedHtml; }
}
```

Then use:

```ts
new TemplateEngine([new MyExtension()]);
```

Want full plugin documentation? See [`docs/extending.md`](docs/extending.md)

## 📸 Output Examples

| Source JSON   | React Output             | HTML Output                             |
| ------------- | ------------------------ | --------------------------------------- |
| `button.json` | `DefaultButton` w/ props | `<button class="btn">Click me</button>` |
| Slot template | `{props.header}` prop    | `<slot name="header">Default</slot>`    |

## 📌 Roadmap Ideas

* [ ] Vue / Svelte / Angular extensions
* [ ] Web-based playground
* [ ] Plugin registry or auto-loader
* [ ] Live preview / HMR dev mode
