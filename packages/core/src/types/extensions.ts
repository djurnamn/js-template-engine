import { TemplateNode, TemplateOptions } from './index';
import type { DeepPartial, ExtensionKey } from '@js-template-engine/types';

// Utility types
export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };

// Base extension types
export interface BaseExtensionOptions extends TemplateOptions {
  // Add any base extension specific options here
}

// React Extension Types
export namespace ReactExtension {
  export interface Options extends BaseExtensionOptions {
    componentName?: string;
    importStatements?: string[];
    exportType?: 'default' | 'named';
    propsInterface?: string;
    props?: string;
  }

  export interface NodeExtensions {
    ignore?: boolean;
    tag?: string;
    attributes?: Record<string, string | number | boolean>;
    expressionAttributes?: Record<string, string>;
  }
}

// BEM Extension Types
export namespace BemExtension {
  export interface Options extends BaseExtensionOptions {
    prefix?: string;
    separator?: {
      element?: string;
      modifier?: string;
    };
  }

  export interface NodeExtensions {
    ignore?: boolean;
    block?: string;
    element?: string;
    modifier?: string;
    modifiers?: string[];
  }
}

// Generic extension types
export interface ExtensionOptions<T extends BaseExtensionOptions = BaseExtensionOptions> {
  options: DeepPartial<T>;
}

export interface NodeExtensions<T extends Record<string, any> = Record<string, any>> {
  extensions?: {
    [K in ExtensionKey]?: T;
  };
}

// Extended TemplateNode with specific extension types
export interface ExtendedTemplateNode extends TemplateNode {
  extensions?: {
    react?: ReactExtension.NodeExtensions;
    bem?: BemExtension.NodeExtensions;
    [key: ExtensionKey]: Record<string, any> | undefined;
  };
}

// Generic extension interface
export interface Extension<T extends BaseExtensionOptions = BaseExtensionOptions, U extends Record<string, any> = Record<string, any>> {
  key: ExtensionKey;
  optionsHandler?: (defaultOptions: T, options: DeepPartial<T>) => T;
  nodeHandler: (node: TemplateNode & NodeExtensions<U>, ancestorNodesContext?: TemplateNode[]) => TemplateNode;
  rootHandler?: (template: string, options: T) => string;
}

// Type guard for extension options
export function hasExtensionOptions<T>(obj: unknown): obj is DeepPartial<T> {
  return typeof obj === 'object' && obj !== null;
}

// Type guard for node extensions
export function hasNodeExtensions(node: unknown): node is { extensions?: Record<string, unknown> } {
  return typeof node === 'object' && node !== null && 'extensions' in node;
} 