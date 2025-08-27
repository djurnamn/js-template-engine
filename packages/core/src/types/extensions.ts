import { TemplateOptions } from './index';
import type { DeepPartial, ExtensionKey } from '@js-template-engine/types';

/**
 * Utility type that makes specified keys required in a type.
 * @template T - The base type.
 * @template K - The keys to make required.
 */
export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };

/**
 * Base extension options interface.
 * Extends TemplateOptions with extension-specific functionality.
 */
export interface BaseExtensionOptions extends TemplateOptions {
  // Add any base extension specific options here
}

/**
 * React Extension namespace containing React-specific types and interfaces.
 */
export namespace ReactExtension {
  /**
   * Options for React extension configuration.
   */
  export interface Options extends BaseExtensionOptions {
    /**
     * The name of the React component.
     */
    componentName?: string;
    /**
     * Import statements to include in the component.
     */
    importStatements?: string[];
    /**
     * The type of export for the component.
     */
    exportType?: 'default' | 'named';
    /**
     * The props interface definition.
     */
    propsInterface?: string;
    /**
     * The props string representation.
     */
    props?: string;
  }

  /**
   * Node extensions for React-specific functionality.
   */
  export interface NodeExtensions {
    /**
     * Whether to ignore this node during processing.
     */
    ignore?: boolean;
    /**
     * The HTML tag to use for this node.
     */
    tag?: string;
    /**
     * Static attributes for the node.
     */
    attributes?: Record<string, string | number | boolean>;
    /**
     * Expression attributes for the node.
     */
    expressionAttributes?: Record<string, string>;
  }
}

/**
 * BEM Extension namespace containing BEM-specific types and interfaces.
 */
export namespace BemExtension {
  /**
   * Options for BEM extension configuration.
   */
  export interface Options extends BaseExtensionOptions {
    /**
     * Prefix to add to BEM class names.
     */
    prefix?: string;
    /**
     * Separators for BEM naming convention.
     */
    separator?: {
      /**
       * Separator for element names.
       */
      element?: string;
      /**
       * Separator for modifier names.
       */
      modifier?: string;
    };
  }

  /**
   * Node extensions for BEM-specific functionality.
   */
  export interface NodeExtensions {
    /**
     * Whether to ignore this node during processing.
     */
    ignore?: boolean;
    /**
     * The BEM block name.
     */
    block?: string;
    /**
     * The BEM element name.
     */
    element?: string;
    /**
     * The BEM modifier name.
     */
    modifier?: string;
    /**
     * Array of BEM modifier names.
     */
    modifiers?: string[];
  }
}

/**
 * Generic extension options interface.
 * @template T - The base extension options type.
 */
export interface ExtensionOptions<
  T extends BaseExtensionOptions = BaseExtensionOptions,
> {
  /**
   * The extension options.
   */
  options: DeepPartial<T>;
}

/**
 * Node extensions interface for adding extension-specific data to nodes.
 * @template T - The extension-specific data type.
 */
export interface NodeExtensions<
  T extends Record<string, any> = Record<string, any>,
> {
  /**
   * Extension-specific data for the node.
   */
  extensions?: {
    [K in ExtensionKey]?: T;
  };
}

/**
 * Generic extension interface defining the structure of an extension.
 * @template T - The extension options type.
 */
export interface Extension<
  T extends BaseExtensionOptions = BaseExtensionOptions,
> {
  /**
   * The unique key identifying this extension.
   */
  key: ExtensionKey;
  /**
   * Optional handler for merging extension options.
   * @param defaultOptions - The default options.
   * @param options - The user-provided options.
   * @returns The merged options.
   */
  optionsHandler?: (defaultOptions: T, options: DeepPartial<T>) => T;
}

/**
 * Type guard for checking if an object has extension options.
 * @param obj - The object to check.
 * @returns True if the object has extension options, otherwise false.
 */
export function hasExtensionOptions<T>(obj: unknown): obj is DeepPartial<T> {
  return typeof obj === 'object' && obj !== null;
}

/**
 * Type guard for checking if a node has extensions.
 * @param node - The node to check.
 * @returns True if the node has extensions, otherwise false.
 */
export function hasNodeExtensions(
  node: unknown
): node is { extensions?: Record<string, unknown> } {
  return typeof node === 'object' && node !== null && 'extensions' in node;
}
