import {
  collectCss,
  collectNamedSlotNames,
  discriminatedSurfaceOf,
  flattenDiscriminatedProps,
  isDynamicTag,
  passthroughNodeOf,
  planTargets,
  resolveComponentOverrides,
  staticTagOf,
  type BemRuntimeBinding,
  type FrameworkExtension,
  type NormalizedComponent,
  type ResolvedProcessingOptions,
} from '@js-template-engine/core';
import type {
  ElementNode,
  OutputFile,
  ProcessResult,
  PropDefinition,
  TemplateNode,
  Warning,
} from '@js-template-engine/types';

import {
  composeEventHandlersDeclaration,
  onceHelperDeclaration,
} from './events';
import {
  DYNAMIC_ROOT_BINDING,
  renderNodes,
  STYLE_SERIALIZER_NAME,
  type SvelteContext,
} from './markup';
import { exportLetDeclarations, passthroughDeclarations } from './props';
import {
  collectSnippetProps,
  runesPropsDeclaration,
  runesPropsDestructure,
  type RunesPassthroughSurface,
  type SnippetProp,
} from './runes-props';

/** The Svelte dialects the extension can emit. */
export const svelteModes = ['legacy', 'runes'] as const;

/** One of the Svelte dialects the extension can emit. */
export type SvelteMode = (typeof svelteModes)[number];

/** Options for the Svelte extension. */
export interface SvelteOptions {
  /**
   * The Svelte dialect of the generated components. `'legacy'` (default)
   * emits `export let` prop declarations, `<slot>` elements, and `on:event`
   * directive bindings. `'runes'` emits Svelte 5 runes components: a typed
   * `Props` interface destructured from `$props()`, a `$bindable()` DOM
   * handle, snippet props rendered through `{@render}`, and `onevent`
   * attribute bindings with generated modifier wrappers.
   */
  mode?: SvelteMode;
}

/** The Svelte framework extension. */
export interface SvelteExtension extends FrameworkExtension {
  readonly key: 'svelte';
}

/**
 * Creates the Svelte framework extension.
 *
 * Renders a template as a Svelte component (`<Name>.svelte`): a
 * `<script lang="ts">` block with typed prop declarations, top-level
 * markup with block-based conditionals (`{#if}`), list rendering
 * (`{#each}` + key), slots, event bindings, and a `<style>` block. The
 * `mode` option selects the emitted dialect: legacy Svelte components
 * (`export let`, `<slot>`, `on:event`) or Svelte 5 runes components
 * (`$props()`, snippets and `{@render}`, `onevent` attributes).
 *
 * Styling supports all three output strategies. Scripting supports only
 * `in-file` - handlers live in `<script>`, where the markup's event
 * bindings resolve them.
 *
 * @example
 * const result = process(template, { extensions: [svelte()] });
 * // result.files[0] = { path: 'Button.svelte', content: '...' }
 *
 * @example
 * // Svelte 5 runes components:
 * const result = process(template, { extensions: [svelte({ mode: 'runes' })] });
 */
export function svelte(options: SvelteOptions = {}): SvelteExtension {
  const mode = options.mode ?? 'legacy';
  return {
    key: 'svelte',
    kind: 'framework',
    unsupportedStrategies: { scripting: ['inline', 'separate-file'] },
    compilesInDocumentStyles: true,
    render: (component, processingOptions) =>
      renderSvelteComponent(component, processingOptions, mode),
  };
}

