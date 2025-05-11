# @js-template-engine/cli

Command-line interface for JS Template Engine, providing a convenient way to render templates from JSON files.

## 📦 Installation

```bash
pnpm add @js-template-engine/cli
```

## 🚀 Usage

```bash
# Basic usage
pnpm cli render path/to/template.json

# With options
pnpm cli render path/to/template.json --outputDir ./dist --name MyComponent --fileExtension .tsx
```

### Command Options

- `--config`: Path to template config file (default: './template.config')
- `--outputDir`, `-o`: Output directory for rendered templates
- `--name`, `-n`: Base name for output files
- `--fileExtension`: Output file extension ('.html', '.jsx', '.tsx', '.css')
- `--verbose`, `-v`: Enable verbose logging

## 🔌 Extension Configuration

Create a `template.config.ts` file in your project:

```typescript
export default {
  extensions: [
    '@js-template-engine/extension-bem',
    '@js-template-engine/extension-react'
  ]
};
```

See the [extension documentation](../../README.md#-using-extensions) for more details.

## 📚 API

### CLI Command

```typescript
interface CliOptions {
  sourcePath: string;
  config?: string;
  outputDir?: string;
  name?: string;
  fileExtension?: '.html' | '.jsx' | '.tsx' | '.css';
  verbose?: boolean;
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