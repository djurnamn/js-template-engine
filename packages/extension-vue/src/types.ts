import type {
  RenderOptions,
  BaseExtensionOptions,
} from '@js-template-engine/types';

/**
 * Vue extension options
 */
export interface VueExtensionOptions extends BaseExtensionOptions {
  styleLanguage?: 'css' | 'scss' | 'sass' | 'less' | 'stylus';
  scoped?: boolean;
  script?: string;
  composition?: boolean;
  setup?: boolean;
  language?: 'typescript' | 'javascript';
  styles?: {
    outputFormat?: 'css' | 'scss' | 'sass' | 'less' | 'stylus' | 'inline';
  };
}

/**
 * Vue event output interface
 */
export interface VueEventOutput {
  directive: string;
  handler: string;
  modifiers: string[];
  parameters: string[];
  nodeId: string;
  syntax: string;
}

/**
 * Vue conditional output interface
 */
export interface VueConditionalOutput {
  condition: string;
  thenElements: VueElement;
  elseElements: VueElement | null;
  nodeId: string;
  syntax: string;
}

/**
 * Vue iteration output interface
 */
export interface VueIterationOutput {
  vForExpression: string;
  keyExpression: string;
  items: string;
  itemVariable: string;
  indexVariable?: string;
  nodeId: string;
  syntax: VueElement;
}

/**
 * Vue slot output interface
 */
export interface VueSlotOutput {
  name: string;
  fallback: string | null;
  nodeId: string;
  syntax: VueElement;
}

/**
 * Vue attribute output interface
 */
export interface VueAttributeOutput {
  originalName: string;
  vueName: string;
  value: string | boolean;
  isExpression: boolean;
  isDirective: boolean;
  nodeId: string;
  syntax: string;
}

/**
 * Vue element interface
 */
export interface VueElement {
  type: 'element';
  tag: string;
  attributes: Record<string, string>;
  children?: any[];
}

/**
 * Vue attribute info interface
 */
export interface VueAttributeInfo {
  name: string;
  isDirective: boolean;
  syntax: string;
}

/**
 * Vue conditional elements interface
 */
export interface VueConditionalElements {
  thenElements: VueElement;
  elseElements: VueElement | null;
  combined: VueElement[];
}

/**
 * Vue reactivity info interface
 */
export interface VueReactivityInfo {
  reactive: string[];
  computed: string[];
  watch: string[];
}

/**
 * Vue component generation configuration
 */
export interface VueComponentConfig {
  name: string;
  imports: string[];
  script: string;
  props: Record<string, string>;
  concepts: any;
  context: any;
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
