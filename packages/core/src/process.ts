import type {
  Attributes,
  NestedStyleObject,
  ProcessingOptions,
  ProcessResult,
  Template,
  TemplateNode,
} from '@js-template-engine/types';

import { isExpressionBinding } from './expression-binding';
import {
  isFrameworkExtension,
  type FrameworkExtension,
  type ResolvedProcessingOptions,
} from './extension';
import { renderHtml } from './html/render-html';
import { normalizeTemplate, type NormalizedComponent } from './normalize';
import { applyStylingExtensions } from './styling-extensions';
import { TemplateError } from './TemplateError';
import { validateTemplate } from './validate';

/**
 * Processes a template into output files.
 *
 * The pipeline validates the template (throwing a `TemplateError` with a
 * node path on the first violation), then renders it — with the built-in
 * HTML renderer, or with the framework extension passed in
 * `options.extensions`. Styling and scripting each default to the
 * `in-file` output strategy.
 *
 * @param template - The template to process.
 * @param options - Processing options; extensions are passed directly.
 * @returns The generated files and any non-fatal warnings.
 *
 * @example
 * const result = process(template, { componentName: 'Button' });
 * // result.files[0] = { path: 'Button.html', content: '...' }
 */
export function process(
  template: Template,
  options: ProcessingOptions = {}
): ProcessResult {
  validateTemplate(template);

  const resolved: ResolvedProcessingOptions = {
    componentName: options.componentName ?? 'Component',
    extensions: options.extensions ?? [],
    styling: {
      language: options.styling?.language ?? 'css',
      outputStrategy: options.styling?.outputStrategy ?? 'in-file',
    },
    scripting: {
      language: options.scripting?.language ?? 'javascript',
      outputStrategy: options.scripting?.outputStrategy ?? 'in-file',
    },
  };

  const component = normalizeTemplate(template, resolved.componentName);

  assertIncludeReach(component, resolved);

  const frameworks = resolved.extensions.filter(isFrameworkExtension);
  if (frameworks.length > 1) {
    throw new TemplateError(
      `At most one framework extension may be passed per process() call; received: ${frameworks
        .map((extension) => extension.key)
        .join(', ')}`
    );
  }

  const styling = applyStylingExtensions(component, resolved.extensions);

  const framework = frameworks[0];
  assertLanguageSupport(framework, resolved);
  assertScriptLanguageSupport(framework, resolved);
  let result: ProcessResult;
  if (framework === undefined) {
    result = renderHtml(styling.component, resolved);
  } else {
    assertStrategySupport(framework, resolved);
    result = framework.render(styling.component, resolved);
  }

  if (styling.warnings.length === 0) {
    return result;
  }
  return { ...result, warnings: [...styling.warnings, ...result.warnings] };
}

/**
 * Enforces the `'scss'` styling-language reach: it requires a compile step,
 * so the react target and HTML mode (neither of which compiles in-document
 * style blocks) support it only with the `separate-file` strategy. Vue and
 * Svelte declare `compilesInDocumentStyles` and are exempt. A processing
 * error, never a silent fallback.
 */
function assertLanguageSupport(
  framework: FrameworkExtension | undefined,
  options: ResolvedProcessingOptions
): void {
  if (options.styling.language !== 'scss') {
    return;
  }
  if (options.styling.outputStrategy === 'separate-file') {
    return;
  }
  if (framework?.compilesInDocumentStyles === true) {
    return;
  }
  const target = framework?.key ?? 'html';
  throw new TemplateError(
    `The '${target}' target supports the 'scss' styling language only with the 'separate-file' output strategy; received '${options.styling.outputStrategy}'`
  );
}

/**
 * Enforces the `'typescript'` scripting-language reach: it requires a
 * compile step, so HTML mode — whose script is a
 * browser-run `<script>` block or `on*` attribute — supports it only with
 * the `separate-file` strategy (emitting `<Name>.ts`); `in-file`/`inline`
 * are a processing error, never a silent fallback. The framework targets
 * emit TypeScript intrinsically (their renderers produce `.tsx` /
 * `<script setup lang="ts">` / `<script lang="ts">` regardless), so the
 * language axis is a no-op for them — never an error.
 */
