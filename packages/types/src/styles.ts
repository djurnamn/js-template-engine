/**
 * Type definition for style output formats.
 * Defines the supported formats for generated styles.
 */
export type StyleOutputFormat = 'inline' | 'css' | 'scss';

/**
 * Interface for style definitions.
 * Represents CSS properties and values, supporting nested structures for media queries and pseudo-selectors.
 */
export interface StyleDefinition {
  /**
   * CSS property-value pairs or nested style definitions.
   * Can be a string, number, boolean, nested object, or undefined.
   */
  [key: string]:
    | string
    | number
    | boolean
    | Record<string, string | number>
    | undefined;
}
