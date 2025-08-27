# Tailwind Extension

[![npm version](https://img.shields.io/npm/v/@js-template-engine/extension-tailwind.svg)](https://www.npmjs.com/package/@js-template-engine/extension-tailwind)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Tailwind CSS styling extension for the JS Template Engine that provides bi-directional conversion between Tailwind utility classes and CSS styles. Supports responsive breakpoints, pseudo-class variants, and multiple output strategies.

## Installation

```bash
npm install @js-template-engine/extension-tailwind
```

## Quick Start

```typescript
import { ProcessingPipeline, ExtensionRegistry } from '@js-template-engine/core';
import { TailwindExtension } from '@js-template-engine/extension-tailwind';
import { TemplateNode } from '@js-template-engine/types';

// Initialize the processing pipeline with Tailwind extension
const registry = new ExtensionRegistry();
registry.registerStyling(new TailwindExtension());
const pipeline = new ProcessingPipeline(registry);

// Define your template with Tailwind classes
const template: TemplateNode[] = [
  {
    type: 'element',
    tag: 'div',
    attributes: {
      class: 'bg-blue-500 text-white p-4 rounded-lg'
    },
    children: [
      {
        type: 'element',
        tag: 'h1',
        attributes: {
          class: 'text-xl font-bold mb-2'
        },
        children: [
          { type: 'text', content: 'Hello, Tailwind!' }
        ]
      }
    ]
  }
];

// Process the template
const result = await pipeline.process(template, {
  styling: 'tailwind',
  component: { name: 'MyComponent' }
});

console.log(result.output); // Generated code with processed Tailwind
```

## Features

- **Bi-directional Conversion**: Convert between Tailwind classes and CSS styles
- **Multiple Output Strategies**: CSS, SCSS with @apply, or pass-through
- **Responsive Support**: Handle responsive breakpoints with media queries
- **Pseudo-class Variants**: Support for hover, focus, and other variants
- **Framework Integration**: Seamless integration with React, Vue, and Svelte extensions
- **Custom Configuration**: Support for custom Tailwind configurations
- **Type Safety**: Full TypeScript support with proper interfaces
- **Error Handling**: Configurable handling of unknown classes

## Usage Examples

### Basic Tailwind Classes

```typescript
const template: TemplateNode[] = [
  {
    type: 'element',
    tag: 'button',
    attributes: {
      class: 'bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded'
    },
    children: [
      { type: 'text', content: 'Click me!' }
    ]
  }
];
```

**CSS Output:**
```css
.button {
  background-color: #3b82f6;
  color: #ffffff;
  font-weight: 600;
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
  padding-left: 1rem;
  padding-right: 1rem;
  border-radius: 0.25rem;
}

.button:hover {
  background-color: #2563eb;
}
```

### Using Extension Properties

```typescript
const template: TemplateNode[] = [
  {
    type: 'element',
    tag: 'div',
    extensions: {
      tailwind: {
        class: 'bg-blue-500 text-white p-4',
        responsive: {
          md: 'text-lg p-6',
          lg: 'text-xl p-8'
        },
        variants: {
          hover: 'bg-blue-600',
          focus: 'outline-none ring-2 ring-blue-300'
        }
      }
    }
  }
];
```

**CSS Output:**
```css
.component {
  background-color: #3b82f6;
  color: #ffffff;
  padding: 1rem;
}

.component:hover {
  background-color: #2563eb;
}

.component:focus {
  outline: none;
  --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);
  --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(2px + var(--tw-ring-offset-width)) #93c5fd;
  box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000);
}

@media (min-width: 768px) {
  .component {
    font-size: 1.125rem;
    line-height: 1.75rem;
    padding: 1.5rem;
  }
}

@media (min-width: 1024px) {
  .component {
    font-size: 1.25rem;
    line-height: 1.75rem;
    padding: 2rem;
  }
}
```

### Responsive Design

```typescript
const template: TemplateNode[] = [
  {
    type: 'element',
    tag: 'div',
    attributes: {
      class: 'w-full sm:w-1/2 md:w-1/3 lg:w-1/4'
    }
  }
];
```

**CSS Output:**
```css
.responsive-div {
  width: 100%;
}

@media (min-width: 640px) {
  .responsive-div {
    width: 50%;
  }
}

@media (min-width: 768px) {
  .responsive-div {
    width: 33.333333%;
  }
}

@media (min-width: 1024px) {
  .responsive-div {
    width: 25%;
  }
}
```

## API Reference

### TailwindExtension

```typescript
class TailwindExtension {
  constructor(options?: TailwindExtensionOptions);
  
  readonly key = 'tailwind';
  
  nodeHandler(node: TemplateNode): TemplateNode;
  processStyles(concept: StylingConcept): StyleOutput;
  convertTailwindToCss(classes: string[]): StyleOutput;
  convertCssToTailwind(styles: Record<string, string>): { classes: string[]; remaining: Record<string, string> };
}
```

### Tailwind Node Extension

```typescript
interface TailwindNodeExtension {
  class?: string | string[];
  responsive?: Record<string, string | string[]>;
  variants?: Record<string, string | string[]>;
}
```

### Extension Options

```typescript
interface TailwindExtensionOptions {
  outputStrategy?: 'css' | 'scss-apply' | 'pass-through';
  config?: string | object;
  breakpoints?: Record<string, string>;
  unknownClassHandling?: 'warn' | 'error' | 'ignore';
  cssFallback?: 'inline' | 'custom-class' | 'ignore';
  customClassPrefix?: string;
}
```

## Configuration

### Basic Configuration

```typescript
const tailwindExtension = new TailwindExtension({
  outputStrategy: 'css',
  unknownClassHandling: 'warn',
  cssFallback: 'custom-class',
  customClassPrefix: 'custom'
});
```

### Custom Breakpoints

```typescript
const tailwindExtension = new TailwindExtension({
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px'
  }
});
```

### Tailwind Config Integration

```typescript
const tailwindExtension = new TailwindExtension({
  config: './tailwind.config.js'
});
```

## Output Strategies

### CSS Output (Default)

Converts Tailwind classes to standard CSS:

```css
.component {
  background-color: #3b82f6;
  color: #ffffff;
  padding: 1rem;
}

.component:hover {
  background-color: #2563eb;
}

@media (min-width: 768px) {
  .component {
    font-size: 1.125rem;
  }
}
```

### SCSS @apply Output

Generates SCSS with @apply directives:

```scss
.component {
  @apply bg-blue-500 text-white p-4;
  
  &:hover {
    @apply bg-blue-600;
  }
  
  @media (min-width: 768px) {
    @apply text-lg;
  }
}
```

### Pass-through Output

Keeps original Tailwind classes for build system processing:

```html
<div class="bg-blue-500 text-white p-4 hover:bg-blue-600 md:text-lg">
  Content
</div>
```

## Supported Utilities

### Layout
- **Display**: `block`, `inline`, `flex`, `grid`, `hidden`
- **Position**: `static`, `relative`, `absolute`, `fixed`, `sticky`
- **Overflow**: `overflow-hidden`, `overflow-scroll`, `overflow-auto`
- **Z-Index**: `z-0`, `z-10`, `z-50`

### Flexbox & Grid
- **Flex**: `flex-row`, `flex-col`, `flex-wrap`, `flex-nowrap`
- **Justify**: `justify-start`, `justify-center`, `justify-between`
- **Align**: `items-start`, `items-center`, `items-end`
- **Grid**: `grid-cols-1`, `grid-cols-12`, `gap-4`

### Spacing
- **Padding**: `p-4`, `px-6`, `py-2`, `pt-4`, `pr-2`, `pb-4`, `pl-2`
- **Margin**: `m-4`, `mx-auto`, `my-6`, `mt-2`, `mr-4`, `mb-6`, `ml-2`
- **Space Between**: `space-x-4`, `space-y-2`

### Sizing
- **Width**: `w-full`, `w-1/2`, `w-64`, `w-screen`
- **Height**: `h-full`, `h-screen`, `h-64`, `h-auto`
- **Min/Max**: `min-w-0`, `max-w-md`, `min-h-screen`, `max-h-64`

### Typography
- **Font Family**: `font-sans`, `font-serif`, `font-mono`
- **Font Size**: `text-xs`, `text-sm`, `text-lg`, `text-xl`
- **Font Weight**: `font-normal`, `font-bold`, `font-semibold`
- **Text Align**: `text-left`, `text-center`, `text-right`
- **Text Color**: `text-white`, `text-gray-800`, `text-blue-500`

### Backgrounds
- **Background Color**: `bg-red-500`, `bg-blue-500`, `bg-gray-100`
- **Background Size**: `bg-cover`, `bg-contain`, `bg-auto`
- **Background Position**: `bg-center`, `bg-top`, `bg-bottom`

### Borders
- **Border Width**: `border`, `border-2`, `border-4`, `border-0`
- **Border Color**: `border-red-500`, `border-blue-500`
- **Border Radius**: `rounded`, `rounded-lg`, `rounded-full`
- **Border Style**: `border-solid`, `border-dashed`, `border-dotted`

### Effects
- **Box Shadow**: `shadow`, `shadow-md`, `shadow-lg`, `shadow-xl`
- **Opacity**: `opacity-0`, `opacity-50`, `opacity-100`
- **Transform**: `transform`, `scale-50`, `rotate-45`, `translate-x-2`

### Responsive Breakpoints
- **sm**: 640px and up
- **md**: 768px and up  
- **lg**: 1024px and up
- **xl**: 1280px and up
- **2xl**: 1536px and up

### Pseudo-class Variants
- **hover**: `:hover` state
- **focus**: `:focus` state
- **active**: `:active` state
- **disabled**: `:disabled` state
- **first**: `:first-child`
- **last**: `:last-child`
- **odd**: `:nth-child(odd)`
- **even**: `:nth-child(even)`
- **group-hover**: Group hover states
- **dark**: Dark mode variants

## Integration

### With React Extension

```typescript
import { ReactExtension } from '@js-template-engine/extension-react';
import { TailwindExtension } from '@js-template-engine/extension-tailwind';

const registry = new ExtensionRegistry();
registry.registerStyling(new TailwindExtension());
registry.registerFramework(new ReactExtension());

// Tailwind classes are automatically processed for React components
```

### With Vue Extension

```typescript
import { VueExtension } from '@js-template-engine/extension-vue';
import { TailwindExtension } from '@js-template-engine/extension-tailwind';

const registry = new ExtensionRegistry();
registry.registerStyling(new TailwindExtension());
registry.registerFramework(new VueExtension());

// Tailwind classes are automatically processed for Vue components
```

### With Svelte Extension

```typescript
import { SvelteExtension } from '@js-template-engine/extension-svelte';
import { TailwindExtension } from '@js-template-engine/extension-tailwind';

const registry = new ExtensionRegistry();
registry.registerStyling(new TailwindExtension());
registry.registerFramework(new SvelteExtension());

// Tailwind classes are automatically processed for Svelte components
```

## Error Handling

### Unknown Class Handling

```typescript
const tailwindExtension = new TailwindExtension({
  unknownClassHandling: 'warn'    // 'warn', 'error', or 'ignore'
});
```

### CSS Fallback Options

```typescript
const tailwindExtension = new TailwindExtension({
  cssFallback: 'custom-class',    // 'inline', 'custom-class', or 'ignore'
  customClassPrefix: 'custom'     // Prefix for unknown classes
});
```

## Advanced Usage

### Custom Tailwind Config

```typescript
const tailwindExtension = new TailwindExtension({
  config: {
    theme: {
      extend: {
        colors: {
          brand: {
            500: '#6366f1',
            600: '#4f46e5'
          }
        }
      }
    }
  }
});
```

### Dynamic Classes

```typescript
const template: TemplateNode[] = [
  {
    type: 'element',
    tag: 'div',
    extensions: {
      tailwind: {
        class: [
          'base-class',
          'conditional-class-1': 'condition1',
          'conditional-class-2': 'condition2'
        ]
      }
    }
  }
];
```

## TypeScript Support

The Tailwind extension provides comprehensive TypeScript support:

- **Type-safe Configuration**: Full typing for all options
- **Utility Type Checking**: IntelliSense for Tailwind classes
- **Breakpoint Validation**: Type checking for responsive breakpoints
- **Variant Validation**: Type safety for pseudo-class variants

```typescript
// Generated TypeScript interface
interface TailwindClasses {
  'bg-blue-500': string;
  'text-white': string;
  'p-4': string;
  'hover:bg-blue-600': string;
}
```

## Contributing

Please see the main [Contributing Guide](../../CONTRIBUTING.md) for development setup and guidelines.

## License

MIT - See [LICENSE](../../LICENSE) for details.