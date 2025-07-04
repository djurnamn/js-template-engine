import type {
  RenderOptions,
  BaseExtensionOptions,
} from '@js-template-engine/types';

/**
 * Namespace containing BEM extension types and interfaces.
 */
export namespace BemExtension {
  /**
   * Options for BEM extension configuration.
   * @extends RenderOptions
   */
  export interface Options extends RenderOptions {
    /** Optional prefix for BEM classes. */
    prefix?: string;
    /** Separators for BEM element and modifier. */
    separator?: {
      /** Separator for elements (default: '__'). */
      element?: string;
      /** Separator for modifiers (default: '--'). */
      modifier?: string;
    };
  }

  /**
   * Node-level BEM extension options.
   * Defines BEM-specific properties that can be attached to template nodes.
   */
  export interface NodeExtensions {
    /** If true, disables BEM processing for this node. */
    ignore?: boolean;
    /** Block name for BEM. */
    block?: string;
    /** Element name for BEM. */
    element?: string;
    /** Single modifier for BEM. */
    modifier?: string;
    /** Multiple modifiers for BEM. */
    modifiers?: string[];
  }
}

/**
 * Options for configuring the BEM extension.
 * @extends BaseExtensionOptions
 */
export interface BemExtensionOptions extends BaseExtensionOptions {
  /** File extension for output files. */
  fileExtension?: '.html' | '.jsx' | '.tsx' | '.css' | '.ts' | '.vue';
}

/**
 * Node-level BEM extension options.
 * Defines BEM-specific properties that can be attached to template nodes.
 */
export interface BemNodeExtensions {
  /** Block name for BEM. */
  block?: string;
  /** Element name for BEM. */
  element?: string;
  /** Modifiers for BEM. */
  modifiers?: string[];
}
