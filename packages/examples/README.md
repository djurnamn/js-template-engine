# @js-template-engine/examples

A collection of example templates and usage patterns for the JS Template Engine. This package demonstrates various features and capabilities of the template engine and its extensions.

## Examples

### BEM Example
Demonstrates the usage of the BEM extension to generate consistent CSS class names following the BEM methodology.

```bash
pnpm start:bem
```

### React Example
Shows how to use the React extension to generate React components from template definitions.

```bash
pnpm start:react
```

### Slots Example
Illustrates the use of slots for template composition and reusability.

```bash
pnpm start:slots
```

### Styles Example
Demonstrates the style processing capabilities of the template engine.

```bash
pnpm start:styles
```

### Template Logic Example
Shows all the template logic node types (comment, fragment, if, for) working with both React and Vue extensions.

```bash
pnpm start:template-logic
```

## Running All Examples

To run all examples in sequence:

```bash
pnpm start
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

## Adding New Examples

To add a new example:

1. Create a new TypeScript file in the `src` directory
2. Add your example code
3. Add a new script in `package.json`
4. Update this README with documentation for your example 