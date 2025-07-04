/**
 * AttributeRenderer
 * Handles rendering of node attributes for template output (HTML, JSX, etc.).
 * Extracted from TemplateEngine for separation of concerns.
 */
import type { TemplateNode } from '@js-template-engine/types';
import type { TemplateOptions } from '../types';

/**
 * Provides static methods for rendering node attributes for template output.
 */
export class AttributeRenderer {
  /**
   * Checks if a value is a valid attribute value (string, number, boolean).
   *
   * @param value - The value to check.
   * @returns True if the value is a string, number, or boolean; otherwise, false.
   */
  static isAttributeValue(value: unknown): value is string | number | boolean {
    return (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    );
  }

  /**
   * Renders attributes for a node using the provided formatter and options.
   * Handles static and expression attributes, and inline styles if needed.
   *
   * @param node - The template node whose attributes are to be rendered.
   * @param formatter - Attribute formatting function.
   * @param options - Template options.
   * @param getInlineStyles - Optional function to convert style objects to strings.
   * @returns The rendered attributes as a string.
   */
  static renderAttributes(
    node: TemplateNode,
    formatter: (
      attr: string,
      val: string | number | boolean,
      isExpression?: boolean
    ) => string,
    options: TemplateOptions,
    getInlineStyles?: (node: TemplateNode) => string | undefined
  ): string {
    if (node.type !== 'element' && node.type !== undefined) return '';
    let attributes = '';

    // Collect all expression attribute keys for quick lookup
    const expressionKeys = node.expressionAttributes
      ? new Set(Object.keys(node.expressionAttributes))
      : new Set();

    if (node.attributes) {
      for (const [attribute, value] of Object.entries(node.attributes)) {
        // Skip if this attribute is also present in expressionAttributes
        if (expressionKeys.has(attribute)) continue;
        if (
          attribute === 'style' &&
          options.styles?.outputFormat === 'inline'
        ) {
          let inlineStyles: string | undefined;
          if (typeof value === 'object' && getInlineStyles) {
            inlineStyles = getInlineStyles(node);
          } else if (typeof value === 'string') {
            inlineStyles = value;
          }
          if (inlineStyles) {
            attributes += formatter('style', inlineStyles);
          }
        } else if (AttributeRenderer.isAttributeValue(value)) {
          attributes += formatter(attribute, value);
        }
      }
    }

    if (node.expressionAttributes) {
      for (const [attribute, value] of Object.entries(
        node.expressionAttributes
      )) {
        attributes += formatter(attribute, value, true);
      }
    }

    return attributes;
  }
}
