import { TemplateNode } from './index';
import { ImportDefinition } from './Component';

/**
 * Base interface for all framework extension options.
 * Provides common options that all framework extensions can use.
 */
export interface BaseComponentOptions {
  /** Whether to use scoped styles for the component. */
  scopedStyles?: boolean;
  /** The type of export for the component. */
  exportType?: 'default' | 'named';
  /** Additional framework-specific options. */
  [key: string]: any;
}

/**
 * React-specific component options.
 * Extends BaseComponentOptions with React-specific functionality.
 */
export interface ReactComponentOptions extends BaseComponentOptions {
  /** Array of patterns to ignore during processing. */
  ignore?: string[];
  /** Whether to use JSX syntax. */
  jsx?: boolean;
}

/**
 * Vue-specific component options.
 * Extends BaseComponentOptions with Vue-specific functionality.
 */
export interface VueComponentOptions extends BaseComponentOptions {
  /** Whether to use scoped styles. */
  scoped?: boolean;
  /** Whether to use Composition API. */
  composition?: boolean;
  /** Whether to use the setup function. */
  useSetup?: boolean;
}

/**
 * Interface for extended templates with component metadata.
 * Combines template nodes with component configuration and framework-specific options.
 */
export interface ExtendedTemplate {
  /** The version of the template or component. */
  version?: string;
  /** Component metadata and configuration. */
  component?: {
    /** The name of the component. */
    name?: string;
    /** TypeScript-style prop type definitions. */
    props?: Record<string, string>;
    /** Import statements for the component. */
    imports?: ImportDefinition[];
    /** JavaScript/TypeScript script content for the component. */
    script?: string;
    /** Whether the component uses TypeScript. */
    typescript?: boolean;
    /** Framework-specific extension options. */
    extensions?: {
      /** React-specific options. */
      react?: ReactComponentOptions;
      /** Vue-specific options. */
      vue?: VueComponentOptions;
      /** Additional framework options. */
      [key: string]: BaseComponentOptions | undefined;
    };
  };
  /** The template nodes that define the component structure. */
  template: TemplateNode[];
}
