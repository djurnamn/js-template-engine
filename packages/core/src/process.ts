import type {
  NestedStyleObject,
  ProcessingOptions,
  ProcessResult,
  StylesheetPlacement,
  Template,
  Warning,
} from '@js-template-engine/types';

import {
  isTargetExtension,
  type ResolvedProcessingOptions,
  type TargetExtension,
} from './extension';
import { collectComponentReferenceWarnings } from './component-references';
import { collectEventOverrideWarnings } from './event-overrides';
import { isExpressionBinding } from './expression-binding';
import { renderHtml } from './html/render-html';
import {
  collectUnresolvedSassWarnings,
  resolveSassStyles,
} from './html/resolve-sass';
import { collectSharedSelectorWarnings } from './html/styles';
import { normalizeTemplate, type NormalizedComponent } from './normalize';
import { collectOverrideKeyWarnings } from './override-keys';
import { collectRoutingWarnings } from './passthrough-routing';
import { reservedBindingNames, resolveReservedNames } from './reserved-names';
import { collectRestSpreadWarnings } from './rest-spread';
import { applyStylingExtensions } from './styling-extensions';
import { TemplateError } from './TemplateError';
import { visitElements } from './traverse';
import { validateTemplate } from './validate';

/**
 * Processes a template into output files.
 *
 * The pipeline validates the template for the extensions passed (throwing a
 * `TemplateError` with a node path for each violation), then renders it - with the built-in
 * HTML renderer, or with the target extension passed in
 * `options.extensions`. Styling defaults to the `in-file` stylesheet
 * placement.
 * The `scripting` option is deprecated and has no effect: no target emits a
 * script the option could shape.
 *
 * A template is trusted input: an expression that reads only the
 * component's declared ids is run as JavaScript to print its value in the
 * html output, and `renderInstance` runs every expression.
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
  validateTemplate(template, {
    extensions: options.extensions,
    reserveNamesOf: options.reserveNamesOf,
  });

  const placement = resolvePlacement(options);
  assertLayerShape(options);
  const resolved: ResolvedProcessingOptions = {
    componentName: options.componentName ?? 'Component',
    extensions: options.extensions ?? [],
    styling: {
      language: options.styling?.language ?? 'css',
      placement,
      outputStrategy: placement,
      stylesheetLink: options.styling?.stylesheetLink ?? 'component',
      loadPaths: options.styling?.loadPaths ?? [],
      sassImporters: options.styling?.sassImporters ?? [],
      layer: options.styling?.layer,
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

  const targets = resolved.extensions.filter(isTargetExtension);
  if (targets.length > 1) {
    throw new TemplateError(
      `At most one target extension may be passed per process() call; received: ${targets
        .map((extension) => extension.key)
        .join(', ')}`
    );
  }

  const styling = applyStylingExtensions(component, resolved.extensions);

  const target = targets[0];
  assertStylesheetLinkSupport(resolved);
  assertLanguageSupport(target, resolved);
  let result: ProcessResult;
  if (target === undefined) {
    result = renderHtml(styling.component, resolved);
  } else {
    assertPlacementSupport(target, resolved);
    // The names the build's extensions, and those it reserves names of,
    // declare in every component, which the target's prop aliases steer
    // clear of.
    const reservedNames = reservedBindingNames(
      resolveReservedNames(
        [...resolved.extensions, ...(options.reserveNamesOf ?? [])],
        { template, twoWayProps: [] }
      )
    );
    result = target.render({ ...styling.component, reservedNames }, resolved);
  }

  const deprecations = [
    ...placementDeprecations(options),
    ...scriptingDeprecations(options),
    ...collectIncludeDeprecations(normalized),
  ];
  // A static preview spreads nothing, so the rest-spread hazard is a
  // scripted target's alone.
  const restSpreads =
    target === undefined
      ? []
      : [
          ...collectRestSpreadWarnings(
            styling.component,
            target,
            resolved.styling.placement
          ),
          ...collectRoutingWarnings(
            normalized.children,
            Array.isArray(template) ? '' : 'children'
          ),
        ];
  // A component reference and a tag override are a scripted target's alone:
  // the html target writes a reference as a comment, which needs no import,
  // and reads no override.
  const rootPath = Array.isArray(template) ? '' : 'children';
  const references =
    target === undefined
      ? []
      : [
          ...collectComponentReferenceWarnings(
            normalized,
            target.key,
            target.builtInComponents,
            rootPath,
            target.globalComponentRegistration === true,
            target.resolveComponentOverrides
          ),
        ];
  const overrideKeys = collectOverrideKeyWarnings(
    normalized,
    resolved.extensions,
    rootPath
  );
  // Only the target being built renders its events override.
  const eventOverrides =
    target === undefined
      ? []
      : collectEventOverrideWarnings(normalized, target.key, rootPath);
  // Every target writes the same stylesheet, so a shared selector styled
  // two ways warns in each.
  const sharedSelectors = collectSharedSelectorWarnings(
    styling.component,
    resolved.styling.placement,
    rootPath
  );
  const unresolvedSass = collectUnresolvedSassWarnings(
    styling.component,
    resolved.styling.language,
    rootPath
  );
  if (
    styling.warnings.length === 0 &&
    sharedSelectors.length === 0 &&
    unresolvedSass.length === 0 &&
    deprecations.length === 0 &&
    restSpreads.length === 0 &&
    references.length === 0 &&
    overrideKeys.length === 0 &&
    eventOverrides.length === 0
  ) {
    return result;
  }
  return {
    ...result,
    warnings: [
      ...deprecations,
      ...overrideKeys,
      ...eventOverrides,
      ...styling.warnings,
      ...sharedSelectors,
      ...unresolvedSass,
      ...restSpreads,
      ...references,
      ...result.warnings,
    ],
  };
}

/**
 * Resolves the stylesheet placement from `styling.placement` and its
 * deprecated alias `styling.outputStrategy`, defaulting to `'in-file'`.
 * Both set to different placements is a processing error.
 */
