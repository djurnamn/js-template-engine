import {
  Extension,
  TemplateNode,
  RenderOptions,
} from '@js-template-engine/types';

/**
 * Logger interface for template engine logging.
 * Provides methods for different log levels.
 */
export type Logger = {
  /**
   * Logs an informational message.
   * @param message - The message to log.
   * @param args - Additional arguments to include in the log.
   */
  info: (message: string, ...args: any[]) => void;

  /**
   * Logs a warning message.
   * @param message - The message to log.
   * @param args - Additional arguments to include in the log.
   */
  warn: (message: string, ...args: any[]) => void;

  /**
   * Logs an error message.
   * @param message - The message to log.
   * @param args - Additional arguments to include in the log.
   */
  error: (message: string, ...args: any[]) => void;

  /**
   * Logs a debug message.
   * @param message - The message to log.
   * @param args - Additional arguments to include in the log.
   */
  debug: (message: string, ...args: any[]) => void;
};

/**
 * Extended template options interface.
 * Adds core-specific options to the base RenderOptions.
 */
export type TemplateOptions = RenderOptions & {
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
   * Import statements to include in the output.
   */
  importStatements?: string[];

  /**
   * The output directory for generated files.
   */
  outputDir?: string;

  /**
   * Whether to prefer self-closing tags.
   */
  preferSelfClosingTags?: boolean;

  /**
   * The Prettier parser to use for formatting.
   */
  prettierParser?: string;

  /**
   * The props string representation.
   */
  props?: string;

  /**
   * The props interface definition.
   */
  propsInterface?: string;

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
    outputFormat?: import('@js-template-engine/types').StyleOutputFormat;
  };

  /**
   * Whether to write output files to disk.
   */
  writeOutputFile?: boolean;

  /**
   * Whether to enable verbose logging.
   */
  verbose?: boolean;
};
