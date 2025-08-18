import type { BaseExtensionOptions } from '@js-template-engine/types';

/**
 * Options for configuring the React extension.
 * @extends BaseExtensionOptions
 */
export interface ReactExtensionOptions extends BaseExtensionOptions {
  /** Renderer key for the extension. */
  rendererKey?: string;
  /** Export type for the component. */
  exportType?: 'default' | 'named';
  /** Props string definition. */
  props?: string;
  /** Props interface string. */
  propsInterface?: string;
  /** Import statements array. */
  importStatements?: string[];
}

/**
 * Node-level React extension options.
 * Defines React-specific properties that can be attached to template nodes.
 */
export interface ReactNodeExtensions {
  /** Tag name for the node. */
  tag?: string;
  /** HTML attributes for the node. */
  attributes?: Record<string, any>;
  /** Expression-based attributes for the node. */
  expressionAttributes?: Record<string, any>;
}