function resolvePlacement(options: ProcessingOptions): StylesheetPlacement {
  const placement = options.styling?.placement;
  const outputStrategy = options.styling?.outputStrategy;
  if (
    placement !== undefined &&
    outputStrategy !== undefined &&
    placement !== outputStrategy
  ) {
    throw new TemplateError(
      `'styling.placement' ('${placement}') and the deprecated 'styling.outputStrategy' ('${outputStrategy}') are both set and differ; keep styling.placement`
    );
  }
  return placement ?? outputStrategy ?? 'in-file';
}

/**
 * Checks the shape of `styling.layer` when it is passed: an object whose
 * `name` is a non-empty string, with an `order` that is a list of strings
 * or absent. A JavaScript caller or a kit's configuration can hand the
 * option a bare string, which would otherwise be written as the layer name
 * `undefined`.
 */
function assertLayerShape(options: ProcessingOptions): void {
  const layer: unknown = options.styling?.layer;
  if (layer === undefined) {
    return;
  }
  const described = (value: unknown): string =>
    Array.isArray(value)
      ? 'an array'
      : value === null
        ? 'null'
        : typeof value === 'string'
          ? `the string '${value}'`
          : `a ${typeof value}`;
  if (typeof layer !== 'object' || layer === null || Array.isArray(layer)) {
    throw new TemplateError(
      `'styling.layer' must be an object with a 'name' (such as { name: 'components' }); got ${described(layer)}`
    );
  }
  const { name, order } = layer as { name?: unknown; order?: unknown };
  if (typeof name !== 'string' || name.trim() === '') {
    throw new TemplateError(
      `'styling.layer.name' must be a non-empty string naming the cascade layer; got ${name === undefined ? 'no name' : typeof name === 'string' ? 'an empty string' : described(name)}`
    );
  }
  if (
    order !== undefined &&
    (!Array.isArray(order) ||
      order.some((entry) => typeof entry !== 'string' || entry.trim() === ''))
  ) {
    throw new TemplateError(
      `'styling.layer.order' must be a list of layer names; got ${Array.isArray(order) ? 'a list with an entry that is not a non-empty string' : described(order)}`
    );
  }
}

/**
 * The processing warning emitted when `styling.outputStrategy` is passed
 * without `styling.placement`.
 */
