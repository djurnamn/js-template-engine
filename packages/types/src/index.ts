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
  /**
   * Optional handler for processing individual nodes.
   * @param node - The template node to process.
   * @param ancestorNodesContext - The context of ancestor nodes.
   * @returns The processed template node.
   */
  nodeHandler?: (
    node: TemplateNode & { extensions?: { [key: string]: U } },
    ancestorNodesContext?: TemplateNode[]
  ) => TemplateNode;
  /** Optional style processing plugin for this extension. */
  stylePlugin?: StyleProcessorPlugin;
  /**
   * Optional callback called when a node is visited during traversal.
   * @param node - The node being visited.
   * @param ancestors - The ancestor nodes of the current node.
   */
  onNodeVisit?: (
    node: TemplateNode & { extensions?: { [key: string]: U } },
    ancestors?: TemplateNode[]
  ) => void;
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
   * Optional handler for processing the root template.
   * @param template - The template string to process.
   * @param options - The extension options.
   * @param context - The root handler context.
   * @returns The processed template string.
   */
  rootHandler?: (
    template: string,
    options: T,
    context: RootHandlerContext
  ) => string;
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
  /** The file extension for output files. */
  fileExtension?: '.html' | '.jsx' | '.tsx' | '.css' | '.ts' | '.vue';
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
}

/**
 * Base interface for extension options.
 * Provides common options that all extensions can use.
 */
export interface BaseExtensionOptions {
  /** Whether to enable verbose logging for this extension. */
  verbose?: boolean;
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
 * Accepts nodes with type: 'element', 'text', 'slot', or undefined (treated as 'element').
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
  // Default: treat as element if type is 'element' or undefined
  return typeof node.tag === 'string';
}
