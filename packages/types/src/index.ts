import { ExtendedTemplate } from './ExtendedTemplate';
import { StyleDefinition, StyleOutputFormat } from './styles';
import { ExtensionKey, Component } from './extensions';
import { DeepPartial } from './utils';
import { StyleProcessorPlugin } from './extensions';
import { RootHandlerContext } from './context';

export type {
  StyleDefinition,
  StyleOutputFormat,
  ExtensionKey,
  DeepPartial,
  RootHandlerContext,
  Component
};

export type TemplateNode =
  | {
      type: 'element';
      tag: string;
      attributes?: {
        [key: string]: string | number | boolean | StyleDefinition | undefined;
      };
      expressionAttributes?: Record<string, string>;
      children?: TemplateNode[];
      extensions?: Record<string, any>;
      selfClosing?: boolean;
    }
  | {
      type: 'text';
      content: string;
      extensions?: Record<string, any>;
    }
  | {
      type: 'slot';
      name: string;
      children?: TemplateNode[];
      extensions?: Record<string, any>;
    };

export interface NodeExtensions {
  [key: string]: any;
}

export interface Extension<T extends BaseExtensionOptions = BaseExtensionOptions, U extends Record<string, any> = Record<string, any>> {
  key: string;
  nodeHandler?: (node: TemplateNode & { extensions?: { [key: string]: U } }, ancestorNodesContext?: TemplateNode[]) => TemplateNode;
  stylePlugin?: StyleProcessorPlugin;
  onNodeVisit?: (node: TemplateNode & { extensions?: { [key: string]: U } }, ancestors?: TemplateNode[]) => void;
  beforeRender?: (template: TemplateNode[], options: T) => void;
  afterRender?: (template: TemplateNode[], options: T) => void;
  onOutputWrite?: (output: string, options: T) => string;
  rootHandler?: (template: string, options: T, context: RootHandlerContext) => string;
  optionsHandler?: (defaultOptions: T, options: DeepPartial<T>) => T;
}

export interface RenderOptions {
  name?: string;
  outputDir?: string;
  fileExtension?: '.html' | '.jsx' | '.tsx' | '.css' | '.ts' | '.vue';
  verbose?: boolean;
  extensions?: Extension[];
  componentName?: string;
  attributeFormatter?: (attribute: string, value: string | number | boolean, isExpression?: boolean) => string;
  filename?: string;
  preferSelfClosingTags?: boolean;
  prettierParser?: string;
  writeOutputFile?: boolean;
  slots?: Record<string, TemplateNode[]>;
  styles?: {
    outputFormat: StyleOutputFormat;
    generateSourceMap?: boolean;
    minify?: boolean;
  };
}

export interface BaseExtensionOptions {
  verbose?: boolean;
}

export interface Logger {
  info: (message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
}

export * from './ExtendedTemplate';
export * from './styles';
export * from './extensions';
export * from './utils';

export function hasNodeExtensions<T extends Record<string, any>>(node: TemplateNode, key: ExtensionKey): node is TemplateNode & { extensions: { [K in typeof key]: T } } {
  return node.extensions !== undefined && key in node.extensions;
}

export {
  resolveComponentName,
  resolveComponentProps,
  resolveComponentImports,
  sanitizeComponentName
} from './Component';

export type { ImportDefinition } from './Component';

/**
 * Runtime type guard for TemplateNode.
 * Accepts nodes with type: 'element', 'text', 'slot', or undefined (treated as 'element').
 */
export function isTemplateNode(node: any): node is TemplateNode {
  if (typeof node !== 'object' || node === null) return false;
  if (node.type === 'text') {
    return typeof node.content === 'string';
  }
  if (node.type === 'slot') {
    return typeof node.name === 'string';
  }
  // Default: treat as element if type is 'element' or undefined
  return typeof node.tag === 'string';
} 