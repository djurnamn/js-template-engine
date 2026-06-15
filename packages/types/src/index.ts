/**
 * Type definitions for the js-template-engine template format.
 *
 * A template is plain serializable data: anything expressible in these
 * types is expressible in JSON. The package ships a generated JSON Schema
 * (`schema/template.schema.json`) for validating the JSON transport form.
 */
export type {
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
  OverrideStrategy,
} from './extension-overrides';
export type { JsonValue } from './json-value';
export type {
  Extension,
  OutputFile,
  OutputStrategy,
  ProcessingOptions,
  ProcessResult,
  ScriptingOptions,
  StylingOptions,
  Warning,
} from './processing';
export type { PropDefinition } from './props';
export type { NestedSelectorBlock, NestedStyleObject } from './styles';
export type {
  CommentNode,
  ComponentNode,
  ConditionalBranch,
  ConditionalNode,
  ConditionalStatement,
  DynamicTag,
  ElementNode,
  FragmentNode,
  IterationNode,
  SlotNode,
  Template,
  TemplateNode,
  TextNode,
} from './template-nodes';
