import type {
  NestedStyleObject,
  ProcessingOptions,
  ProcessResult,
  Template,
  Warning,
} from '@js-template-engine/types';

import {
  isFrameworkExtension,
  type FrameworkExtension,
  type ResolvedProcessingOptions,
} from './extension';
import { isExpressionBinding } from './expression-binding';
import { renderHtml } from './html/render-html';
import { resolveSassStyles } from './html/resolve-sass';
import { normalizeTemplate, type NormalizedComponent } from './normalize';
import { applyStylingExtensions } from './styling-extensions';
import { TemplateError } from './TemplateError';
import { visitElements } from './traverse';
import { validateTemplate } from './validate';

/**
 * Processes a template into output files.
 *
 * The pipeline validates the template (throwing a `TemplateError` with a
 * node path on the first violation), then renders it - with the built-in
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
      loadPaths: options.styling?.loadPaths ?? [],
    },
    scripting: {
      language: options.scripting?.language ?? 'javascript',
      outputStrategy: options.scripting?.outputStrategy ?? 'in-file',
    },
  };

  const normalized = normalizeTemplate(template, resolved.componentName);

  // Under `css`/`inline` output, resolve Sass source (`@include`, functions,
  // `$variables`) to flat CSS before styling extensions and rendering; under
  // `scss` output it passes through verbatim for the consumer's own sass
  // build.
  const component = resolveSassStyles(normalized, resolved.styling);

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

  const deprecations = collectIncludeDeprecations(normalized);
  if (styling.warnings.length === 0 && deprecations.length === 0) {
    return result;
  }
  return {
    ...result,
    warnings: [...deprecations, ...styling.warnings, ...result.warnings],
  };
}

/** The processing warning emitted once per template that uses `$include`. */
const INCLUDE_DEPRECATION_MESSAGE =
  "The '$include' style key is deprecated and will be removed in 3.0.0; " +
  "use an '@include ...' at-rule key instead (e.g. \"@include name\": true for " +
  'a no-content include, or "@include name": { ... } for a content block).';

/**
 * Returns the `$include` deprecation warning when any node's style (top-level
 * or nested, including conditional attributes) carries the legacy `$include`
 * key - a single notice per template, not one per occurrence. The blessed
 * form is the `@include ...` at-rule key.
 */
function collectIncludeDeprecations(
  component: NormalizedComponent
): Warning[] {
  let found = false;
  visitElements(component.children, (element) => {
    if (styleUsesDollarInclude(element.attributes?.style)) {
      found = true;
    }
    for (const conditional of element.conditionalAttributes ?? []) {
      if (styleUsesDollarInclude(conditional.attributes.style)) {
        found = true;
      }
    }
  });
  return found ? [{ message: INCLUDE_DEPRECATION_MESSAGE }] : [];
}

/** Whether a style value carries a `$include` key, at any nesting depth. */
function styleUsesDollarInclude(
  style: NestedStyleObject | undefined
): boolean {
  // A whole-object `$expression` (a string-valued key) does not preclude a
  // `$include` sibling, so scan the object regardless; object-valued recursion
  // below naturally skips the string `$expression` key.
  if (style === undefined) {
    return false;
  }
  if (style.$include !== undefined) {
    return true;
  }
  for (const value of Object.values(style)) {
    if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      !isExpressionBinding(value) &&
      styleUsesDollarInclude(value as NestedStyleObject)
    ) {
      return true;
    }
  }
  return false;
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
 * compile step, so HTML mode - whose script is a
 * browser-run `<script>` block or `on*` attribute - supports it only with
 * the `separate-file` strategy (emitting `<Name>.ts`); `in-file`/`inline`
 * are a processing error, never a silent fallback. The framework targets
 * emit TypeScript intrinsically (their renderers produce `.tsx` /
 * `<script setup lang="ts">` / `<script lang="ts">` regardless), so the
 * language axis is a no-op for them - never an error.
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
