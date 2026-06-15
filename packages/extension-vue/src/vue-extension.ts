import {
  collectCss,
  planTargets,
  resolveComponentOverrides,
  type FrameworkExtension,
  type NormalizedComponent,
  type ResolvedProcessingOptions,
} from '@js-template-engine/core';
import type {
  OutputFile,
  ProcessResult,
  Warning,
} from '@js-template-engine/types';

import { renderNodes, type VueContext } from './markup';
import type { VueComponentOverride } from './overrides';
import { definePropsStatement, propsInterface } from './props';

/** The Vue framework extension. */
export interface VueExtension extends FrameworkExtension {
  readonly key: 'vue';
}

/**
 * Creates the Vue framework extension.
 *
 * Renders a template as a Vue Single File Component (`<Name>.vue`): a
 * `<script setup lang="ts">` block with a generated props interface and
 * `defineProps`/`withDefaults`, a `<template>` block with directive-based
 * conditionals (`v-if`), list rendering (`v-for` + `:key`), slots, event
 * bindings with native modifiers, and a `<style>` block.
 *
 * Styling supports all three output strategies; the `<style>` block can be
 * scoped with the component-level `extensions.vue.scoped` option. Scripting
 * supports only `in-file` — handlers live in `<script setup>`, where the
 * template's `@event` bindings resolve them.
 *
 * @example
 * const result = process(template, { extensions: [vue()] });
 * // result.files[0] = { path: 'Button.vue', content: '...' }
 */
export function vue(): VueExtension {
  return {
    key: 'vue',
    kind: 'framework',
    unsupportedStrategies: { scripting: ['inline', 'separate-file'] },
    compilesInDocumentStyles: true,
    render: renderVueComponent,
  };
}

function renderVueComponent(
  component: NormalizedComponent,
  options: ResolvedProcessingOptions
): ProcessResult {
  const warnings: Warning[] = [];
  const resolved = resolveComponentOverrides(component, 'vue');
  const stylingStrategy = options.styling.outputStrategy;
  const language = options.styling.language;

  const plan = planTargets(
    resolved.children,
    stylingStrategy,
    'inline',
    resolved.selectorClasses
  );
  const css = collectCss(resolved, plan, stylingStrategy, language);

  const context: VueContext = {
    plan,
    stylingInline: stylingStrategy === 'inline',
    warnings,
  };

  const markup = renderNodes(resolved.children, '', 1, context);
  const templateBlock = `<template>\n${markup.join('\n')}\n</template>`;
  const scriptBlock = buildScriptSetup(resolved);
  const scoped = resolveScoped(component, stylingStrategy, warnings);
  const styleBlock = buildStyleBlock(
    css,
    stylingStrategy,
    scoped,
    resolved.name,
    language
  );

  const sections = [scriptBlock, templateBlock, styleBlock].filter(
    (section): section is string => section !== undefined
  );

  const files: OutputFile[] = [
    { path: `${resolved.name}.vue`, content: `${sections.join('\n\n')}\n` },
  ];
  if (css !== '' && stylingStrategy === 'separate-file') {
    const extension = language === 'scss' ? 'scss' : 'css';
    files.push({
      path: `${resolved.name}.${extension}`,
      content: `${css}\n`,
    });
  }

  return { files, warnings };
}

function buildScriptSetup(component: NormalizedComponent): string | undefined {
  const sections: string[] = [];

  if (component.imports.length > 0) {
    sections.push(component.imports.join('\n'));
  }

  const interfaceBlock = propsInterface(component.name, component.props);
  const defineBlock = definePropsStatement(component.name, component.props);
  const propsSection = [interfaceBlock, defineBlock].filter(
    (block): block is string => block !== undefined
  );
  if (propsSection.length > 0) {
    sections.push(propsSection.join('\n\n'));
  }

  if (component.script !== undefined && component.script.trim() !== '') {
    sections.push(component.script.trim());
  }

  if (sections.length === 0) {
    return undefined;
  }
  return `<script setup lang="ts">\n${sections.join('\n\n')}\n</script>`;
}

/**
 * Reads the component-level `extensions.vue.scoped` flag. It applies only
 * to the in-file `<style>` block; under the other styling strategies there
 * is no SFC style block to scope, so a requested `scoped` is ignored with
 * a warning.
 */
function resolveScoped(
  component: NormalizedComponent,
  stylingStrategy: string,
  warnings: Warning[]
): boolean {
  const override = component.extensions['vue'] as
    | VueComponentOverride
    | undefined;
  if (override?.scoped !== true) {
    return false;
  }
  if (stylingStrategy !== 'in-file') {
    warnings.push({
      message: `The 'scoped' option applies only to the in-file styling strategy; ignored under '${stylingStrategy}'`,
      nodePath: 'extensions.vue.scoped',
    });
    return false;
  }
  return true;
}

function buildStyleBlock(
  css: string,
  stylingStrategy: string,
  scoped: boolean,
  componentName: string,
  language: 'css' | 'scss'
): string | undefined {
  if (css === '') {
    return undefined;
  }
  const extension = language === 'scss' ? 'scss' : 'css';
  if (stylingStrategy === 'separate-file') {
    return `<style src="./${componentName}.${extension}"></style>`;
  }
  const langAttribute = language === 'scss' ? ' lang="scss"' : '';
  return `<style${langAttribute}${scoped ? ' scoped' : ''}>\n${css}\n</style>`;
}
