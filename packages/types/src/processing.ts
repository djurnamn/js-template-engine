/**
 * The unified output strategy vocabulary shared by styles and scripts.
 *
 * | Strategy | Styles | Scripts |
 * |---|---|---|
 * | `inline` | `style="..."` | `onclick="..."` |
 * | `in-file` | `<style>` block / SFC style block | `<script>` block / SFC script |
 * | `separate-file` | `Button.css` + link/import | `Button.js` + import |
 */
export type OutputStrategy = 'inline' | 'in-file' | 'separate-file';

/**
 * Whether the component links the stylesheet the `separate-file` strategy
 * emits: `'component'` (default) links it from the component that owns it,
 * `'none'` emits the file and links it nowhere.
 */
export type StylesheetLink = 'component' | 'none';

/**
 * The cascade layer emitted stylesheet rules are wrapped in.
 *
 * `name` is the layer the rules land in (`@layer <name> { ... }`); `order`
 * is the full layer order the output declares (`@layer a, b, c;`) ahead of
 * the wrapper, since cascade-layer order is fixed by first declaration and
 * a per-component stylesheet has nowhere else to state it.
 */
export interface StyleLayer {
  /** The layer the rules are wrapped in, e.g. `'kit.components'`. */
  name: string;
  /**
   * The full layer order, declared ahead of the wrapper. Omitted emits no
   * order statement - correct when something else the output loads declares
   * it first.
   */
  order?: string[];
}

/**
 * The format-level extension contract.
 *
 * `key` is the extension's declared name (`'react'`, `'bem'`, ...) used to
 * resolve `extensions.<key>` override blocks on nodes. The full extension
 * API is defined by `@js-template-engine/core`.
 */
export interface Extension {
  readonly key: string;
}

/** Style output configuration. */
export interface StylingOptions {
  /**
   * The stylesheet language. `'css'` (default) flattens nested style
   * objects into separate rules; `'scss'` emits them as nested blocks
   * (`&:hover`, nested `@media`, `.ancestor &`). The two are equivalent
   * after a sass compile. SCSS requires that compile step: the react
   * target and HTML mode support `'scss'` only with the `separate-file`
   * strategy (the others are a processing error), while Vue and Svelte tag
   * their SFC style blocks `lang="scss"` under every strategy.
   */
  language?: 'css' | 'scss';
  /** Defaults to `'in-file'`. */
  outputStrategy?: OutputStrategy;
  /**
   * Whether the component links the stylesheet the `separate-file` strategy
   * emits; defaults to `'component'`. `'none'` emits `<Name>.css` exactly as
   * before and links it from nowhere - no `import` on react and svelte, no
   * `<style src>` block on vue, no `<link>` on HTML mode - leaving how the
   * styles are loaded to whoever consumes the output. It applies only to the
   * `separate-file` strategy: pairing it with `in-file` or `inline`, where
   * there is no separate file to leave unlinked, is a processing error.
   */
  stylesheetLink?: StylesheetLink;
  /**
   * Directories sass resolves `@use`/`@import`/`@include` against, matching
   * sass's own load-path model. Under `'scss'` output they pass through for
   * the consumer's own sass build; under `'css'` output (or the `inline`
   * strategy) the engine resolves Sass source itself against them - expanding
   * mixins, functions, and `$variables` to flat CSS. Omitted means no load
   * path (only sass built-in modules resolve).
   */
  loadPaths?: string[];
  /**
   * The cascade layer emitted stylesheet rules are wrapped in; omitted emits
   * them unlayered. It applies wherever collected rules reach a stylesheet -
   * a `separate-file` sheet, an in-file `<style>` or SFC style block, and the
   * rules the `inline` strategy routes to a block - so a component holds the
   * same cascade position under every strategy. Inline `style="..."`
   * declarations carry no layer.
   */
  layer?: StyleLayer;
}

/** Script output configuration. */
export interface ScriptingOptions {
  /**
   * The script language. `'javascript'` (default) emits plain JavaScript.
   * `'typescript'` types the generated prop-default consts from their
   * declared prop types; it governs HTML mode only - the framework targets
   * emit TypeScript intrinsically and are unaffected. TypeScript requires a
   * compile step, so HTML mode supports `'typescript'` only with the
   * `separate-file` strategy (emitting `<Name>.ts`); `in-file`/`inline` are
   * a processing error (a browser runs no TypeScript in a `<script>` block
   * or event attribute).
   */
  language?: 'javascript' | 'typescript';
  /** Defaults to `'in-file'`. */
  outputStrategy?: OutputStrategy;
}

/**
 * Options for `process(template, options)`.
 *
 * Extensions are passed directly - no registry, no string-key lookup, no
 * auto-detection.
 */
export interface ProcessingOptions {
  extensions?: Extension[];
  /** Used when no `ComponentNode` is present. Defaults to `'Component'`. */
  componentName?: string;
  styling?: StylingOptions;
  scripting?: ScriptingOptions;
}

/** One generated output file. */
export interface OutputFile {
  path: string;
  content: string;
}

/** A non-fatal processing notice. */
export interface Warning {
  message: string;
  /** A node path such as `'children[2].conditions[0]'`. */
  nodePath?: string;
}

/**
 * The result of processing a template.
 *
 * `process()` either returns a result or throws a `TemplateError` with a
 * node path - no silent empty-string outputs.
 */
export interface ProcessResult {
  files: OutputFile[];
  warnings: Warning[];
}
