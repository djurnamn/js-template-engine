/**
 * Type definitions for the js-template-engine template format.
 *
 * A template is plain serializable data: anything expressible in these
 * types is expressible in JSON. The package ships a generated JSON Schema
 * (`schema/template.schema.json`) for validating the JSON transport form.
 */
export type {
  AttributeOverrides,
  Attributes,
  AttributeValue,
  ClassEntry,
  ConditionalAttributes,
  ExpressionBinding,
} from './attributes';
export { defineTemplate } from './define-template';
export type {
  EventDefinition,
  EventModifier,
  KeyEventModifier,
} from './events';
export type {
  ComponentExtensionOverride,
  ComponentExtensionOverrides,
  ExtensionOverrides,
  FragmentExtensionOverrides,
  FragmentOverride,
  OverrideStrategy,
} from './extension-overrides';
export type { JsonValue } from './json-value';
export type {
  Extension,
  ExtensionOverrideKeys,
  OutputFile,
  OutputStrategy,
  OverrideValidationContext,
  ProcessingOptions,
  ProcessResult,
  ReservedName,
  ReservedNameContext,
  ScriptingOptions,
  StyleLayer,
  StylesheetLink,
  StylesheetPlacement,
  StylingOptions,
  TemplateViolation,
  Warning,
} from './processing';
export type {
  BindableDefinition,
  CopiedBindableDefinition,
  PropDefinition,
  RelayedBindableDefinition,
} from './props';
export type { NestedSelectorBlock, NestedStyleObject } from './styles';
export type {
  CommentNode,
  ComponentNode,
  ConditionalBranch,
  ConditionalNode,
  ConditionalStatement,
  DeclaredId,
  DynamicTag,
  ElementNode,
  ExposedBinding,
  FragmentNode,
  IterationNode,
  NamedSlotContent,
  PassthroughRouting,
  RestDefinition,
  SlotNode,
  Template,
  TypeParameter,
  TemplateNode,
  TextNode,
} from './template-nodes';
