import type { ImportDefinition } from './Component';

/**
 * Type alias for extension keys.
 * Used to identify specific extensions in the system.
 */
export type ExtensionKey = string;

/**
 * Interface defining a component's metadata and configuration.
 * Contains information about the component's structure, props, and behavior.
 */
export interface Component {
  /** The name of the component. */
  name?: string;
  /** TypeScript-style prop type definitions. */
  props?: Record<string, string>;
  /** JavaScript/TypeScript script content for the component. */
  script?: string;
  /** Whether the component uses TypeScript. */
  typescript?: boolean;
  /** Import statements for the component. */
  imports?: ImportDefinition[];
  /** Extension-specific data for the component. */
  extensions?: Record<string, Record<string, any> | undefined>;
}

/**
 * Interface for style processing plugins.
 * Allows extensions to customize how styles are processed and generated.
 */
export interface StyleProcessorPlugin {
  /**
   * Optional function to process styles.
   * @param styles - Map of style definitions.
   * @param options - Processing options.
   * @returns The processed style output.
   */
  process?: (styles: Map<string, any>, options: any) => string;
  /**
   * Optional function to generate styles.
   * @param styles - Map of style definitions.
   * @param options - Generation options.
   * @param template - Optional template context.
   * @returns The generated style output.
   */
  generateStyles?: (
    styles: Map<string, any>,
    options: any,
    template?: any
  ) => string;
  /**
   * Optional function called when processing individual nodes.
   * @param node - The node being processed.
   * @returns Style output for the node, or undefined if no styles.
   */
  onProcessNode?: (node: any) => string | undefined;
}

/**
 * Utility type that makes all properties of T optional recursively.
 * Useful for creating partial versions of complex types.
 * @template T - The type to make deeply partial.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