function renderSvelteComponent(
  component: NormalizedComponent,
  options: ResolvedProcessingOptions,
  mode: SvelteMode
): ProcessResult {
  const warnings: Warning[] = [];
  const resolved = resolveComponentOverrides(component, 'svelte');
  const stylingStrategy = options.styling.outputStrategy;
  const language = options.styling.language;
  const styleExtension = language === 'scss' ? 'scss' : 'css';

  const plan = planTargets(
    resolved.children,
    stylingStrategy,
    'inline',
    resolved.selectorClasses
  );
  const css = collectCss(
    resolved,
    plan,
    stylingStrategy,
    language,
    options.styling.layer
  );
  const surface = discriminatedSurfaceOf(resolved.children);
  const passthroughNode = passthroughNodeOf(resolved.children);

  // A discriminated surface root: every branch is a passthrough element, so the
  // surface-contract declarations are emitted and each branch carries the
  // contract in the markup.
  const declaredProps = surface
    ? flattenDiscriminatedProps(
        resolved.props,
        surface.branches.map((entry) => entry.branch.props ?? {})
      )
    : resolved.props;
  const snippetProps =
    mode === 'runes' ? collectSnippetProps(resolved.children, declaredProps) : [];

  const context: SvelteContext = {
    plan,
    mode,
    stylingInline: stylingStrategy === 'inline',
    usesStyleSerializer: false,
    namedSlots: collectNamedSlotNames(resolved.children),
    // The slot props a projected snippet declaration would shadow read
    // through their aliased local bindings in the markup.
    slotPropAliases: new Map(
      snippetProps
        .filter((snippetProp) => snippetProp.localName !== snippetProp.propName)
        .map((snippetProp) => [snippetProp.propName, snippetProp.localName])
    ),
    passthroughNode,
    surfaceElements: surface
      ? new Set<ElementNode>(surface.branches.map((entry) => entry.element))
      : undefined,
    bemRuntimeCalls: resolved.bemRuntimeCalls,
    usesOnceHelper: false,
    usesPassiveAttachment: false,
    usesComposeHelper: false,
    componentValuedRootExpression: componentValuedRootExpressionOf(
      resolved.children
    ),
    warnings,
  };

  const hasPassthrough = passthroughNode !== undefined || surface !== undefined;

  const markup = renderNodes(resolved.children, '', 0, context).join('\n');
  const separateFile = stylingStrategy === 'separate-file' && css !== '';
  // The sibling stylesheet is emitted either way; `stylesheetLink: 'none'`
  // only drops the component's import of it.
  const importsStylesheet =
    separateFile && options.styling.stylesheetLink === 'component';
  const runesScript =
    mode === 'runes'
      ? buildRunesScript(
          resolved,
          importsStylesheet,
          styleExtension,
          context,
          runesPassthroughSurfaceOf(passthroughNode, surface !== undefined),
          declaredProps,
          snippetProps
        )
      : undefined;
  const scriptBlock =
    runesScript !== undefined
      ? runesScript.block
      : buildScript(
          resolved,
          importsStylesheet,
          styleExtension,
          context,
          hasPassthrough,
          declaredProps
        );
  const styleBlock = buildStyleBlock(css, stylingStrategy, language);

  // Svelte detects a component's dialect per file by rune presence, so a
  // generated runes component whose script carries no rune opts in
  // explicitly - otherwise it would silently compile as a legacy component.
  const runesOptionsTag =
    runesScript !== undefined && !runesScript.declaresRune
      ? '<svelte:options runes={true} />'
      : undefined;

  const sections = [runesOptionsTag, scriptBlock, markup, styleBlock].filter(
    (section): section is string => section !== undefined && section !== ''
  );

  const files: OutputFile[] = [
    { path: `${resolved.name}.svelte`, content: `${sections.join('\n\n')}\n` },
  ];
  if (separateFile) {
    files.push({
      path: `${resolved.name}.${styleExtension}`,
      content: `${css}\n`,
    });
  }

  return { files, warnings };
}

function buildScript(
  component: NormalizedComponent,
  importsStylesheet: boolean,
  styleExtension: string,
  context: SvelteContext,
  hasPassthrough: boolean,
  declaredProps: Record<string, PropDefinition>
): string | undefined {
  const sections: string[] = [];

  const imports = [...component.imports];
  if (component.bemRuntime !== undefined) {
    imports.unshift(
      `import { createBem } from '${component.bemRuntime.importSource}';`
    );
  }
  if (importsStylesheet) {
    imports.push(`import './${component.name}.${styleExtension}';`);
  }
  if (imports.length > 0) {
    sections.push(imports.join('\n'));
  }

  const props = exportLetDeclarations(declaredProps);
  if (props !== undefined) {
    sections.push(props);
  }

  // A component-valued dynamic root tag hoists to a reactive `RootTag` so the
  // markup's `typeof` branch and both arms share one evaluation; `$:` keeps it
  // in step with the props the expression reads.
  if (context.componentValuedRootExpression !== undefined) {
    sections.push(
      `$: ${DYNAMIC_ROOT_BINDING} = ${context.componentValuedRootExpression};`
    );
  }

  if (component.bemRuntime !== undefined) {
    sections.push(`const bem = ${bemSetupCall(component.bemRuntime)};`);
  }

  if (hasPassthrough) {
    sections.push(passthroughDeclarations());
  }

  if (component.script !== undefined && component.script.trim() !== '') {
    sections.push(component.script.trim());
  }

  if (context.usesStyleSerializer) {
    sections.push(styleSerializerDeclaration());
  }

  if (sections.length === 0) {
    return undefined;
  }
  return `<script lang="ts">\n${sections.join('\n\n')}\n</script>`;
}

