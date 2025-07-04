import type {
  TemplateNode,
  ExtendedTemplate,
  Component,
} from '@js-template-engine/types';
import type { TemplateOptions } from '../types';
import type { ExtensionManager } from '../engine/ExtensionManager';

/**
 * Context object passed through the rendering pipeline.
 * Contains all data and state needed for template rendering.
 */
export interface RenderContext {
  /** The original input (either TemplateNode[] or ExtendedTemplate). */
  input: TemplateNode[] | ExtendedTemplate;

  /** Normalized template nodes. */
  nodes: TemplateNode[];

  /** Component metadata if available. */
  component?: ExtendedTemplate['component'];

  /** Merged and validated options. */
  options: TemplateOptions;

  /** Whether this is the root render call. */
  isRoot: boolean;

  /** Ancestor nodes for context. */
  ancestorNodesContext: TemplateNode[];

  /** Processed nodes after extension handling. */
  processedNodes?: TemplateNode[];

  /** The final rendered template. */
  template?: string;

  /** Style output if any. */
  styleOutput?: string;

  /** Whether styles were handled by extensions. */
  styleHandled?: boolean;

  /** Whether a renderer extension was used. */
  usedRendererExtension?: boolean;

  /** The ExtensionManager instance to use for extension calls. */
  extensionManager: ExtensionManager;
}

/**
 * Result of a pipeline step execution.
 * Indicates success/failure and provides updated context or error information.
 */
export interface PipelineStepResult {
  /** Whether the step was successful. */
  success: boolean;

  /** Error message or error object if failed. */
  error?: string | Error;

  /** Updated context after step execution. */
  context: RenderContext;
}

/**
 * Interface for pipeline steps.
 * Defines the contract that all rendering pipeline steps must implement.
 */
export interface PipelineStep {
  /** Name of the step for logging and debugging. */
  name: string;

  /**
   * Execute the pipeline step.
   * @param context - The rendering context to process.
   * @returns A promise that resolves to the step result.
   */
  execute(context: RenderContext): Promise<PipelineStepResult>;

  /** Whether this step should run for non-root renders. */
  runForNonRoot?: boolean;
}
