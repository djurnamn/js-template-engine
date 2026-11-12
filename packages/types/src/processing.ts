import type { Template } from './template-nodes';

/**
 * Where a component's generated stylesheet is placed.
 *
 * | Placement | Styles |
 * |---|---|
 * | `inline` | `style="..."` |
 * | `in-file` | `<style>` block / SFC style block |
 * | `separate-file` | `Button.css` + link/import |
 */
export type StylesheetPlacement = 'inline' | 'in-file' | 'separate-file';

/** @deprecated Use `StylesheetPlacement`; removed in 3.0.0. */
export type OutputStrategy = StylesheetPlacement;

/**
 * Whether the component links the stylesheet the `separate-file` placement
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
  /**
   * The keys the extension reads from its override blocks: `node` on an
   * element's `extensions.<key>`, `component` on the component's. When a
   * list is declared, processing warns about any other key found in that
   * block, which would otherwise have no effect. An undeclared list leaves
   * its blocks unchecked.
   */
  readonly overrideKeys?: ExtensionOverrideKeys;
  /**
   * The packages the extension's output imports or compiles against, with
   * the version ranges it needs, which a package of generated components
   * declares as its peer dependencies (`{ react: '^19.0.0' }`).
   */
  readonly peerDependencies?: Readonly<Record<string, string>>;
  /**
   * The names the extension's output declares in a component's scope -
   * helpers, imports and locals - which no prop, slot, slot scope entry,
   * iteration variable, declared id, derived value, two-way name or script
   * declaration of the template may take, since the generated component
   * would declare the name twice or shadow it. Validation reserves the names
   * of the extensions it is given, so a name only one target generates is
   * reserved only in builds that include that target. A function receives
   * the template and returns the names for it, for names that follow the
   * template (a local named after each two-way prop, an import only one
   * override setting needs).
   *
   * @example
   * reservedNames: [
   *   { name: 'useAttrs', description: "Vue's attributes import" },
   *   { name: 'emit', description: "Vue's emit function for the two-way props", when: 'twoWay', readable: false },
   * ]
   */
  readonly reservedNames?:
    | readonly ReservedName[]
    | ((context: ReservedNameContext) => readonly ReservedName[]);
  /**
   * The keys of the extension's component override that hold override
   * blocks of their own, each of the shared override shape (`script`,
   * `style`, `imports`, `props` and the strategies), such as one block per
   * output mode. Validation checks each block's shape and reads its `script`
   * and `imports` as it reads the override's own.
   */
  readonly overrideBlocks?: readonly string[];
  /**
   * Validates what only this extension reads in a template - its override
   * blocks, component-level and node-level - returning each violation with
   * its path. Template validation calls it once per run when the extension
   * is among the extensions it is given, after its own rules, and reports
   * the violations with its own in one `TemplateError`.
   *
   * @param template - The template being validated.
   * @param context - What validation already knows about the template.
   * @returns The violations; empty when there are none.
   * @example
   * validateOverrides: (template) => {
   *   const model = Array.isArray(template) ? undefined : template.extensions?.vue?.model;
   *   return model === undefined || typeof model === 'string'
   *     ? []
   *     : [{ message: 'extensions.vue.model names a prop, as a string', nodePath: 'extensions.vue.model' }];
   * },
   */
  readonly validateOverrides?: (
    template: Template,
    context: OverrideValidationContext
  ) => readonly TemplateViolation[];
}

/**
 * A name an extension's output declares in a component's scope; see
 * {@link Extension.reservedNames}.
 */
export interface ReservedName {
  /** The identifier. */
  readonly name: string;
  /**
   * What declares it, completing an error message such as "The prop 'emit'
   * takes the name of ..." (`"Vue's emit function for the two-way props"`).
   */
  readonly description: string;
  /**
   * When the output declares the name. Omitted, in every component.
   * `{ eventModifiers }`: only in a component an event of which uses one of
   * the modifiers. `'derived'`, `'ids'` or `'twoWay'`: only in a component
   * declaring derived values, declared ids or a two-way prop, where it is
   * checked against the names those declare.
   */
  readonly when?:
    | { readonly eventModifiers: readonly string[] }
    | 'derived'
    | 'ids'
    | 'twoWay';
  /**
   * Whether a derived value may read the name; `false` for a value only
   * this target declares beside a two-way prop (a setter or a ref of its
   * own), which reads as nothing in the other targets. Defaults to `true`.
   */
  readonly readable?: boolean;
  /**
   * The template path an error about the name points at when the clash is
   * between generated names (the two-way prop the name follows, the
   * override key that asks for it); defaults to `props`.
   */
  readonly path?: string;
}

/** What a {@link Extension.reservedNames} function is given. */
export interface ReservedNameContext {
  /** The template being validated or processed. */
  readonly template: Template;
  /**
   * Each two-way prop of the component, with the local name it is read by
   * (its alias, when its name is not a bindable identifier), and whether its
   * `bindable` is the relayed form, which keeps no copy in the component.
   */
  readonly twoWayProps: ReadonlyArray<{
    readonly name: string;
    readonly local: string;
    readonly relayed?: boolean;
  }>;
}

