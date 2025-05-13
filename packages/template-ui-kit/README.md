# 🎨 Template UI Kit

A component library starter that uses the JS Template Engine to generate framework-agnostic UI components.

## 🚀 Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Create your component templates in the `src/` directory using JSON or TypeScript.

3. Configure your output settings in `template.config.ts`:
   ```ts
   export default {
     input: './src',
     output: './dist',
     extensions: [new ReactExtension(), new BemExtension()],
     globalOptions: {
       fileExtension: '.tsx',
       writeOutputFile: true,
       verbose: true
     }
   };
   ```

4. Generate components:
   ```bash
   pnpm generate
   ```

## 📝 Creating Components

Create JSON or TypeScript files in the `src/` directory. Example:

```json
{
  "tag": "button",
  "attributes": {
    "class": "button button--primary"
  },
  "children": [
    {
      "type": "text",
      "content": "Click me"
    }
  ],
  "extensions": {
    "react": {
      "tag": "Button",
      "expressionAttributes": {
        "onClick": "handleClick"
      }
    },
    "bem": {
      "block": "button",
      "modifiers": ["primary"]
    }
  }
}
```

## 🔧 Configuration

The `template.config.ts` file controls:

- Input/output directories
- Enabled extensions (React, BEM, etc.)
- Global options for component generation
- File extensions and naming conventions

## 📦 Output

Components are generated in the `dist/` directory with:

- React components (`.tsx`)
- BEM-styled SCSS (`.scss`)
- TypeScript types (`.d.ts`)

## 🎯 Usage Modes

1. **Compiled Mode**: Use the generated components directly from `dist/`
2. **Composable Mode**: Copy the source templates to your project and customize

## 📚 Documentation

For more details on:
- Template syntax
- Available extensions
- Custom configuration
- Best practices

See the main [JS Template Engine documentation](../../README.md). 