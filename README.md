# 📦 JS Template Engine

> A framework-agnostic, extensible engine that turns structured JSON/JS/TS templates into frontend components across multiple platforms (HTML, React, BEM, etc.).

## ✨ Why Use This?

* **Write Once, Render Anywhere**
  Define your UI structure once in JSON or JS, and render it as React, HTML, or BEM-styled markup.

* **Ideal for Component Libraries**
  Maintain a single source of truth for your components across multiple frameworks or environments.

* **Extensible by Design**
  Build custom extensions for Vue, Svelte, Angular, or any templating system.

## 🚀 Getting Started

### 1. Install

```bash
pnpm install
pnpm build
```

### 2. Define a Template

```ts
const myComponent = [
  {
    tag: 'button',
    attributes: { class: 'btn', onclick: 'handleClick' },
    children: [{ type: 'text', content: 'Click me' }],
    extensions: {
      react: {
        tag: 'DefaultButton',
        expressionAttributes: {
          onClick: 'handleClick',
        },
      },
    },
  },
];
```

### 3. Render with CLI

```bash
pnpm cli render src/button.json --ext react bem
```

Or via API:

```ts
const engine = new TemplateEngine([new ReactExtension(), new BemExtension()]);
await engine.render(myComponent, {
  name: 'MyComponent',
  outputDir: 'dist/react',
  extensions: [new ReactExtension()],
});
```

## 📂 Project Structure

```txt
packages/
├── core                # Core engine logic
├── cli                 # CLI tool
├── extension-react     # JSX-specific transformations
├── extension-bem       # BEM + SCSS output
├── types               # Shared TypeScript interfaces
├── examples            # Usage examples
```

## 🔌 Writing Your Own Extension

To build a custom extension:

```ts
export class MyExtension implements Extension {
  key = 'my';
  nodeHandler(node) { /* mutate or enhance nodes */ }
  rootHandler(html, options) { return wrappedHtml; }
}
```

Then use:

```ts
new TemplateEngine([new MyExtension()]);
```

Want full plugin documentation? See [`docs/extending.md`](docs/extending.md)

## 📸 Output Examples

| Source JSON   | React Output             | HTML Output                             |
| ------------- | ------------------------ | --------------------------------------- |
| `button.json` | `DefaultButton` w/ props | `<button class="btn">Click me</button>` |

## 📌 Roadmap Ideas

* [ ] Vue / Svelte / Angular extensions
* [ ] Web-based playground
* [ ] Plugin registry or auto-loader
* [ ] Live preview / HMR dev mode
