/**
 * The toolkit for target extensions: the helpers the first-party
 * target extensions build their output with - prop aliases, two-way
 * value plumbing, expression scanning, passthrough routing, sibling line
 * layout, class and handler code - imported from
 * `@js-template-engine/core/emitter`.
 *
 * They are shaped by what the first-party extensions need. Templates, kit
 * tools and `process()` callers use the main entry point.
 */
export { applyComponentOverride } from './component-overrides';
export { resolveReservedNames } from './reserved-names';
export {
  collectOverrideKeyWarnings,
  COMPONENT_OVERRIDE_KEYS,
  TARGET_NODE_OVERRIDE_KEYS,
} from './override-keys';
export { isPropertyOnlyName } from './boolean-attributes';
export { dynamicElementTypeOf, elementTypeOf } from './element-types';
export { documentationComment, propDocumentation } from './prop-documentation';
export { optionalPropType } from './optional-prop-type';
export {
  AUTHORED_OR_CONSUMER,
  authoredOrConsumerDeclaration,
} from './authored-or-consumer';
export {
  CONSUMER_AND_SPREAD,
  CONSUMER_AND_SPREAD_BINDING,
  consumerAndSpreadDeclaration,
  type ConsumerAndSpreadSpelling,
} from './consumer-and-spread';
export {
  flattenTemplateLiterals,
  readExpressionIdentifiers,
  tokenizeExpression,
  topLevelDeclarations,
  type ExpressionToken,
  type IdentifierReading,
} from './expression-scope';
export { arrowBodyOf, derivedComment } from './derived-values';
export {
  GENERATED_ID_COUNTER_KEY,
  GENERATED_ID_NAME,
  GENERATED_ID_NEXT_NAME,
  idExpression,
  nextGeneratedIdDeclaration,
} from './declared-ids';
export {
  camelizePropName,
  isBindableName,
  isIdentifier,
  localAlias,
  normalizeSlotName,
  propAliases,
  scriptDeclarations,
  scriptShadowedPropAliases,
  type PropAliasScope,
} from './local-bindings';
export {
  admitsFunction,
  echoGuardName,
  isBindableDefinition,
  isCopiedBindableDefinition,
  isFunctionType,
  isRelayedBindableDefinition,
  latestValueName,
  ownSetterName,
  ownValueName,
  relayedComment,
  relayedReportLines,
  twoWayCodeProps,
  twoWayComment,
  twoWayCurrentType,
  twoWaySeed,
  twoWaySetterLines,
  type RelayedReportParts,
  type TwoWaySeed,
  type TwoWaySetterParts,
} from './two-way-bindings';
export { mergeAttributeOverride } from './attribute-overrides';
export { literalMembersWithoutRest, readsRest } from './rest-spread';
export { fragmentWrapper } from './fragment-wrapper';
export {
  childSiblingLayout,
  DOCUMENT_SIBLING_LAYOUT,
  joinSiblingLines,
  tagLines,
  textLines,
  type LineBreakPlacement,
  type SiblingLayout,
  type SiblingLines,
} from './sibling-lines';
export { generatedNodeValue } from './html/targeting';
export { EVENT_MODIFIERS, isEventModifier } from './key-event-modifiers';
export {
  boundHandler,
  handlerCallStatement,
  INVOKE_HANDLER,
  invokeHandlerDeclaration,
  usesInvokeHandler,
} from './handler-call';
export { selectedOptions } from './select-defaults';
export { withoutRemovedBemRuntimeCalls } from './bem-runtime';
export {
  classAttributeQuote,
  classStringLiteral,
  escapeClassAttributeValue,
  groupConditionalClasses,
  isReferenceExpression,
  joinConditions,
  quoteClassAttributeValue,
  withoutConditionalClasses,
  type ConditionalClassGroup,
} from './class-list';
export { escapeComment } from './html/escape';
export { propertiesInteract } from './merge-styles';
export {
  typeParameterArguments,
  typeParameterAttribute,
  typeParameterDeclarations,
  typeParameterScriptAttribute,
} from './normalize';
export {
  conditionalPassthroughOf,
  discriminantOf,
  type ConditionalPassthrough,
  type Discriminant,
} from './passthrough';
export {
  AUTHORED_AND_CONSUMER,
  authoredAndConsumerDeclaration,
  consumerAttributesDeclaration,
  CONSUMER_ATTRIBUTES,
  isInsideConditional,
  isPassthroughRouting,
  isRoutedAttribute,
  isTokenListAttribute,
  joinTokenLists,
  mergesTokenList,
  RESERVED_ROUTED_NAMES,
  routedAttributesDescription,
  routedElementOf,
  TOKEN_LIST_ATTRIBUTES,
  type RoutedElement,
} from './passthrough-routing';
export { importedNames } from './import-statements';
export { withShadowedSlotNames } from './slots';
export { validateComponentOverride } from './validate';
