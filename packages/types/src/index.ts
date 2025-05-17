import { ExtendedTemplate } from './ExtendedTemplate';
import { StyleDefinition, StyleOutputFormat } from './styles';
import { ExtensionKey, FrameworkExtensionMap, Component } from './extensions';
import { DeepPartial } from './utils';
import { StyleProcessorPlugin } from './extensions';
import { RootHandlerContext } from './context';
import { VueComponentOptions } from './context';
import { ReactComponentOptions } from './ReactComponentOptions';

export type {
  StyleDefinition,
  StyleOutputFormat,
  ExtensionKey,
  DeepPartial,
  RootHandlerContext,
  FrameworkExtensionMap,
  Component,
  VueComponentOptions,
  ReactComponentOptions
};

export interface TemplateNode {
  type?: 'element' | 'text' | 'slot';
  tagName?: string;
  tag?: string;
  name?: string;
  attributes?: {
    [key: string]: string | number | boolean | StyleDefinition | undefined;
  };
  expressionAttributes?: Record<string, string>;
  children?: TemplateNode[];
  content?: string;
  extensions?: Record<string, any>;
  selfClosing?: boolean;
}

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
  fileExtension?: '.html' | '.jsx' | '.tsx' | '.css' | '.ts';
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