/**
 * The expression of a component-valued dynamic root tag, if the component's
 * single rendered root carries one. The script builder hoists it to the
 * `RootTag` binding the markup's `typeof` branch resolves; a plain (string-
 * valued) dynamic root returns `undefined` and keeps the bare
 * `<svelte:element>` form.
 */
function componentValuedRootExpressionOf(
  children: readonly TemplateNode[]
): string | undefined {
  const rendered = children.filter((node) => node.type !== 'comment');
  if (rendered.length !== 1) {
    return undefined;
  }
  const root = rendered[0];
  if (
    root.type === 'element' &&
    isDynamicTag(root.tag) &&
    root.tag.componentValued === true
  ) {
    return root.tag.$expression;
  }
  return undefined;
}

/**
 * The rest-attribute surface of a runes component's passthrough root, if it
 * has one: a static intrinsic tag indexes `SvelteHTMLElements`, while a
 * dynamic root tag or a discriminated surface - whose rendered element is
 * only known at runtime - types against `HTMLAttributes<HTMLElement>`.
 */
function runesPassthroughSurfaceOf(
  passthroughNode: ElementNode | undefined,
  discriminated: boolean
): RunesPassthroughSurface | undefined {
  if (discriminated) {
    return { kind: 'dynamic' };
  }
  if (passthroughNode === undefined) {
    return undefined;
  }
  return isDynamicTag(passthroughNode.tag)
    ? { kind: 'dynamic' }
    : { kind: 'static', tag: staticTagOf(passthroughNode.tag) };
}

/** A built runes `<script>` block and whether it declares a rune. */
interface RunesScript {
  /** The `<script lang="ts">` block, or `undefined` when empty. */
  block: string | undefined;
  /**
   * True when the script carries a generated rune (`$props()` and, with it,
   * any `$bindable()`), which opts the file into runes mode by itself.
   */
  declaresRune: boolean;
}

/**
 * Builds the `<script lang="ts">` block of a runes component: imports, the
 * typed `Props` declaration and its `$props()` destructure, the BEM runtime
 * setup, the authored script verbatim, and the generated helpers the markup
 * used (the `once` event helper, the whole-object style serializer).
 */
function buildRunesScript(
  component: NormalizedComponent,
  importsStylesheet: boolean,
  styleExtension: string,
  context: SvelteContext,
  passthroughSurface: RunesPassthroughSurface | undefined,
  declaredProps: Record<string, PropDefinition>,
  snippetProps: SnippetProp[]
): RunesScript {
  const sections: string[] = [];

  const imports: string[] = [];
  if (component.bemRuntime !== undefined) {
    imports.push(
      `import { createBem } from '${component.bemRuntime.importSource}';`
    );
  }
  if (context.usesPassiveAttachment) {
    imports.push(`import { on } from 'svelte/events';`);
  }
  if (snippetProps.length > 0) {
    imports.push(`import type { Snippet } from 'svelte';`);
  }
  if (passthroughSurface !== undefined) {
    imports.push(
      passthroughSurface.kind === 'static'
        ? `import type { SvelteHTMLElements } from 'svelte/elements';`
        : `import type { HTMLAttributes } from 'svelte/elements';`
    );
  }
  imports.push(...component.imports);
  if (importsStylesheet) {
    imports.push(`import './${component.name}.${styleExtension}';`);
  }
  if (imports.length > 0) {
    sections.push(imports.join('\n'));
  }

  const declaration = runesPropsDeclaration(
    declaredProps,
    snippetProps,
    passthroughSurface
  );
  if (declaration !== undefined) {
    sections.push(declaration);
  }
  const destructure = runesPropsDestructure(
    declaredProps,
    snippetProps,
    passthroughSurface !== undefined
  );
  if (destructure !== undefined) {
    sections.push(destructure);
  }

  // A component-valued dynamic root tag hoists to a `$derived` `RootTag` so the
  // markup's `typeof` branch and both arms share one evaluation that tracks the
  // props the expression reads.
  if (context.componentValuedRootExpression !== undefined) {
    sections.push(
      `const ${DYNAMIC_ROOT_BINDING} = $derived(${context.componentValuedRootExpression});`
    );
  }

  if (component.bemRuntime !== undefined) {
    sections.push(`const bem = ${bemSetupCall(component.bemRuntime)};`);
  }

  if (component.script !== undefined && component.script.trim() !== '') {
    sections.push(component.script.trim());
  }

  if (context.usesComposeHelper) {
    sections.push(composeEventHandlersDeclaration());
  }

  if (context.usesOnceHelper) {
    sections.push(onceHelperDeclaration());
  }

  if (context.usesStyleSerializer) {
    sections.push(styleSerializerDeclaration());
  }

  return {
    block:
      sections.length === 0
        ? undefined
        : `<script lang="ts">\n${sections.join('\n\n')}\n</script>`,
    declaresRune: destructure !== undefined,
  };
}

