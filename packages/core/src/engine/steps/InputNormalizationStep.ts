import type { TemplateNode, ExtendedTemplate } from '@js-template-engine/types';
import type { RenderContext, PipelineStep, PipelineStepResult } from '../../types/renderContext';

/**
 * Determines if input is an ExtendedTemplate
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
 * Normalizes input and validates template structure
 */
export class InputNormalizationStep implements PipelineStep {
  name = 'InputNormalization';

  async execute(context: RenderContext): Promise<PipelineStepResult> {
    try {
      const { input } = context;
      
      // Normalize input
      const { template: nodes, component } = isExtendedTemplate(input)
        ? { template: input.template ?? [], component: input.component }
        : { template: input ?? [], component: undefined };

      // Validate template structure
      if (!Array.isArray(nodes)) {
        return {
          success: false,
          error: 'Template nodes must be an array',
          context
        };
      }

      // Update context with normalized data
      const updatedContext: RenderContext = {
        ...context,
        nodes,
        component
      };

      return {
        success: true,
        context: updatedContext
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        context
      };
    }
  }
} 