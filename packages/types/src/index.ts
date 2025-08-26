import { ExtendedTemplate } from './ExtendedTemplate';
import { StyleDefinition, StyleOutputFormat } from './styles';
import { ExtensionKey, Component } from './extensions';
import { DeepPartial } from './utils';
import { StyleProcessorPlugin } from './extensions';

export type {
  StyleDefinition,
  StyleOutputFormat,
  ExtensionKey,
  DeepPartial,
  Component,
};

/**
 * Union type representing different types of template nodes.
 * Each node type has specific properties and structure.
 * If type is omitted, it defaults to 'element'.
 */
export type TemplateNode =
  | {
      /** The type of the node - element, text, or slot. Defaults to 'element' if omitted. */
      type?: 'element';
      /** The HTML tag name for element nodes. */
      tag: string;
      /** Static attributes for the element. */
      attributes?: {
        [key: string]: string | number | boolean | StyleDefinition | undefined;
      };
      /** Expression-based attributes for the element. */
      expressionAttributes?: Record<string, string>;
      /** Child nodes of this element. */
      children?: TemplateNode[];
      /** Extension-specific data for this node. */
      extensions?: Record<string, any>;
      /** Whether this element should be self-closing. */
      selfClosing?: boolean;
    }
  | {
      /** The type of the node - element, text, or slot. */
      type: 'text';
      /** The text content for text nodes. */
      content: string;
      /** Extension-specific data for this node. */
      extensions?: Record<string, any>;
    }
  | {
      /** The type of the node - element, text, or slot. */
      type: 'slot';
      /** The name of the slot. */
      name: string;
      /** Fallback content for when no slot content is provided. */
      fallback?: TemplateNode[];
      /** Extension-specific data for this node. */
      extensions?: Record<string, any>;
    }
  | {
      /** Fragment node for grouping elements without a wrapper. */
      type: 'fragment';
      /** Child nodes of this fragment. */
      children: TemplateNode[];
      /** Extension-specific data for this node. */
      extensions?: Record<string, any>;
    }
  | {
      /** Comment node for documentation and notes. */
      type: 'comment';
      /** The comment content. */
      content: string;
      /** Extension-specific data for this node. */
      extensions?: Record<string, any>;
    }
  | {
      /** Conditional node for if/else logic. */
      type: 'if';
      /** The condition to evaluate (prop name or expression). */
      condition: string;
      /** Template nodes to render when condition is true. */
      then: TemplateNode[];
      /** Template nodes to render when condition is false. */
      else?: TemplateNode[];
      /** Default condition value for plain HTML rendering. */
      defaultCondition?: boolean;
      /** Extension-specific data for this node. */
      extensions?: Record<string, any>;
    }
  | {
      /** Iteration node for loops. */
      type: 'for';
      /** The items prop name to iterate over. */
      items: string;
      /** The variable name for each item. */
      item: string;
      /** The variable name for the index (optional). */
      index?: string;
      /** Template nodes to render for each item. */
      children: TemplateNode[];
      /** Default items for plain HTML rendering. */
      default?: any[];
      /** Key pattern for React rendering (optional, defaults to index). */
      key?: string;
      /** Extension-specific data for this node. */
      extensions?: Record<string, any>;
    };

/**
 * Interface for node-specific extension data.
 * Allows extensions to attach custom data to template nodes.
 */
export interface NodeExtensions {
  [key: string]: any;
}

/**
 * Interface defining the structure of a template engine extension.
 * Extensions can customize node processing, styling, and output generation.
 * @template T - The extension options type.
 * @template U - The node extension data type.
 */
export interface Extension<
  T extends BaseExtensionOptions = BaseExtensionOptions,
  U extends Record<string, any> = Record<string, any>,
> {
  /** The unique key identifying this extension. */
  key: string;
  /** Optional style processing plugin for this extension. */
  stylePlugin?: StyleProcessorPlugin;
  /**
   * Optional callback called before rendering begins.
   * @param template - The template nodes to be rendered.
   * @param options - The extension options.
   */
  beforeRender?: (template: TemplateNode[], options: T) => void;
  /**
   * Optional callback called after rendering is complete.
   * @param template - The template nodes that were rendered.
   * @param options - The extension options.
   */
  afterRender?: (template: TemplateNode[], options: T) => void;
  /**
   * Optional handler for modifying output before writing.
   * @param output - The generated output string.
   * @param options - The extension options.
   * @returns The modified output string.
   */
  onOutputWrite?: (output: string, options: T) => string;
  /**
   * Optional method to determine the appropriate file extension for this extension.
   * @param options - The render options containing language preference.
   * @returns The file extension string (e.g., '.tsx', '.vue', '.html').
   */
  getFileExtension?: (options: RenderOptions) => string;
  /**
   * Optional method to determine the appropriate Prettier parser for this extension.
   * @param options - The render options containing language preference.
   * @returns The Prettier parser string (e.g., 'typescript', 'babel', 'vue', 'html').
   */
  getPrettierParser?: (options: RenderOptions) => string;
  /**
   * Optional handler for merging extension options.
   * @param defaultOptions - The default options.
   * @param options - The user-provided options.
   * @returns The merged options.
   */
  optionsHandler?: (defaultOptions: T, options: DeepPartial<T>) => T;
}

