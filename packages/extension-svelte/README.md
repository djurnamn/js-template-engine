# Svelte Extension

[![npm version](https://img.shields.io/npm/v/@js-template-engine/extension-svelte.svg)](https://www.npmjs.com/package/@js-template-engine/extension-svelte)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Svelte framework extension for the JS Template Engine that transforms templates into Svelte components with proper TypeScript support and modern Svelte syntax.

## Installation

```bash
npm install @js-template-engine/extension-svelte
```

## Quick Start

```typescript
import { ProcessingPipeline, ExtensionRegistry } from '@js-template-engine/core';
import { SvelteExtension } from '@js-template-engine/extension-svelte';
import { TemplateNode } from '@js-template-engine/types';

// Initialize the processing pipeline with Svelte extension
const registry = new ExtensionRegistry();
registry.registerFramework(new SvelteExtension());
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
        type: 'element',
        tag: 'h1',
        children: [
          {
            type: 'text',
            content: 'Hello, Svelte!'
          }
        ]
      }
    ]
  }
];

// Process the template as a Svelte component
const result = await pipeline.process(template, {
  framework: 'svelte',
  component: { name: 'HelloWorld' }
});

console.log(result.output); // Svelte component code
```

## Features

- **Svelte Component Generation**: Creates modern Svelte components with reactive syntax
- **TypeScript Support**: Full TypeScript mode with interface generation
- **Props Handling**: Svelte export syntax for component properties
- **Reactive Statements**: Support for reactive variables and computed values
- **Template Logic Support**: Complete support for all node types:
  - Element nodes → Svelte template elements
  - Comment nodes → HTML comments `<!-- -->`
  - Fragment nodes → Multiple root elements
  - Conditional nodes → `{#if}` blocks
  - Loop nodes → `{#each}` blocks with keys
  - Slot nodes → Svelte slot system
- **Svelte Directives**: Automatic conversion of template logic to Svelte directives
- **Style Integration**: Works seamlessly with BEM and Tailwind extensions

## Usage Examples

### Basic Component

```typescript
const template: TemplateNode[] = [
  {
    type: 'element',
    tag: 'button',
    attributes: {
      class: 'btn btn-primary'
    },
    children: [
      { type: 'text', content: 'Click me!' }
    ]
  }
];

const result = await pipeline.process(template, {
  framework: 'svelte',
  component: { name: 'Button' }
});
```

**Generated Output:**
```svelte
<button class="btn btn-primary">Click me!</button>
```

### Component with Props

```typescript
const template: TemplateNode[] = [
  {
    type: 'element',
    tag: 'div',
    attributes: {
      class: 'card'
    },
    children: [
      {
        type: 'element',
        tag: 'h2',
        children: [{ type: 'text', content: '{title}' }]
      }
    ]
  }
];

const result = await pipeline.process(template, {
  framework: 'svelte',
  component: {
    name: 'Card',
    props: {
      title: 'string',
      isActive: 'boolean'
    },
    typescript: true
  }
});
```

**Generated Output:**
```svelte
<script lang="ts">
  export let title: string;
  export let isActive: boolean;
</script>

<div class="card">
  <h2>{title}</h2>
</div>
```

### Component with Reactivity

```typescript
const result = await pipeline.process(template, {
  framework: 'svelte',
  component: {
    name: 'Counter',
    props: {
      initialCount: 'number'
    },
    typescript: true,
    reactive: {
      count: 'initialCount',
      doubled: '() => count * 2'
    }
  }
});
```

**Generated Output:**
```svelte
<script lang="ts">
  export let initialCount: number;
  
  let count = initialCount;
  $: doubled = count * 2;
</script>

<div>
  <p>Count: {count}</p>
  <p>Doubled: {doubled}</p>
</div>
```

### Template Logic Examples

#### Comment Nodes
```typescript
{
  type: 'comment',
  content: 'This is a Svelte comment'
}
```
**Output:** `<!-- This is a Svelte comment -->`

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
**Output:** Multiple elements without wrapper

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
**Output:** 
```svelte
{#if isVisible}
  <div>Visible!</div>
{:else}
  <div>Hidden!</div>
{/if}
```

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
**Output:** 
```svelte
{#each items as item, index (item.id)}
  <li>{item.name}</li>
{/each}
```

### Event Handling

```typescript
{
  type: 'element',
  tag: 'button',
  extensions: {
    svelte: {
      events: {
        click: 'handleClick',
        mouseover: 'handleHover'
      }
    }
  }
}
```
**Output:** `<button on:click={handleClick} on:mouseover={handleHover}>...</button>`

## API Reference

### SvelteExtension

```typescript
class SvelteExtension {
  constructor(verbose?: boolean);
  
  readonly key = 'svelte';
  
  nodeHandler(node: TemplateNode): TemplateNode;
}
```

**Parameters:**
- `verbose` (optional): Enable detailed logging for debugging

### Svelte Node Extension

```typescript
interface SvelteNodeExtension {
  events?: Record<string, string>;
  bindings?: Record<string, string>;
  directives?: Record<string, any>;
  reactive?: boolean;
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
    reactive: {                 // Reactive statements
      doubled: '() => count * 2',
      isEven: '() => count % 2 === 0'
    },
    stores: [                   // Svelte stores
      'import { writable } from "svelte/store"'
    ]
  }
}
```

### Extension Configuration

```typescript
const extension = new SvelteExtension(true); // Enable verbose logging
```

## Integration

### With BEM Extension

```typescript
import { BemExtension } from '@js-template-engine/extension-bem';

const registry = new ExtensionRegistry();
registry.registerStyling(new BemExtension());
registry.registerFramework(new SvelteExtension());

// BEM classes are automatically applied to Svelte components
const template: TemplateNode[] = [
  {
    type: 'element',
    tag: 'div',
    extensions: {
      bem: { block: 'card', modifiers: ['primary'] }
    }
  }
];
// Output: <div class="card card--primary">
```

### With Tailwind Extension

```typescript
import { TailwindExtension } from '@js-template-engine/extension-tailwind';

const registry = new ExtensionRegistry();
registry.registerStyling(new TailwindExtension());
registry.registerFramework(new SvelteExtension());

// Tailwind classes are processed and applied to Svelte components
```

## TypeScript Support

The Svelte extension provides comprehensive TypeScript support:

- **Typed Props**: Export statements with proper TypeScript types
- **Reactive Types**: Type-safe reactive statements and computed values
- **Event Types**: Proper event handler typing
- **Store Types**: TypeScript support for Svelte stores

```typescript
// Generated TypeScript props
export let title: string;
export let count: number = 0;
export let items: Array<string> = [];

// Generated reactive statements
$: doubled = count * 2;
$: isEven = count % 2 === 0;
```

## Svelte Features

### Reactive Statements

```typescript
// Reactive variable
$: doubled = count * 2;

// Reactive block
$: {
  console.log('Count changed:', count);
  document.title = `Count: ${count}`;
}
```

### Stores Integration

```svelte
<script lang="ts">
  import { writable } from 'svelte/store';
  
  export let initialValue: number;
  
  const count = writable(initialValue);
</script>

<p>Count: {$count}</p>
<button on:click={() => $count++}>Increment</button>
```

### Slots and Context

```svelte
<!-- Parent component -->
<div class="card">
  <slot name="header" />
  <slot />
  <slot name="footer" />
</div>

<!-- Child usage -->
<Card>
  <h2 slot="header">Title</h2>
  <p>Content goes here</p>
  <button slot="footer">Action</button>
</Card>
```

## Contributing

Please see the main [Contributing Guide](../../CONTRIBUTING.md) for development setup and guidelines.

## License

MIT - See [LICENSE](../../LICENSE) for details.