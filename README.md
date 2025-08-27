# JS Template Engine 2.0

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-16%2B-green.svg)](https://nodejs.org/)
[![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen.svg)](#)

> **A production-ready, concept-driven template engine that transforms structured JSON/TypeScript templates into framework-specific components across React, Vue, Svelte, and more.**

Transform your UI component definitions once and render them anywhere. Perfect for design systems, component libraries, and maintaining consistency across multiple frameworks.

## 🚀 Quick Start

### Global CLI Installation

```bash
npm install -g @js-template-engine/cli
```

### Basic Usage

```bash
# Generate a React button component
js-template-engine render examples/button.json --framework react --styling bem --output ./components

# Generate Vue navigation with Tailwind
js-template-engine render examples/navigation.json --framework vue --styling tailwind --output ./components
```

### Simple Template Example

```typescript
// Define once in JSON/TypeScript
const buttonTemplate = [
  {
    tag: 'button',
    attributes: { 
      class: 'btn',
      type: 'button' 
    },
    children: [
      { type: 'text', content: 'Click me' }
    ],
    extensions: {
      react: {
        expressionAttributes: {
          onClick: 'props.onClick',
          className: 'clsx("btn", props.variant && `btn-${props.variant}`)'
        }
      },
      vue: {
        expressionAttributes: {
          '@click': 'onClick',
          ':class': '`btn ${variant ? `btn-${variant}` : ""}`'
        }
      }
    }
  }
];
```

**Outputs:**

```tsx
// React Output
export interface ButtonProps {
  onClick?: () => void;
  variant?: string;
}

export function Button({ onClick, variant }: ButtonProps) {
  return (
    <button 
      type="button"
      onClick={onClick}
      className={clsx("btn", variant && `btn-${variant}`)}
    >
      Click me
    </button>
  );
}
```

```vue
<!-- Vue Output -->
<template>
  <button 
    type="button"
    @click="onClick"
    :class="`btn ${variant ? `btn-${variant}` : ''}`"
  >
    Click me
  </button>
</template>

<script setup lang="ts">
interface Props {
  onClick?: () => void;
  variant?: string;
}

defineProps<Props>();
</script>
```

## ✨ Key Features

### 🎯 **Framework Agnostic**
Write component logic once, render as React, Vue, Svelte, or plain HTML. Same component definition, multiple outputs.

### 🏗️ **Concept-Driven Architecture**  
Built on ProcessingPipeline + ExtensionRegistry architecture with intelligent concept processing for events, styling, conditionals, and more.

### 🎨 **Styling Flexibility**
Support for BEM methodology, Tailwind CSS, CSS modules, or inline styles. Mix and match as needed.

### 🔧 **Production Ready**
TypeScript-first development, comprehensive test coverage, and battle-tested in real-world applications.

### 📦 **Complete Toolchain**
- **CLI** - Command-line interface for rapid development
- **Create UI Kit** - Scaffold complete component libraries
- **Extensions** - React, Vue, Svelte, BEM, Tailwind support built-in

## 📦 Available Packages

| Package | Purpose | Version |
|---------|---------|---------|
| **[@js-template-engine/cli](./packages/cli)** | Command-line interface for template processing | ![1.0.1](https://img.shields.io/badge/version-1.0.1-blue) |
| **[create-ui-kit](./packages/create-ui-kit)** | Scaffold framework-agnostic UI component libraries | ![0.1.0](https://img.shields.io/badge/version-0.1.0-blue) |
| **[@js-template-engine/core](./packages/core)** | Core template processing engine and pipeline | ![1.0.1](https://img.shields.io/badge/version-1.0.1-blue) |
| **[@js-template-engine/extension-react](./packages/extension-react)** | React/JSX component generation | ![1.0.1](https://img.shields.io/badge/version-1.0.1-blue) |
| **[@js-template-engine/extension-vue](./packages/extension-vue)** | Vue component generation | ![1.0.1](https://img.shields.io/badge/version-1.0.1-blue) |
| **[@js-template-engine/extension-svelte](./packages/extension-svelte)** | Svelte component generation | ![1.0.1](https://img.shields.io/badge/version-1.0.1-blue) |
| **[@js-template-engine/extension-bem](./packages/extension-bem)** | BEM methodology and SCSS generation | ![1.0.1](https://img.shields.io/badge/version-1.0.1-blue) |
| **[@js-template-engine/extension-tailwind](./packages/extension-tailwind)** | Tailwind CSS utility generation | ![1.0.1](https://img.shields.io/badge/version-1.0.1-blue) |

## 💡 Real-World Examples

### Design System Components
Perfect for creating consistent design systems that work across multiple frameworks:

```bash
# Generate design system button for React + Tailwind
js-template-engine render design-system/button.json --framework react --styling tailwind

# Same button for Vue + BEM  
js-template-engine render design-system/button.json --framework vue --styling bem
```

### Marketing Landing Pages
Create responsive marketing components that can be rendered in any framework:

```bash
# Hero section with conditional content
js-template-engine render marketing/hero.json --framework react --styling tailwind

# Feature cards with dynamic styling
js-template-engine render marketing/features.json --framework vue --styling bem
```

### Dashboard Interfaces
Build complex dashboard components with consistent behavior:

```bash
# Data table with sorting and filtering
js-template-engine render dashboard/data-table.json --framework react --styling tailwind

# Chart components with responsive design
js-template-engine render dashboard/charts.json --framework vue --styling css
```

## 🏗️ Advanced Template Features

### Template Logic Support
Handle complex scenarios with built-in template logic concepts:

```typescript
// Conditional rendering
{
  type: 'if',
  condition: 'user.isAuthenticated',
  then: [
    { tag: 'div', children: [{ type: 'text', content: 'Welcome back!' }] }
  ],
  else: [
    { tag: 'div', children: [{ type: 'text', content: 'Please log in' }] }
  ]
}

// Loop rendering
{
  type: 'for',
  items: 'navigation.items',
  item: 'navItem',
  key: 'navItem.id',
  children: [
    { tag: 'a', attributes: { href: '{{navItem.url}}' }, children: [
      { type: 'text', content: '{{navItem.title}}' }
    ]}
  ]
}

// Reusable slots
{
  type: 'slot',
  name: 'header',
  fallback: [{ type: 'text', content: 'Default Header' }]
}
```

### Event Handling
Unified event handling that translates appropriately per framework:

```typescript
// Template definition
{
  tag: 'button',
  attributes: {
    onclick: 'handleSubmit'  // Generic event handler
  },
  extensions: {
    react: {
      expressionAttributes: {
        onClick: 'props.onSubmit'  // React-specific
      }
    },
    vue: {
      expressionAttributes: {
        '@click': 'onSubmit'  // Vue-specific
      }
    }
  }
}
```

## 🛠️ Integration Examples

### With Build Tools

```bash
# Vite integration
js-template-engine render src/components/**/*.json --framework react --output src/components/generated

# Webpack integration  
js-template-engine render components/**/*.json --framework vue --styling tailwind --output dist/components
```

### With Package Managers

```bash
# Using npm
npm run build:components

# Using yarn
yarn build:components

# Using pnpm (recommended)
pnpm build:components
```

## 📚 Documentation & Examples

- **[CLI Documentation](./packages/cli/README.md)** - Complete CLI usage guide with progressive examples
- **[Create UI Kit Guide](./packages/create-ui-kit/README.md)** - Build and distribute component libraries  
- **[Extension Development](./docs/extending.md)** - Create custom framework extensions
- **[Examples Repository](./packages/examples)** - Real-world template examples and outputs

## 🎯 Use Cases

### **Component Library Authors**
- Maintain single source of truth for component definitions
- Support multiple frameworks without duplicating logic
- Generate consistent TypeScript interfaces automatically
- Build comprehensive documentation from templates

### **Design System Teams**
- Enforce consistent styling and behavior patterns
- Generate framework-specific implementations automatically
- Maintain design tokens across all generated components
- Enable easy updates across entire component ecosystem

### **Frontend Developers**
- Prototype components rapidly across different frameworks
- Convert legacy components to modern frameworks
- Experiment with different styling approaches
- Generate boilerplate component code quickly

## 🔧 Requirements

- **Node.js** 16+ (18+ recommended)
- **TypeScript** 5.0+ (optional but recommended)
- **Package Manager** - npm, yarn, or pnpm

## 🏆 Why Choose JS Template Engine 2.0?

- **Battle-Tested**: Production-ready with comprehensive test coverage
- **Type-Safe**: Full TypeScript support with generated interfaces
- **Extensible**: Plugin architecture for custom framework support
- **Performance**: Optimized processing pipeline with intelligent caching
- **Developer Experience**: Rich CLI tools, helpful error messages, and thorough documentation
- **Future-Proof**: Add new framework support without changing existing templates

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **GitHub Issues**: [Report bugs and request features](https://github.com/djurnamn/js-template-engine/issues)
- **GitHub Discussions**: [Community discussions and Q&A](https://github.com/djurnamn/js-template-engine/discussions)
- **Documentation**: [Comprehensive guides and API reference](./docs)

---

**Built with ❤️ by [Björn Djurnamn](https://github.com/djurnamn) and the JS Template Engine community**