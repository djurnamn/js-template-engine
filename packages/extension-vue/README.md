# @js-template-engine/extension-vue

A Vue extension for JS Template Engine that transforms templates into Vue Single File Components (SFCs) with proper TypeScript support and Vue 3 Composition API integration.

## 📦 Installation

```bash
pnpm add @js-template-engine/extension-vue
```

## 🚀 Usage

```typescript
import { TemplateEngine } from '@js-template-engine/core';
import { VueExtension } from '@js-template-engine/extension-vue';
import type { ExtendedTemplate } from '@js-template-engine/types';

// Initialize the engine with Vue extension
const engine = new TemplateEngine([new VueExtension()]);

// Define your template
const template: ExtendedTemplate = {
  template: [
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
  ],
  component: {
    name: 'HelloWorld',
    props: {
      title: 'string',
      count: 'number'
    },
    typescript: true
  }
};

// Render the component
await engine.render(template, {
  language: 'javascript',
  outputDir: 'dist/vue'
});
```

## 🎯 Features

### TypeScript Support
The Vue extension supports both JavaScript and TypeScript modes:

**TypeScript Component:**
```vue
<template>
  <div class="container">
    <h1>{{ title }}</h1>
    <p>Count: {{ count }}</p>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

interface HelloWorldProps {
  title: string;
  count: number;
}

export default defineComponent({
  name: "HelloWorld",
  props: {
    title: { type: String, required: true },
    count: { type: Number, required: true }
  }
});
</script>
```

**Setup Script Support:**
When `useSetupScript: true` is specified, generates modern Composition API syntax:

```vue
<template>
  <div class="container">
    <h1>{{ title }}</h1>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title: string;
}

defineProps<Props>();
</script>
```

### Template Logic Node Types

The Vue extension handles all modern template node types:

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
  ]
}
```
**Output:** `<div v-if="isVisible">Visible!</div>`

#### Loop Nodes
```typescript
{
  type: 'for',
  items: 'items',
  item: 'item',
  index: 'index',
  children: [
    { type: 'element', tag: 'li', children: [{ type: 'text', content: 'Item' }] }
  ]
}
```
**Output:** `<li v-for="(item, index) in items" :key="index">Item</li>`

### Vue Directives

The extension automatically converts template conditions and loops to appropriate Vue directives:

- `if` nodes → `v-if` / `v-else` directives
- `for` nodes → `v-for` directives with proper key binding
- Conditional expressions → Vue template syntax

### Props Interface Generation

The Vue extension generates proper TypeScript interfaces and runtime prop definitions:

```typescript
// Template definition
component: {
  name: 'MyComponent',
  props: {
    title: 'string',
    isActive: 'boolean',
    items: 'Array<string>'
  },
  typescript: true
}
```

**Generated Interface:**
```typescript
interface MyComponentProps {
  title: string;
  isActive: boolean;
  items: Array<string>;
}
```

**Generated Runtime Props:**
```typescript
props: {
  title: { type: String, required: true },
  isActive: { type: Boolean, required: true },
  items: { type: Array, required: true }
}
```

## 🔧 Configuration Options

```typescript
const template = {
  component: {
    name: 'ComponentName',
    typescript: true,           // Enable TypeScript mode
    useSetupScript: false,      // Use setup script syntax (default: false)
    props: {                    // Component props definition
      title: 'string'
    },
    imports: [                  // Custom imports
      'import { ref } from "vue"'
    ]
  }
};
```

## 🎨 Integration with Other Extensions

The Vue extension works seamlessly with other extensions:

### With BEM Extension
```typescript
const engine = new TemplateEngine([
  new BemExtension(),
  new VueExtension()
]);

// BEM classes are automatically applied to Vue templates
const template = {
  template: [{
    type: 'element',
    tag: 'div',
    extensions: {
      bem: { block: 'card', modifiers: ['primary'] }
    }
  }]
};
// Output: <div class="card card--primary">
```

## 📚 API Reference

### VueExtension Constructor

```typescript
new VueExtension(verbose?: boolean)
```

- `verbose` (optional): Enable detailed logging for debugging

### Supported Template Properties

- `component.name`: Component name (required)
- `component.typescript`: Enable TypeScript mode
- `component.useSetupScript`: Use setup script syntax
- `component.props`: Props definition object
- `component.imports`: Array of import statements

## 🧪 Testing

The Vue extension includes comprehensive tests covering:

- Basic component generation
- TypeScript interface generation
- Props handling (both Options API and setup script)
- New node types (comment, fragment, if, for)
- Integration with other extensions
- Error handling

Run tests:
```bash
cd packages/extension-vue
pnpm test
```

## 🤝 Contributing

Issues and pull requests are welcome! Please see the main repository's contributing guidelines.

## 📄 License

This project is licensed under the MIT License.