# Tailwind Extension

The Tailwind Extension provides bi-directional conversion between Tailwind utility classes and CSS styles for the JS Template Engine.

## Features

- **Bi-directional Conversion**: Convert between Tailwind classes and CSS styles
- **Multiple Output Strategies**: CSS, SCSS with @apply, or pass-through
- **Responsive Support**: Handle responsive breakpoints with media queries
- **Pseudo-class Variants**: Support for hover, focus, and other variants
- **Framework Coordination**: Seamless integration with React, Vue, and Svelte extensions

## Installation

```bash
npm install @js-template-engine/extension-tailwind
```

## Usage

### Basic Setup

```typescript
import { TailwindExtension } from '@js-template-engine/extension-tailwind';
import { ExtensionRegistry } from '@js-template-engine/core';

const tailwindExtension = new TailwindExtension();
const registry = new ExtensionRegistry();
registry.register(tailwindExtension);
```

### Configuration Options

```typescript
const tailwindExtension = new TailwindExtension();

// Configure extension options
tailwindExtension.options = {
  outputStrategy: 'css', // 'css' | 'scss-apply' | 'pass-through'
  unknownClassHandling: 'warn', // 'warn' | 'error' | 'ignore'
  cssFallback: 'custom-class', // 'inline' | 'custom-class' | 'ignore'
  customClassPrefix: 'custom',
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px'
  }
};
```

### Template Usage

#### Using `extensions.tailwind`

```html
<div extensions.tailwind.class="bg-blue-500 text-white p-4">
  Content
</div>

<button extensions.tailwind="{
  class: 'bg-blue-500 text-white',
  responsive: {
    md: 'text-lg',
    lg: 'px-8'
  },
  variants: {
    hover: 'bg-blue-600',
    focus: 'outline-none ring-2'
  }
}">
  Click me
</button>
```

#### Using Standard `class` Attribute

```html
<div class="bg-blue-500 text-white p-4">
  Content
</div>
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
@apply bg-blue-500 text-white p-4;

&:hover {
  @apply bg-blue-600;
}

@media (min-width: 768px) {
  @apply text-lg;
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

### Colors
- Background: `bg-red-500`, `bg-blue-500`, etc.
- Text: `text-white`, `text-gray-800`, etc.
- Border: `border-red-500`, `border-blue-500`, etc.

### Spacing
- Padding: `p-4`, `px-6`, `py-2`, `pt-4`, etc.
- Margin: `m-4`, `mx-auto`, `my-6`, `mt-2`, etc.

### Layout
- Display: `flex`, `block`, `inline`, `hidden`
- Width/Height: `w-full`, `w-1/2`, `h-64`, `h-screen`
- Position: `absolute`, `relative`, `fixed`, `sticky`

### Typography
- Font Size: `text-xs`, `text-sm`, `text-lg`, `text-xl`
- Font Weight: `font-normal`, `font-bold`, `font-semibold`

### Borders & Effects
- Border Radius: `rounded`, `rounded-lg`, `rounded-full`
- Box Shadow: `shadow`, `shadow-md`, `shadow-lg`

### Responsive Breakpoints
- `sm:` - 640px and up
- `md:` - 768px and up  
- `lg:` - 1024px and up
- `xl:` - 1280px and up
- `2xl:` - 1536px and up

### Pseudo-class Variants
- `hover:` - :hover state
- `focus:` - :focus state
- `active:` - :active state
- `disabled:` - :disabled state
- `first:` - :first-child
- `last:` - :last-child
- `group-hover:` - Group hover states
- `dark:` - Dark mode variants

## API Reference

### TailwindExtension Class

#### Methods

##### `processStyles(concept: StylingConcept): StyleOutput`
Process styling concepts and generate CSS/SCSS output.

##### `convertTailwindToCss(classes: string[]): StyleOutput`  
Convert Tailwind classes to CSS styles.

##### `convertCssToTailwind(styles: Record<string, string>): { classes: string[]; remaining: Record<string, string> }`
Convert CSS styles back to Tailwind classes.

##### `coordinateWithFramework(frameworkExtension: FrameworkExtension, concepts: ComponentConcept): ComponentConcept`
Coordinate with framework extensions for component processing.

### Types

```typescript
interface TailwindExtensionOptions {
  outputStrategy: 'css' | 'scss-apply' | 'pass-through';
  config?: string | object;
  breakpoints?: Record<string, string>;
  unknownClassHandling: 'warn' | 'error' | 'ignore';
  cssFallback: 'inline' | 'custom-class' | 'ignore';
  customClassPrefix?: string;
}

interface TailwindNodeExtensions {
  class?: string | string[];
  responsive?: Record<string, string | string[]>;
  variants?: Record<string, string | string[]>;
}
```

## Integration with Framework Extensions

The Tailwind Extension automatically coordinates with React, Vue, and Svelte extensions:

```typescript
import { ReactExtension } from '@js-template-engine/extension-react';
import { TailwindExtension } from '@js-template-engine/extension-tailwind';

const reactExtension = new ReactExtension();
const tailwindExtension = new TailwindExtension();

// Extensions coordinate automatically when both are registered
registry.register(reactExtension);
registry.register(tailwindExtension);
```

## Error Handling

Configure how unknown classes are handled:

```typescript
// Warn about unknown classes (default)
extension.options.unknownClassHandling = 'warn';

// Throw errors for unknown classes
extension.options.unknownClassHandling = 'error';  

// Silently ignore unknown classes
extension.options.unknownClassHandling = 'ignore';
```

## Contributing

See the main [Contributing Guide](../../CONTRIBUTING.md) for development setup and guidelines.

## License

MIT - See [LICENSE](../../LICENSE) for details.