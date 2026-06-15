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
}

/** Script output configuration. */
export interface ScriptingOptions {
  /**
   * The script language. `'javascript'` (default) emits plain JavaScript.
   * `'typescript'` types the generated prop-default consts from their
   * declared prop types; it governs HTML mode only — the framework targets
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
 * Extensions are passed directly — no registry, no string-key lookup, no
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
 * node path — no silent empty-string outputs.
 */
export interface ProcessResult {
  files: OutputFile[];
  warnings: Warning[];
}
