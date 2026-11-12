/**
 * Template engine core.
 *
 * Processes data-defined component templates into annotated HTML and CSS,
 * with target and styling extensions plugging in through
 * `ProcessingOptions.extensions`, and renders one instance of a template to
 * static markup for given props.
 */
export { resolveComponentOverrides } from './component-overrides';
export {
  dynamicRootTagExpressionOf,
  isDynamicTag,
  staticTagOf,
} from './dynamic-tag';
export { VOID_ELEMENTS } from './void-elements';
export {
  isExpressionBinding,
  nodeSpreads,
  wholeStyleExpression,
} from './expression-binding';
export {
  isFrameworkExtension,
  isTargetExtension,
  type FrameworkExtension,
  type TargetExtension,
  type ResolvedProcessingOptions,
  type ResolvedScriptingOptions,
  type ResolvedStylingOptions,
} from './extension';
export { derivedValuesOf, type DerivedValue } from './derived-values';
export { declaredIdsOf, type DeclaredId } from './declared-ids';
export { renderHtml } from './html/render-html';
export {
  isEventType,
  relayedBindingsOf,
  twoWayBindingsOf,
  type RelayedBinding,
  type TwoWayBinding,
} from './two-way-bindings';
export {
  renderInstance,
  type HandWrittenComponent,
  type InstanceResult,
  type InstanceSlotContent,
  type RenderInstanceOptions,
} from './html/render-instance';
export {
  collectCss,
  LAYER_ORDER_MODULE_FILE,
  serializeInlineStyle,
  serializeRules,
  serializeRulesScss,
  layerOrderModuleFiles,
  stylesheetFiles,
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
export { formatBemCall, type BemConditionalModifier } from './bem-call';
export { parenthesizeClassExpression } from './class-expression';
export { mergeStyleObjects } from './merge-styles';
export {
  classExpressions,
  normalizeClassList,
  normalizeTemplate,
  type BemRuntimeBinding,
  type BemRuntimeCall,
  type CollapseVocabulary,
  type NormalizedComponent,
  type NormalizedTypeParameter,
} from './normalize';
export {
  discriminatedSurfaceOf,
  flattenDiscriminatedProps,
  passthroughNodeOf,
  RESERVED_PASSTHROUGH_PROPS,
  type DiscriminatedSurface,
  type DiscriminatedSurfaceBranch,
} from './passthrough';
export { partitionImports, type PartitionedImports } from './import-statements';
export { process } from './process';
export {
  applyStylingExtensions,
  isStylingExtension,
  type StylingApplication,
  type StylingContext,
  type StylingExtension,
  type StylingRuntime,
} from './styling-extensions';
export {
  collectNamedSlotNames,
  normalizeExposes,
  normalizeNamedSlots,
  rewriteSlotReferences,
  type NormalizedExposedBinding,
  type NormalizedNamedSlot,
  type SlotReferenceScope,
} from './slots';
export {
  TemplateError,
  templateErrorDetails,
  type TemplateErrorDetail,
} from './TemplateError';
export { visitElements, visitNodes } from './traverse';
export { validateTemplate, type ValidationOptions } from './validate';