/** What validation passes to {@link Extension.validateOverrides}. */
export interface OverrideValidationContext {
  /** The names of the component's well-formed two-way props. */
  readonly twoWayProps: readonly string[];
}

/** One rule a template breaks, as validation reports it. */
export interface TemplateViolation {
  /** The message, without its node path. */
  readonly message: string;
  /**
   * The path of the offending value, such as `'extensions.vue.model'`;
   * empty for the template as a whole.
   */
  readonly nodePath: string;
}

/** The override keys an extension reads; see {@link Extension.overrideKeys}. */
export interface ExtensionOverrideKeys {
  /** The keys read from an element node's override block. */
  readonly node?: readonly string[];
  /** The keys read from the component's override block. */
  readonly component?: readonly string[];
}

/** Style output configuration. */
export interface StylingOptions {
  /**
   * The stylesheet language. `'css'` (default) flattens nested style
   * objects into separate rules; `'scss'` emits them as nested blocks
   * (`&:hover`, nested `@media`, `.ancestor &`). The two are equivalent
   * after a sass compile. SCSS requires that compile step: the react
   * and html targets support `'scss'` only with the `separate-file`
   * placement (the others are a processing error), while Vue and Svelte tag
   * their SFC style blocks `lang="scss"` under every placement.
   */
  language?: 'css' | 'scss';
  /** Where the stylesheet is placed. Defaults to `'in-file'`. */
  placement?: StylesheetPlacement;
  /**
   * @deprecated Use `placement` instead. `outputStrategy` is kept as an
   * alias until the next major version; passing it adds a deprecation
   * warning, and passing both with different values is a processing error.
   */
  outputStrategy?: StylesheetPlacement;
  /**
   * Whether the component links the stylesheet the `separate-file` placement
   * emits; defaults to `'component'`. `'none'` emits `<Name>.css` and links
   * it from nowhere - no `import` on react and svelte, no `<style src>` block
   * on vue, no `<link>` on the html target - leaving how the
   * styles are loaded to whoever consumes the output. It applies only to the
   * `separate-file` placement: pairing it with `in-file` or `inline`, where
   * there is no separate file to leave unlinked, is a processing error.
   */
  stylesheetLink?: StylesheetLink;
  /**
   * Directories sass resolves `@use`/`@import`/`@include` against, matching
   * sass's own load-path model. Under `'scss'` output they pass through for
   * the consumer's own sass build; under `'css'` output (or the `inline`
   * placement) the engine resolves Sass source itself against them - expanding
   * mixins, functions, and `$variables` to flat CSS. Omitted means no load
   * path (only sass built-in modules resolve).
   */
  loadPaths?: string[];
  /**
   * Sass importers passed to every compile the engine runs under `'css'`
   * output, beside `loadPaths`, such as one that resolves a package's own
   * `pkg:` URLs. Each is a Dart Sass importer object (an `Importer` or a
   * `FileImporter`), tried in order. A component whose `style` preamble
   * loads a `pkg:` URL is resolved even without load paths.
   */
  sassImporters?: readonly unknown[];
  /**
   * The cascade layer emitted stylesheet rules are wrapped in; omitted emits
   * them unlayered. It applies wherever collected rules reach a stylesheet -
   * a `separate-file` sheet, an in-file `<style>` or SFC style block, and the
   * rules the `inline` placement routes to a block - so a component holds the
   * same cascade position under every placement. Inline `style="..."`
   * declarations carry no layer.
   */
  layer?: StyleLayer;
}

/**
 * Script output configuration.
 *
 * @deprecated Has no effect: the html target writes events as comments and
 * emits no script, and the scripted targets write their own. Passing it adds a
 * deprecation warning; removed in 3.0.0.
 */
export interface ScriptingOptions {
  language?: 'javascript' | 'typescript';
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
  /**
   * Further extensions whose names are reserved too, though they are not in
   * the build: the targets a template must stay buildable for, such as every
   * target of a kit built for all of them. Only their
   * `reservedNames` are read - validation reserves them, and a prop's alias
   * steers clear of them, so the alias is the same in each target's build -
   * not their override blocks, checks or rendering.
   */
  reserveNamesOf?: readonly Extension[];
  /** Used when no `ComponentNode` is present. Defaults to `'Component'`. */
  componentName?: string;
  styling?: StylingOptions;
  /** @deprecated Has no effect; see {@link ScriptingOptions}. */
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
  /**
   * What the warning is about, when a renderer sorts it: `'unevaluated'`
   * for an expression `renderInstance` could not evaluate and left out,
   * `'unresolved'` for a component reference it left out. Other warnings,
   * such as a styling extension's, carry none.
   */
  kind?: 'unevaluated' | 'unresolved';
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
