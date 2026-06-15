/**
 * Template engine core.
 *
 * Processes data-defined component templates into working HTML, CSS, and
 * JavaScript, with framework and styling extensions plugging in through
 * `ProcessingOptions.extensions`.
 */
export { resolveComponentOverrides } from './component-overrides';
export {
  dynamicRootTagExpressionOf,
  isDynamicTag,
  staticTagOf,
} from './dynamic-tag';
export { isExpressionBinding } from './expression-binding';
export {
  isFrameworkExtension,
  type FrameworkExtension,
  type ResolvedProcessingOptions,
  type ResolvedScriptingOptions,
  type ResolvedStylingOptions,
} from './extension';
export { renderHtml } from './html/render-html';
export {
  collectCss,
  serializeInlineStyle,
  serializeRules,
  serializeRulesScss,
  toKebabCaseProperty,
} from './html/styles';
export {
  GENERATED_NODE_ATTRIBUTE,
  hasExpressionProperties,
  hasIncludes,
  hasNestedSelectors,
  hasPlainProperties,
  planTargets,
  type ElementTarget,
  type TargetPlan,
} from './html/targeting';
export {
  isKeyEventModifier,
  KEY_EVENT_MODIFIER_KEYS,
  keyGuardStatement,
} from './key-event-modifiers';
export { mergeStyleObjects } from './merge-styles';
export {
  classExpressions,
  normalizeClassList,
  normalizeTemplate,
  type CollapseVocabulary,
  type NormalizedComponent,
} from './normalize';
export {
  passthroughNodeOf,
  RESERVED_PASSTHROUGH_PROPS,
} from './passthrough';
export { process } from './process';
export {
  applyStylingExtensions,
  isStylingExtension,
  type StylingApplication,
  type StylingContext,
  type StylingExtension,
} from './styling-extensions';
export { TemplateError } from './TemplateError';
export { visitElements } from './traverse';
export { validateTemplate } from './validate';
