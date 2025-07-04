import type { TemplateNode, ExtendedTemplate } from '@js-template-engine/types';
import type {
  RenderContext,
  PipelineStep,
  PipelineStepResult,
} from '../../types/renderContext';
import { ValidationError } from '../errors';
import { isTemplateNode } from '@js-template-engine/types';

/**
 * Determines if input is an ExtendedTemplate.
 * @param input - The input to check.
 * @returns True if the input is an ExtendedTemplate, otherwise false.
 */
function isExtendedTemplate(input: unknown): input is ExtendedTemplate {
  return (
    typeof input === 'object' &&
    input !== null &&
    !Array.isArray(input) &&
    'template' in input
  );
}

/**
 * Normalizes input and validates template structure.
 * Handles both TemplateNode arrays and ExtendedTemplate objects.
 */
export class InputNormalizationStep implements PipelineStep {
  name = 'InputNormalization';

  /**
   * Executes the input normalization step.
   * Normalizes input to a consistent format and validates template structure.
   *
   * @param context - The rendering context containing the input to normalize.
   * @returns A promise that resolves to the pipeline step result.
   */
  async execute(context: RenderContext): Promise<PipelineStepResult> {
    try {
      const { input } = context;

      // Normalize input
      const { template: nodes, component } = isExtendedTemplate(input)
        ? { template: input.template ?? [], component: input.component }
        : { template: input ?? [], component: undefined };

      // Validate template structure
      if (!Array.isArray(nodes)) {
        throw new ValidationError('Template nodes must be an array', { input });
      }

      // After normalizing input, validate all nodes
      function validateNodes(nodes: any[]): void {
        for (const node of nodes) {
          if (!isTemplateNode(node)) {
            if (!('errors' in context)) {
              (context as any).errors = [];
            }
            (context as any).errors.push({
              type: 'ValidationError',
              message: 'Invalid template node structure',
              node,
            });
          }
          // Recursively validate children if present
          if (
            (node.type === 'element' ||
              node.type === undefined ||
              node.type === 'slot') &&
            Array.isArray(node.children)
          ) {
            validateNodes(node.children);
          }
        }
      }
      validateNodes(nodes);

      // Update context with normalized data
      const updatedContext: RenderContext = {
        ...context,
        nodes,
        component,
      };

      return {
        success: true,
        context: updatedContext,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof ValidationError
            ? error
            : new ValidationError(
                error instanceof Error ? error.message : String(error)
              ),
        context,
      };
    }
  }
}
