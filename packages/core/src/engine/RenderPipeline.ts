import { createLogger } from '../utils/logger';
import type { Logger } from '../types';
import type { RenderContext, PipelineStep, PipelineStepResult } from '../types/renderContext';
import { TemplateEngineError } from './errors';

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
    if (!('errors' in currentContext)) {
      (currentContext as any).errors = [];
    }

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
          // Collect error, stop pipeline, return current template
          let err;
          const resErr = result.error as any;
          if (resErr instanceof TemplateEngineError) {
            err = resErr;
          } else if (typeof resErr === 'object' && resErr !== null && 'message' in resErr) {
            err = new TemplateEngineError(String(resErr.message), resErr);
          } else {
            err = new TemplateEngineError(String(resErr));
          }
          (currentContext as any).errors.push(err);
          this.logger.error(`Step '${step.name}' failed: ${String(result.error)}`);
          return currentContext.template || '';
        }
        currentContext = result.context;
        this.logger.info(`Step '${step.name}' completed successfully`);
      } catch (error) {
        this.logger.error(`Step '${step.name}' failed: ${error instanceof Error ? error.message : String(error)}`);
        let err;
        const caughtErr = error as any;
        if (caughtErr instanceof TemplateEngineError) {
          err = caughtErr;
        } else if (typeof caughtErr === 'object' && caughtErr !== null && 'message' in caughtErr) {
          err = new TemplateEngineError(String(caughtErr.message), caughtErr);
        } else {
          err = new TemplateEngineError(String(caughtErr));
        }
        (currentContext as any).errors.push(err);
        return currentContext.template || '';
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