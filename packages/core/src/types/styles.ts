import type { StyleOutputFormat } from '@js-template-engine/types';

/**
 * Interface for style definitions.
 * Represents CSS properties and values, supporting nested structures for media queries and pseudo-selectors.
 */
export interface StyleDefinition {
  /**
   * CSS property-value pairs or nested style definitions.
   * Can be a string, number, boolean, nested StyleDefinition, or undefined.
   */
  [key: string]: string | number | boolean | StyleDefinition | undefined;
}

/**
 * Interface for style processing options.
 * Configures how styles should be processed and output.
 */
export interface StyleOptions {
  /**
   * The output format for generated styles.
   */
  outputFormat?: StyleOutputFormat;
}
