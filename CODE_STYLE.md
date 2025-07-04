# Code Style & Naming Conventions

This document defines the code style and naming conventions for this project. All contributors should follow these guidelines to ensure consistency and maintainability.

---

## 1. Doc Blocks

- **Format:** Use [TSDoc](https://tsdoc.org/) for all doc blocks (functions, classes, interfaces, modules, etc.).
- **Placement:** Place doc blocks immediately above the item they document.
- **Content:** Include a summary, parameter descriptions, return type, and any relevant tags (e.g., `@param`, `@returns`, `@example`).

**Example:**
```ts
/**
 * Renders a template to HTML.
 *
 * @param template - The template definition object.
 * @param options - Rendering options.
 * @returns The rendered HTML string.
 *
 * @example
 * renderTemplate({ tag: 'div' }, { pretty: true });
 */
function renderTemplate(template: Template, options: RenderOptions): string {
  // ...
}
```

---

## 2. Naming Conventions

### Files & Folders
- **Default:** Use `kebab-case` for files and folders.
- **Single-Class Files:** Use `PascalCase` if the file contains only a single class (e.g., `TemplateEngine.ts`).
- **Test Files:** Name test files to match the class or function they test (e.g., `TemplateEngine.test.ts`).
- **Extensions:** Follow the same rules as above.

### Variables, Functions, Classes
- **Variables & Functions:** Use `camelCase` (e.g., `renderTemplate`).
- **Classes & Types:** Use `PascalCase` (e.g., `TemplateEngine`).
- **Constants:** Use `UPPER_CASE` if the value is truly constant and exported.

---

## 3. Formatting

- **Formatter:** Use [Prettier](https://prettier.io/) with default settings for all code formatting.
- **Indentation:** 2 spaces.
- **Line Length:** 80 or 100 characters (Prettier default).
- **Semicolons:** Yes (Prettier default).
- **Trailing Commas:** Where valid in ES2017+ (Prettier default).

---

## 4. Framework & Extension Guidelines

- **React/Vue/BEM:** Follow framework-specific best practices, but maintain naming and doc block conventions above.
- **Extensions:** Should follow the same style and naming rules as core packages.

---

## 5. Linting & Tooling

- **Prettier:** Use as the source of truth for formatting. Add a `.prettierrc` if custom rules are needed.
- **ESLint:** (Optional) Use for code quality and best practices, not formatting.

---

## 6. Future Rules & Ambiguities

- If a case is not covered here, prefer clarity and consistency. Consult the team or update this document as needed.
- For ambiguous cases, ask for input before proceeding.

---

_Last updated: [DATE]_ 