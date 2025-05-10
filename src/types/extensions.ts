import { TemplateNode, TemplateOptions } from './index';

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };

export type ExtensionKey = 'react' | 'bem' | string;

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
export function isExtensionOptions<T extends BaseExtensionOptions>(value: unknown): value is T {
  return typeof value === 'object' && value !== null && 'options' in value;
}

// Type guard for node extensions
export function hasNodeExtensions<T extends Record<string, any>>(node: TemplateNode, key: ExtensionKey): node is TemplateNode & { extensions: { [K in typeof key]: T } } {
  return node.extensions !== undefined && key in node.extensions;
} 