/**
 * Interface for rendering options and configuration.
 * Controls how templates are processed and output is generated.
 */
export interface RenderOptions {
  /** The name of the template or component. */
  name?: string;
  /** The output directory for generated files. */
  outputDir?: string;
  /** The language for output generation (determines file extensions automatically). */
  language?: 'typescript' | 'javascript';
  /** Whether to enable verbose logging. */
  verbose?: boolean;
  /** Array of extensions to use during rendering. */
  extensions?: Extension[];
  /** The name of the component being rendered. */
  componentName?: string;
  /**
   * Function to format attributes for output.
   * @param attribute - The attribute name.
   * @param value - The attribute value.
   * @param isExpression - Whether the value is an expression.
   * @returns The formatted attribute string.
   */
  attributeFormatter?: (
    attribute: string,
    value: string | number | boolean,
    isExpression?: boolean
  ) => string;
  /** The filename for output files. */
  filename?: string;
  /** Whether to prefer self-closing tags. */
  preferSelfClosingTags?: boolean;
  /** The Prettier parser to use for formatting. */
  prettierParser?: string;
  /** Whether to write output files to disk. */
  writeOutputFile?: boolean;
  /** Slot content for template slots. */
  slots?: Record<string, TemplateNode[]>;
  /** Style processing options. */
  styles?: {
    /** The output format for styles. */
    outputFormat: StyleOutputFormat;
    /** Whether to generate source maps. */
    generateSourceMap?: boolean;
    /** Whether to minify the output. */
    minify?: boolean;
  };
  /** Whether to include comments in the output (defaults to true). */
  includeComments?: boolean;
}

/**
 * Base interface for extension options.
 * Provides common options that all extensions can use.
 */
export interface BaseExtensionOptions {
  /** Whether to enable verbose logging for this extension. */
  verbose?: boolean;
  /** Language for output generation (determines file extensions and syntax). */
  language?: 'typescript' | 'javascript';
  /** Component name override. */
  name?: string;
  /** Alternative component name property. */
  componentName?: string;
}

/**
 * Interface for logging functionality.
 * Provides methods for different log levels.
 */
export interface Logger {
  /**
   * Logs an informational message.
   * @param message - The message to log.
   */
  info: (message: string) => void;
  /**
   * Logs a success message.
   * @param message - The message to log.
   */
  success: (message: string) => void;
  /**
   * Logs an error message.
   * @param message - The message to log.
   */
  error: (message: string) => void;
  /**
   * Logs a warning message.
   * @param message - The message to log.
   */
  warn: (message: string) => void;
}

export * from './ExtendedTemplate';
export * from './styles';
export * from './extensions';
export * from './utils';

/**
 * Type guard for checking if a node has extensions for a specific key.
 * @template T - The type of the extension data.
 * @param node - The template node to check.
 * @param key - The extension key to look for.
 * @returns True if the node has extensions for the specified key, otherwise false.
 */
export function hasNodeExtensions<T extends Record<string, any>>(
  node: TemplateNode,
  key: ExtensionKey
): node is TemplateNode & { extensions: { [K in typeof key]: T } } {
  return node.extensions !== undefined && key in node.extensions;
}

export {
  resolveComponentName,
  resolveComponentProps,
  resolveComponentImports,
  sanitizeComponentName,
} from './Component';

export type { ImportDefinition } from './Component';

/**
 * Runtime type guard for TemplateNode.
 * Accepts nodes with type: 'element', 'text', 'slot', 'fragment', 'comment', 'if', 'for', or undefined (treated as 'element').
 * @param node - The value to check.
 * @returns True if the value is a valid TemplateNode, otherwise false.
 */
export function isTemplateNode(node: any): node is TemplateNode {
  if (typeof node !== 'object' || node === null) return false;
  
  if (node.type === 'text') {
    return typeof node.content === 'string';
  }
  
  if (node.type === 'slot') {
    return typeof node.name === 'string';
  }
  
  if (node.type === 'fragment') {
    return Array.isArray(node.children);
  }
  
  if (node.type === 'comment') {
    return typeof node.content === 'string';
  }
  
  if (node.type === 'if') {
    return typeof node.condition === 'string' && Array.isArray(node.then);
  }
  
  if (node.type === 'for') {
    return typeof node.items === 'string' && typeof node.item === 'string' && Array.isArray(node.children);
  }
  
  // Default: treat as element if type is 'element' or undefined
  return typeof node.tag === 'string';
}
