# 🧩 Writing a Custom Extension

This guide explains how to create a new extension for the JS Template Engine. Extensions allow you to add support for additional frameworks, templating systems, or output behaviors (e.g. Vue, Svelte, Angular, Markdown, etc.).

## 🔧 Extension Interface

An extension must implement the `Extension` interface. At minimum, that includes:

```ts
export interface Extension<Options = any, NodeExtensions = any> {
  key: string;
  nodeHandler?: (node: TemplateNode, context?: TemplateNode[]) => TemplateNode;
  rootHandler?: (html: string, options: Options) => string;
  optionsHandler?: (defaultOptions: Options, userOptions: DeepPartial<Options>) => Options;
  stylePlugin?: StyleProcessorPlugin;
}
```

## ✍️ Required Methods

### `key`

A short, unique ID for your extension, e.g. `"vue"`, `"markdown"`, `"svelte"`.

```ts
key = 'vue';
```

### `nodeHandler()`

Transforms individual nodes before they're converted to output.

```ts
nodeHandler(node: TemplateNode): TemplateNode {
  if (node.tag === 'button') {
    node.tag = 'VButton'; // Vue-specific tag
  }
  return node;
}
```

Use this to:

* Rename tags
* Add props or attributes
* Inject directives
* Merge in framework-specific config

### `rootHandler()`

Wraps the final HTML string into a full file output (e.g., a `.vue` file, JSX component, etc.).

```ts
rootHandler(html: string, options: any): string {
  return `<template>\n${html}\n</template>`;
}
```

### `optionsHandler()` (Optional)

Normalize or default options passed to your extension.

```ts
optionsHandler(defaults, user) {
  return {
    ...defaults,
    ...user,
    outputDir: user.outputDir || 'dist/vue',
  };
}
```

### `stylePlugin` (Optional)

Adds support for generating styles from the template structure (e.g., BEM).

```ts
stylePlugin: {
  onProcessNode(node) { /* collect class names */ },
  generateStyles(styles, options, tree) {
    return `.my-class { color: red; }`;
  }
}
```

## 🧪 Example: Markdown Extension

```ts
export class MarkdownExtension implements Extension {
  key = 'markdown';

  nodeHandler(node: TemplateNode) {
    if (node.tag === 'p') {
      node.tag = ''; // Markdown paragraphs don't need a tag
      node.content = `${node.content}\n\n`;
    }
    return node;
  }

  rootHandler(content: string): string {
    return `# Auto-generated Markdown\n\n${content}`;
  }
}
```

## 🧰 Testing Your Extension

1. Add it to the engine:

   ```ts
   const engine = new TemplateEngine([new MarkdownExtension()]);
   ```

2. Run:

   ```ts
   await engine.render(template, {
     name: 'my-doc',
     extensions: [new MarkdownExtension()],
     outputDir: 'dist/md'
   });
   ```

## 🛠️ Advanced Features

* Use `ancestorNodesContext` in `nodeHandler()` for inheritance-aware rendering
* Return rich logs with `createLogger(verbose, 'MyExtension')`
* Combine with other extensions (e.g., React + BEM)

## Renderer Extensions (Frameworks)

Only one renderer extension (framework) can be active at a time (e.g., React, Vue, Svelte). If multiple renderer extensions are provided to the engine, an error will be thrown.

## Extension API Stability

The extension API is stable, but core responsibilities are now handled by dedicated modules:
- AttributeRenderer
- NodeTraverser
- ExtensionManager
- StyleManager
- FileOutputManager

## Integration Testing

Integration tests now live in the `integration-tests` package and verify that extensions work as expected with the core engine. See that package for real-world extension scenarios and contract tests. 