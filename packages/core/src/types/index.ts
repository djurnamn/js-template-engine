import type {
  TemplateNode,
  Extension,
  RenderOptions,
  ExtendedTemplate,
  Logger,
  StyleOutputFormat,
} from '@js-template-engine/types';

// Re-export base types
export type {
  TemplateNode,
  Extension,
  RenderOptions,
  ExtendedTemplate,
  Logger,
  StyleOutputFormat,
};

/**
 * Extended template options interface.
 * Adds core-specific options to the base RenderOptions.
 */
export interface TemplateOptions extends RenderOptions {
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

  /**
   * The filename for output files.
   */
  filename?: string;

  /**
   * The name of the component.
   */
  componentName?: string;

  /**
   * Whether to prefer self-closing tags.
   */
  preferSelfClosingTags?: boolean;

  /**
   * The Prettier parser to use for formatting.
   */
  prettierParser?: string;

  /**
   * Whether to write output files to disk.
   */
  writeOutputFile?: boolean;

  /**
   * Slot content for template slots.
   */
  slots?: Record<string, TemplateNode[]>;

  /**
   * Style processing options.
   */
  styles?: {
    /**
     * The output format for styles.
     */
    outputFormat: StyleOutputFormat;

    /**
     * Whether to generate source maps.
     */
    generateSourceMap?: boolean;

    /**
     * Whether to minify the output.
     */
    minify?: boolean;
  };
}