function assertScriptLanguageSupport(
  framework: FrameworkExtension | undefined,
  options: ResolvedProcessingOptions
): void {
  if (options.scripting.language !== 'typescript') {
    return;
  }
  if (framework !== undefined) {
    return;
  }
  if (options.scripting.outputStrategy === 'separate-file') {
    return;
  }
  throw new TemplateError(
    `The 'html' target supports the 'typescript' scripting language only with the 'separate-file' output strategy; received '${options.scripting.outputStrategy}'`
  );
}

/**
 * Enforces the `$include` reach: a `$include`
 * is Sass source that only a sass build can resolve, so it requires
 * `styling.language: 'scss'`. Under `'css'` there is no sass build to
 * resolve it — a processing error naming the node path, never a silent
 * fallback (the engine does not resolve Sass source). The strategy reach is
 * handled separately: `'scss'` + `inline` on the react/HTML targets is
 * already a language-reach error (`assertLanguageSupport`), and on Vue/
 * Svelte the `$include` block rides the SFC `<style lang="scss">`.
 */
function assertIncludeReach(
  component: NormalizedComponent,
  options: ResolvedProcessingOptions
): void {
  if (options.styling.language === 'scss') {
    return;
  }
  const path = findIncludePath(component.children, 'children');
  if (path !== undefined) {
    throw new TemplateError(
      "A '$include' requires styling.language: 'scss'; there is no sass build to resolve it under 'css'",
      path
    );
  }
}

/**
 * Returns the node path of the first style carrying a `$include`, or
 * `undefined`. Walks the same node shapes as validation, checking each
 * element's `style` and its `conditionalAttributes` styles.
 */
function findIncludePath(
  nodes: TemplateNode[],
  path: string
): string | undefined {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const nodePath = `${path}[${index}]`;
    if (node.type === 'element') {
      if (styleHasInclude(node.attributes?.style)) {
        return `${nodePath}.style`;
      }
      for (let c = 0; c < (node.conditionalAttributes?.length ?? 0); c += 1) {
        if (styleHasInclude(node.conditionalAttributes?.[c].attributes.style)) {
          return `${nodePath}.conditionalAttributes[${c}].style`;
        }
      }
    }
    const found = findIncludePath(childNodesOf(node), `${nodePath}${childPathSuffix(node)}`);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

function styleHasInclude(style: Attributes['style']): boolean {
  if (style === undefined || isExpressionBinding(style)) {
    return false;
  }
  return objectHasInclude(style);
}

function objectHasInclude(style: NestedStyleObject): boolean {
  if (style.$include !== undefined) {
    return true;
  }
  for (const value of Object.values(style)) {
    if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      !isExpressionBinding(value) &&
      objectHasInclude(value as NestedStyleObject)
    ) {
      return true;
    }
  }
  return false;
}

/** The child node array to recurse into for a node, mirroring validation. */
function childNodesOf(node: TemplateNode): TemplateNode[] {
  switch (node.type) {
    case 'element':
    case 'fragment':
    case 'iteration':
      return node.children ?? [];
    case 'slot':
      return node.fallback ?? [];
    case 'conditional':
      return node.conditions.flatMap((branch) => branch.children);
    default:
      return [];
  }
}

/** The path suffix added when recursing into a node's children. */
function childPathSuffix(node: TemplateNode): string {
  switch (node.type) {
    case 'slot':
      return '.fallback';
    case 'conditional':
      return '.conditions';
    default:
      return '.children';
  }
}

function assertStrategySupport(
  framework: FrameworkExtension,
  options: ResolvedProcessingOptions
): void {
  if (
    framework.unsupportedStrategies?.styling?.includes(
      options.styling.outputStrategy
    )
  ) {
    throw new TemplateError(
      `The '${framework.key}' extension does not support the '${options.styling.outputStrategy}' styling output strategy`
    );
  }
  if (
    framework.unsupportedStrategies?.scripting?.includes(
      options.scripting.outputStrategy
    )
  ) {
    throw new TemplateError(
      `The '${framework.key}' extension does not support the '${options.scripting.outputStrategy}' scripting output strategy`
    );
  }
}
