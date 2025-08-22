/**
 * Svelte-specific type definitions
 */

/**
 * Svelte-specific event output interface
 */
export interface SvelteEventOutput {
  directive: string;
  handler: string;
  modifiers: string[];
  parameters: string[];
  nodeId: string;
  syntax: string;
}

/**
 * Svelte-specific conditional output interface
 */
export interface SvelteConditionalOutput {
  condition: string;
  thenContent: string;
  elseContent: string | null;
  nodeId: string;
  syntax: string;
}

/**
 * Svelte-specific iteration output interface
 */
export interface SvelteIterationOutput {
  vEachExpression: string;
  keyExpression: string;
  items: string;
  itemVariable: string;
  indexVariable?: string;
  childContent: string;
  nodeId: string;
  syntax: string;
}

/**
 * Svelte-specific slot output interface
 */
export interface SvelteSlotOutput {
  name: string;
  fallback: string | null;
  nodeId: string;
  syntax: string;
}

/**
 * Svelte-specific attribute output interface
 */
export interface SvelteAttributeOutput {
  originalName: string;
  svelteName: string;
  value: string | boolean;
  isExpression: boolean;
  isDirective: boolean;
  isBinding: boolean;
  nodeId: string;
  syntax: string;
}

/**
 * Svelte attribute info interface
 */
export interface SvelteAttributeInfo {
  name: string;
  isDirective: boolean;
  isBinding: boolean;
  syntax: string;
}

/**
 * Svelte component generation configuration
 */
export interface SvelteComponentConfig {
  name: string;
  imports: string[];
  script: string;
  props: Record<string, string>;
  concepts: import('@js-template-engine/core').ComponentConcept;
  context: import('@js-template-engine/core').RenderContext;
}

/**
 * Svelte reactive variable interface
 */
export interface SvelteReactiveVariable {
  statement: string;
  dependencies: string[];
}

/**
 * Svelte action info interface
 */
export interface SvelteActionInfo {
  name: string;
  parameters: string;
  syntax: string;
}

/**
 * Svelte feature analysis interface
 */
export interface SvelteFeatureAnalysis {
  stores: string[];
  lifecycle: string[];
  transitions: string[];
  actions: string[];
}

/**
 * Template node interface
 */
export interface TemplateNode {
  type?: string;
  tag?: string;
  content?: string;
  attributes?: Record<string, any>;
  children?: TemplateNode[];
  [key: string]: any;
}