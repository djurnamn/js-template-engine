# Vue Extension

[![npm version](https://img.shields.io/npm/v/@js-template-engine/extension-vue.svg)](https://www.npmjs.com/package/@js-template-engine/extension-vue)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Vue.js framework extension for the JS Template Engine that transforms templates into Vue Single File Components (SFCs) with proper TypeScript support and Vue 3 Composition API integration.

## Installation

```bash
npm install @js-template-engine/extension-vue
```

## Quick Start

```typescript
import { ProcessingPipeline, ExtensionRegistry } from '@js-template-engine/core';
import { VueExtension } from '@js-template-engine/extension-vue';
import { TemplateNode } from '@js-template-engine/types';

// Initialize the processing pipeline with Vue extension
const registry = new ExtensionRegistry();
registry.registerFramework(new VueExtension());
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
            content: 'Hello, Vue!'
          }
        ]
      }
    ]
  }
];

// Process the template as a Vue component
const result = await pipeline.process(template, {
  framework: 'vue',
  component: { name: 'HelloWorld' }
});

console.log(result.output); // Vue SFC code
```

## Features

- **Vue SFC Generation**: Creates modern Vue Single File Components
- **TypeScript Support**: Full TypeScript mode with interface generation
- **Composition API**: Modern Vue 3 Composition API with setup script support
- **Props Handling**: Automatic props interface and runtime validation
- **Template Logic Support**: Complete support for all node types:
  - Element nodes → Vue template elements
  - Comment nodes → HTML comments `<!-- -->`
  - Fragment nodes → Multiple root elements
  - Conditional nodes → `v-if`/`v-else` directives
  - Loop nodes → `v-for` directives with keys
  - Slot nodes → Vue slot system
- **Vue Directives**: Automatic conversion of template logic to Vue directives
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
  framework: 'vue',
  component: { name: 'Button' }
});
```

**Generated Output:**
```vue
<template>
  <button class="btn btn-primary">Click me!</button>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  name: "Button"
});
</script>
```

### Component with Props (Options API)

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
        children: [{ type: 'text', content: '{{ title }}' }]
      }
    ]
  }
];

const result = await pipeline.process(template, {
  framework: 'vue',
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
```vue
<template>
  <div class="card">
    <h2>{{ title }}</h2>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

interface CardProps {
  title: string;
  isActive: boolean;
}

export default defineComponent({
  name: "Card",
  props: {
    title: { type: String, required: true },
    isActive: { type: Boolean, required: true }
  }
});
</script>
```

### Component with Setup Script (Composition API)

```typescript
const result = await pipeline.process(template, {
  framework: 'vue',
  component: {
    name: 'Card',
    props: {
      title: 'string'
    },
    typescript: true,
    useSetupScript: true
  }
});
```

**Generated Output:**
```vue
<template>
  <div class="card">
    <h2>{{ title }}</h2>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title: string;
}

defineProps<Props>();
</script>
```

### Template Logic Examples

#### Comment Nodes
```typescript
{
  type: 'comment',
  content: 'This is a Vue comment'
}
```
**Output:** `<!-- This is a Vue comment -->`

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
**Output:** Multiple elements without wrapper div

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
```vue
<div v-if="isVisible">Visible!</div>
<div v-else>Hidden!</div>
```

#### Loop Nodes
```typescript
{
  type: 'for',
  items: 'items',
  item: 'item',
  index: 'index',
  children: [
    { type: 'element', tag: 'li', children: [{ type: 'text', content: '{{ item.name }}' }] }
  ]
}
```
**Output:** `<li v-for="(item, index) in items" :key="index">{{ item.name }}</li>`

## API Reference

### VueExtension

```typescript
class VueExtension {
  constructor(verbose?: boolean);
  
  readonly key = 'vue';
  
  nodeHandler(node: TemplateNode): TemplateNode;
}
```

**Parameters:**
- `verbose` (optional): Enable detailed logging for debugging

### Vue Node Extension

```typescript
interface VueNodeExtension {
  directive?: string;
  condition?: string;
  iteration?: {
    items: string;
    item: string;
    index?: string;
    key?: string;
  };
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
    typescript: true,           // Enable TypeScript mode
    useSetupScript: false,      // Use setup script syntax (default: false)
    imports: [                  // Custom imports
      'import { ref } from "vue"'
    ]
  }
}
```

### Extension Configuration

```typescript
const extension = new VueExtension(true); // Enable verbose logging
```

## Integration

### With BEM Extension

```typescript
import { BemExtension } from '@js-template-engine/extension-bem';

const registry = new ExtensionRegistry();
registry.registerStyling(new BemExtension());
registry.registerFramework(new VueExtension());

// BEM classes are automatically applied to Vue templates
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
registry.registerFramework(new VueExtension());

// Tailwind classes are processed and applied to Vue components
```

## TypeScript Support

The Vue extension provides comprehensive TypeScript support:

- **Automatic Interface Generation**: Props are converted to TypeScript interfaces
- **Options API Types**: Full type safety with Options API components
- **Composition API Types**: Modern setup script with `defineProps<T>()`
- **Runtime Validation**: Props validation with Vue runtime checks

```typescript
// Generated interface for Options API
interface MyComponentProps {
  title: string;
  count: number;
  items?: Array<string>;
}

// Generated props validation
props: {
  title: { type: String, required: true },
  count: { type: Number, required: true },
  items: { type: Array, required: false }
}
```

## Vue Directives

The extension automatically converts template conditions and loops to appropriate Vue directives:

- `if` nodes → `v-if` / `v-else` / `v-else-if` directives
- `for` nodes → `v-for` directives with proper key binding
- Conditional expressions → Vue template syntax `{{ }}`
- Event handling → `@click`, `@input`, etc.

## Contributing

Please see the main [Contributing Guide](../../CONTRIBUTING.md) for development setup and guidelines.

## License

MIT - See [LICENSE](../../LICENSE) for details.