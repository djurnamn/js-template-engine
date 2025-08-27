# BEM Extension

[![npm version](https://img.shields.io/npm/v/@js-template-engine/extension-bem.svg)](https://www.npmjs.com/package/@js-template-engine/extension-bem)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A BEM (Block Element Modifier) styling extension for the JS Template Engine that automatically generates BEM-style class names and CSS for your templates. Provides structured, maintainable styling with clear naming conventions.

## Installation

```bash
npm install @js-template-engine/extension-bem
```

## Quick Start

```typescript
import { ProcessingPipeline, ExtensionRegistry } from '@js-template-engine/core';
import { BemExtension } from '@js-template-engine/extension-bem';
import { TemplateNode } from '@js-template-engine/types';

// Initialize the processing pipeline with BEM extension
const registry = new ExtensionRegistry();
registry.registerStyling(new BemExtension());
const pipeline = new ProcessingPipeline(registry);

// Define your template with BEM extensions
const template: TemplateNode[] = [
  {
    type: 'element',
    tag: 'div',
    extensions: {
      bem: {
        block: 'card'
      }
    },
    children: [
      {
        type: 'element',
        tag: 'div',
        extensions: {
          bem: {
            element: 'header'
          }
        },
        children: [
          {
            type: 'element',
            tag: 'h2',
            extensions: {
              bem: {
                element: 'title',
                modifiers: ['large']
              }
            }
          }
        ]
      }
    ]
  }
];

// Process the template
const result = await pipeline.process(template, {
  styling: 'bem',
  component: { name: 'MyCard' }
});

console.log(result.output); // Generated code with BEM classes
```

## Features

- **Automatic BEM Class Generation**: Creates structured class names following BEM methodology
- **Block, Element, Modifier Support**: Full BEM hierarchy with nested structures
- **CSS Generation**: Optional CSS/SCSS output with BEM-specific styles
- **Framework Integration**: Works seamlessly with React, Vue, and Svelte extensions
- **Customizable Naming**: Configurable separators and naming conventions
- **Nested BEM Structures**: Support for complex component hierarchies
- **Type Safety**: Full TypeScript support with proper interfaces

## Usage Examples

### Basic BEM Structure

```typescript
const template: TemplateNode[] = [
  {
    type: 'element',
    tag: 'div',
    extensions: {
      bem: {
        block: 'card'
      }
    },
    children: [
      {
        type: 'element',
        tag: 'h2',
        extensions: {
          bem: {
            element: 'title'
          }
        }
      },
      {
        type: 'element',
        tag: 'p',
        extensions: {
          bem: {
            element: 'content'
          }
        }
      }
    ]
  }
];
```

**Generated Classes:**
```html
<div class="card">
  <h2 class="card__title">Title</h2>
  <p class="card__content">Content</p>
</div>
```

### BEM with Modifiers

```typescript
const template: TemplateNode[] = [
  {
    type: 'element',
    tag: 'div',
    extensions: {
      bem: {
        block: 'button',
        modifiers: ['primary', 'large']
      }
    }
  }
];
```

**Generated Classes:**
```html
<div class="button button--primary button--large">
</div>
```

### Complex Nested Structure

```typescript
const template: TemplateNode[] = [
  {
    type: 'element',
    tag: 'article',
    extensions: {
      bem: {
        block: 'article'
      }
    },
    children: [
      {
        type: 'element',
        tag: 'header',
        extensions: {
          bem: {
            element: 'header'
          }
        },
        children: [
          {
            type: 'element',
            tag: 'h1',
            extensions: {
              bem: {
                element: 'title',
                modifiers: ['featured']
              }
            }
          }
        ]
      },
      {
        type: 'element',
        tag: 'div',
        extensions: {
          bem: {
            element: 'content'
          }
        }
      }
    ]
  }
];
```

**Generated Classes:**
```html
<article class="article">
  <header class="article__header">
    <h1 class="article__title article__title--featured">Title</h1>
  </header>
  <div class="article__content">Content</div>
</article>
```

### Conditional Modifiers

```typescript
const template: TemplateNode[] = [
  {
    type: 'element',
    tag: 'div',
    extensions: {
      bem: {
        block: 'alert',
        modifiers: {
          error: 'hasError',
          success: '!hasError',
          visible: 'isVisible'
        }
      }
    }
  }
];
```

**Generated Classes (when hasError=true, isVisible=true):**
```html
<div class="alert alert--error alert--visible">
</div>
```

## API Reference

### BemExtension

```typescript
class BemExtension {
  constructor(options?: BemExtensionOptions);
  
  readonly key = 'bem';
  
  nodeHandler(node: TemplateNode): TemplateNode;
}
```

**Parameters:**
- `options` (optional): Configuration options for BEM generation

### BEM Node Extension

```typescript
interface BemNodeExtension {
  block?: string;                           // BEM block name
  element?: string;                         // BEM element name
  modifiers?: string[] | Record<string, string | boolean>; // BEM modifiers
}
```

### BEM Extension Options

```typescript
interface BemExtensionOptions {
  elementSeparator?: string;                // Default: '__'
  modifierSeparator?: string;               // Default: '--'
  generateCss?: boolean;                    // Generate CSS output
  cssFormat?: 'css' | 'scss';              // CSS format
  namespace?: string;                       // Global namespace prefix
}
```

## Configuration

### Basic Configuration

```typescript
const bemExtension = new BemExtension({
  elementSeparator: '__',      // card__title
  modifierSeparator: '--',     // card--primary
  generateCss: true,           // Generate CSS output
  cssFormat: 'scss',           // Use SCSS format
  namespace: 'app'             // app-card__title
});
```

### Custom Naming Convention

```typescript
const bemExtension = new BemExtension({
  elementSeparator: '_',       // card_title
  modifierSeparator: '-',      // card-primary
  namespace: 'ui'              // ui-card_title
});
```

## Integration

### With React Extension

```typescript
import { ReactExtension } from '@js-template-engine/extension-react';
import { BemExtension } from '@js-template-engine/extension-bem';

const registry = new ExtensionRegistry();
registry.registerStyling(new BemExtension());
registry.registerFramework(new ReactExtension());

// BEM classes are automatically applied to React components
// Generated: <div className="card card--primary">
```

### With Vue Extension

```typescript
import { VueExtension } from '@js-template-engine/extension-vue';
import { BemExtension } from '@js-template-engine/extension-bem';

const registry = new ExtensionRegistry();
registry.registerStyling(new BemExtension());
registry.registerFramework(new VueExtension());

// BEM classes are automatically applied to Vue templates
// Generated: <div class="card card--primary">
```

### With Svelte Extension

```typescript
import { SvelteExtension } from '@js-template-engine/extension-svelte';
import { BemExtension } from '@js-template-engine/extension-bem';

const registry = new ExtensionRegistry();
registry.registerStyling(new BemExtension());
registry.registerFramework(new SvelteExtension());

// BEM classes are automatically applied to Svelte components
// Generated: <div class="card card--primary">
```

## CSS Generation

### Automatic CSS Output

When `generateCss: true` is enabled, the BEM extension generates corresponding CSS:

```scss
// Generated SCSS
.card {
  // Block styles
  
  &__title {
    // Element styles
    
    &--featured {
      // Modifier styles
    }
  }
  
  &__content {
    // Element styles
  }
  
  &--primary {
    // Block modifier styles
  }
}
```

### CSS Structure Options

```typescript
const bemExtension = new BemExtension({
  generateCss: true,
  cssFormat: 'css',           // Generate flat CSS
  // OR
  cssFormat: 'scss'           // Generate nested SCSS
});
```

**CSS Output:**
```css
.card { /* Block styles */ }
.card__title { /* Element styles */ }
.card__title--featured { /* Modifier styles */ }
.card--primary { /* Block modifier styles */ }
```

**SCSS Output:**
```scss
.card {
  /* Block styles */
  
  &__title {
    /* Element styles */
    
    &--featured {
      /* Modifier styles */
    }
  }
  
  &--primary {
    /* Block modifier styles */
  }
}
```

## Advanced Usage

### Dynamic Modifiers

```typescript
const template: TemplateNode[] = [
  {
    type: 'element',
    tag: 'div',
    extensions: {
      bem: {
        block: 'button',
        modifiers: {
          'is-loading': 'props.isLoading',
          'is-disabled': 'props.disabled',
          'size-large': 'props.size === "large"'
        }
      }
    }
  }
];
```

### Responsive BEM

```typescript
const template: TemplateNode[] = [
  {
    type: 'element',
    tag: 'div',
    extensions: {
      bem: {
        block: 'grid',
        modifiers: [
          'cols-1',
          'sm:cols-2',
          'md:cols-3',
          'lg:cols-4'
        ]
      }
    }
  }
];
```

## TypeScript Support

The BEM extension provides comprehensive TypeScript support:

- **Type-safe Configuration**: Full typing for all options
- **Interface Generation**: Proper TypeScript interfaces for BEM structures
- **Modifier Validation**: Type checking for modifier conditions

```typescript
// Generated TypeScript interface
interface BemClasses {
  card: string;
  card__title: string;
  card__content: string;
  'card--primary': string;
  'card__title--featured': string;
}
```

## Contributing

Please see the main [Contributing Guide](../../CONTRIBUTING.md) for development setup and guidelines.

## License

MIT - See [LICENSE](../../LICENSE) for details.