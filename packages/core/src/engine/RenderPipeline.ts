import { createLogger } from '../utils/logger';
import type { Logger } from '../types';
import type { RenderContext, PipelineStep, PipelineStepResult } from '../types/renderContext';

/**
 * Orchestrates the template rendering process using a pipeline of steps
 */
export class RenderPipeline {
  private steps: PipelineStep[];
  private logger: Logger;

  constructor(steps: PipelineStep[], verbose = false) {
    this.steps = steps;
    this.logger = createLogger(verbose, 'RenderPipeline');
  }

  /**
   * Execute the rendering pipeline
   */
  async execute(context: RenderContext): Promise<string> {
    this.logger.info(`Starting rendering pipeline with ${this.steps.length} steps`);

    let currentContext = context;

    for (const step of this.steps) {
      // Skip steps that shouldn't run for non-root renders
      if (!context.isRoot && !step.runForNonRoot) {
        this.logger.info(`Skipping step '${step.name}' for non-root render`);
        continue;
      }

      this.logger.info(`Executing step: ${step.name}`);
      
      try {
        const result: PipelineStepResult = await step.execute(currentContext);
        
        if (!result.success) {
          throw new Error(`Step '${step.name}' failed: ${result.error}`);
        }
        
        currentContext = result.context;
        this.logger.info(`Step '${step.name}' completed successfully`);
        
      } catch (error) {
        this.logger.error(`Step '${step.name}' failed: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    }

    if (!currentContext.template) {
      // Allow empty templates for edge cases (like templates with only component metadata)
      this.logger.info('Rendering pipeline completed with empty template');
      return '';
    }

    this.logger.info('Rendering pipeline completed successfully');
    return currentContext.template;
  }

  /**
   * Add a step to the pipeline
   */
  addStep(step: PipelineStep): void {
    this.steps.push(step);
  }

  /**
   * Get all steps in the pipeline
   */
  getSteps(): PipelineStep[] {
    return [...this.steps];
  }
} 