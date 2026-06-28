import {
  collectCss,
  collectNamedSlotNames,
  discriminatedSurfaceOf,
  flattenDiscriminatedProps,
  passthroughNodeOf,
  planTargets,
  resolveComponentOverrides,
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
  Warning,
} from '@js-template-engine/types';

import {
  renderNodes,
  STYLE_SERIALIZER_NAME,
  type SvelteContext,
} from './markup';
import { exportLetDeclarations, passthroughDeclarations } from './props';

/** The Svelte framework extension. */
export interface SvelteExtension extends FrameworkExtension {
  readonly key: 'svelte';
}

/**
 * Creates the Svelte framework extension.
 *
 * Renders a template as a Svelte component (`<Name>.svelte`): a
 * `<script lang="ts">` block with `export let` prop declarations, top-level
 * markup with block-based conditionals (`{#if}`), list rendering
 * (`{#each}` + key), slots, event bindings with native modifiers, and a
 * `<style>` block.
 *
 * Styling supports all three output strategies. Scripting supports only
 * `in-file` - handlers live in `<script>`, where the markup's `on:event`
 * bindings resolve them.
 *
 * @example
 * const result = process(template, { extensions: [svelte()] });
 * // result.files[0] = { path: 'Button.svelte', content: '...' }
 */
export function svelte(): SvelteExtension {
  return {
    key: 'svelte',
    kind: 'framework',
    unsupportedStrategies: { scripting: ['inline', 'separate-file'] },
    compilesInDocumentStyles: true,
    render: renderSvelteComponent,
  };
}

function renderSvelteComponent(
  component: NormalizedComponent,
  options: ResolvedProcessingOptions
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
  const css = collectCss(resolved, plan, stylingStrategy, language);
  const surface = discriminatedSurfaceOf(resolved.children);
  const passthroughNode = passthroughNodeOf(resolved.children);

  const context: SvelteContext = {
    plan,
    stylingInline: stylingStrategy === 'inline',
    usesStyleSerializer: false,
    namedSlots: collectNamedSlotNames(resolved.children),
    passthroughNode,
    surfaceElements: surface
      ? new Set<ElementNode>(surface.branches.map((entry) => entry.element))
      : undefined,
    bemRuntimeCalls: resolved.bemRuntimeCalls,
    warnings,
  };

  // A discriminated surface root: every branch is a passthrough element, so the
  // surface-contract declarations are emitted and each branch carries the
  // contract in the markup.
  const declaredProps = surface
    ? flattenDiscriminatedProps(
        resolved.props,
        surface.branches.map((entry) => entry.branch.props ?? {})
      )
    : resolved.props;
  const hasPassthrough = passthroughNode !== undefined || surface !== undefined;

  const markup = renderNodes(resolved.children, '', 0, context).join('\n');
  const separateFile = stylingStrategy === 'separate-file' && css !== '';
  const scriptBlock = buildScript(
    resolved,
    separateFile,
    styleExtension,
    context,
    hasPassthrough,
    declaredProps
  );
  const styleBlock = buildStyleBlock(css, stylingStrategy, language);

  const sections = [scriptBlock, markup, styleBlock].filter(
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
  separateFile: boolean,
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
  if (separateFile) {
    imports.push(`import './${component.name}.${styleExtension}';`);
  }
  if (imports.length > 0) {
    sections.push(imports.join('\n'));
  }

  const props = exportLetDeclarations(declaredProps);
  if (props !== undefined) {
    sections.push(props);
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
 */
function styleSerializerDeclaration(): string {
  return [
    `function ${STYLE_SERIALIZER_NAME}(`,
    '  styleObject: Record<string, string | number> | null | undefined',
    '): string {',
    '  if (styleObject == null) {',
    "    return '';",
    '  }',
    '  return Object.entries(styleObject)',
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
 * sibling `<Name>.css` imported from `<script>`, so no `<style>` block is
 * produced. Otherwise all collected CSS - including the nested-selector CSS
 * the `inline` strategy cannot inline - lands in the block.
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