const OUTPUT_STRATEGY_DEPRECATION_MESSAGE =
  "The 'styling.outputStrategy' option is deprecated and will be removed " +
  "in 3.0.0; use 'styling.placement', which takes the same values.";

/**
 * Returns the `styling.outputStrategy` deprecation warning when the old key
 * is passed and `styling.placement` is not.
 */
function placementDeprecations(options: ProcessingOptions): Warning[] {
  return options.styling?.outputStrategy !== undefined &&
    options.styling.placement === undefined
    ? [{ message: OUTPUT_STRATEGY_DEPRECATION_MESSAGE }]
    : [];
}

/** The processing warning emitted when the `scripting` option is passed. */
const SCRIPTING_DEPRECATION_MESSAGE =
  "The 'scripting' option is deprecated, has no effect and will be removed " +
  'in 3.0.0; the html target writes events as comments and emits no script.';

/**
 * Returns the `scripting` deprecation warning when the option is passed at
 * all, whatever its values.
 */
function scriptingDeprecations(options: ProcessingOptions): Warning[] {
  return options.scripting === undefined
    ? []
    : [{ message: SCRIPTING_DEPRECATION_MESSAGE }];
}

/** The processing warning emitted once per template that uses `$include`. */
const INCLUDE_DEPRECATION_MESSAGE =
  "The '$include' style key is deprecated and will be removed in 3.0.0; " +
  'use an \'@include ...\' at-rule key instead (e.g. "@include name": true for ' +
  'a no-content include, or "@include name": { ... } for a content block).';

/**
 * Returns the `$include` deprecation warning when any node's style (top-level
 * or nested, including conditional attributes) carries the legacy `$include`
 * key - a single notice per template, not one per occurrence. The blessed
 * form is the `@include ...` at-rule key.
 */
function collectIncludeDeprecations(component: NormalizedComponent): Warning[] {
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
function styleUsesDollarInclude(style: NestedStyleObject | undefined): boolean {
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
 * Enforces the `stylesheetLink` reach: leaving the emitted stylesheet
 * unlinked is meaningful only under the `separate-file` placement, the one
 * that emits a stylesheet of its own. Under `in-file` and `inline` there is
 * no separate file to leave unlinked, so `'none'` is a processing error
 * rather than a silently ignored option.
 */
function assertStylesheetLinkSupport(options: ResolvedProcessingOptions): void {
  if (options.styling.stylesheetLink !== 'none') {
    return;
  }
  if (options.styling.placement === 'separate-file') {
    return;
  }
  throw new TemplateError(
    `The 'none' stylesheet link requires the 'separate-file' stylesheet placement - ` +
      `there is no separate stylesheet to leave unlinked under '${options.styling.placement}'`
  );
}

/**
 * Enforces the `'scss'` styling-language reach: it requires a compile step,
 * so the react and html targets (neither of which compiles in-document
 * style blocks) support it only with the `separate-file` placement. Vue and
 * Svelte declare `compilesInDocumentStyles` and are exempt. A processing
 * error, never a silent fallback.
 */
function assertLanguageSupport(
  target: TargetExtension | undefined,
  options: ResolvedProcessingOptions
): void {
  if (options.styling.language !== 'scss') {
    return;
  }
  if (options.styling.placement === 'separate-file') {
    return;
  }
  if (target?.compilesInDocumentStyles === true) {
    return;
  }
  const targetKey = target?.key ?? 'html';
  throw new TemplateError(
    `The '${targetKey}' target supports the 'scss' styling language only with the 'separate-file' stylesheet placement; received '${options.styling.placement}'`
  );
}

/**
 * Enforces a target's `unsupportedPlacements` (or the deprecated
 * `unsupportedStrategies.styling` when it declares none): requesting one is a
 * processing error, never a silent fallback.
 */
function assertPlacementSupport(
  target: TargetExtension,
  options: ResolvedProcessingOptions
): void {
  const unsupported =
    target.unsupportedPlacements ?? target.unsupportedStrategies?.styling;
  if (unsupported?.includes(options.styling.placement)) {
    throw new TemplateError(
      `The '${target.key}' extension does not support the '${options.styling.placement}' stylesheet placement`
    );
  }
}
