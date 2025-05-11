# @js-template-engine/cli

A command-line interface for the JS Template Engine that provides a convenient way to render templates from JSON files or directories.

## Features

- Process single JSON files or entire directories
- Support for multiple extensions (React, BEM)
- Configurable output options
- Verbose logging for debugging
- File extension customization

## Installation

```bash
pnpm add -g @js-template-engine/cli
```

## Usage

### Basic Usage

```bash
js-template-engine render <sourcePath> [options]
```

### Options

- `--outputDir`, `-o`: Specify the output directory for rendered templates
- `--extensions`, `-e`: Choose extensions to use (e.g., react, bem)
- `--name`, `-n`: Set a base name for output files
- `--componentName`, `-c`: Define a component name for framework-specific templates
- `--verbose`, `-v`: Enable verbose logging
- `--extension`: Choose the extension type ('react', 'bem', or 'none')
- `--fileExtension`: Specify the output file extension ('.html', '.jsx', '.tsx', or '.css')

### Examples

Render a single template with React extension:
```bash
js-template-engine render template.json --extension react --fileExtension .tsx
```

Process a directory with BEM extension:
```bash
js-template-engine render templates/ --extension bem --outputDir dist/
```

Use multiple extensions:
```bash
js-template-engine render template.json --extensions react,bem --fileExtension .tsx
```

## Development

```bash
# Build the package
pnpm build

# Run tests
pnpm test

# Type check
pnpm type-check
``` 