/**
 * The runtime helper setup expression for a component, e.g.
 * `createBem('Badge')` or `createBem('Badge', { elementSeparator: '-' })`.
 */
function bemSetupCall(binding: BemRuntimeBinding): string {
  return `createBem('${binding.block}'${bemConfigArgument(binding)})`;
}

/**
 * The trailing config argument for a runtime helper call, present only when a
 * separator differs from the helper's defaults (`__` / `--`).
 */
function bemConfigArgument(binding: BemRuntimeBinding): string {
  const entries: string[] = [];
  if (binding.elementSeparator !== '__') {
    entries.push(`elementSeparator: '${binding.elementSeparator}'`);
  }
  if (binding.modifierSeparator !== '--') {
    entries.push(`modifierSeparator: '${binding.modifierSeparator}'`);
  }
  return entries.length > 0 ? `, { ${entries.join(', ')} }` : '';
}

/**
 * The generated whole-object style serializer: Svelte's `style` attribute
 * takes a string, so a style expression evaluating to an object of
 * camelCase property→value pairs serializes through this helper.
 *
 * A nullish entry is dropped rather than serialized. React's `style`
 * object and Vue's `normalizeStyle` both omit such a property, and without the
 * filter the value interpolates into the declaration as the text `undefined` -
 * harmless on a plain property, which is then simply invalid and dropped, but
 * silently wrong on a custom property, where `undefined` is a perfectly good
 * value and every `var()` reading it downstream gets the literal text instead
 * of its fallback.
 */
function styleSerializerDeclaration(): string {
  return [
    `function ${STYLE_SERIALIZER_NAME}(`,
    '  styleObject: Record<string, string | number | null | undefined> | null | undefined',
    '): string {',
    '  if (styleObject == null) {',
    "    return '';",
    '  }',
    '  return Object.entries(styleObject)',
    '    .filter(([, value]) => value != null)',
    '    .map(([property, value]) => {',
    "      const cssProperty = property.replace(",
    '        /[A-Z]/g,',
    '        (letter) => `-${letter.toLowerCase()}`',
    '      );',
    '      return `${cssProperty}: ${value}`;',
    '    })',
    "    .join('; ');",
    '}',
  ].join('\n');
}

/**
 * Renders the `<style>` block. Under `separate-file` the CSS is emitted as a
 * sibling `<Name>.css` - imported from `<script>` unless
 * `stylesheetLink: 'none'` leaves that to the consumer - so no `<style>`
 * block is produced either way. Otherwise all collected CSS - including the
 * nested-selector CSS the `inline` strategy cannot inline - lands in the
 * block.
 */
function buildStyleBlock(
  css: string,
  stylingStrategy: string,
  language: 'css' | 'scss'
): string | undefined {
  if (css === '' || stylingStrategy === 'separate-file') {
    return undefined;
  }
  const langAttribute = language === 'scss' ? ' lang="scss"' : '';
  return `<style${langAttribute}>\n${css}\n</style>`;
}
