import type { TemplateNode, ExtendedTemplate, Extension } from '@js-template-engine/types';
import type { TemplateOptions } from '../types';
import type { ExtensionManager } from '../utils/ExtensionManager';

/**
 * Context object passed through the rendering pipeline
 */
export interface RenderContext {
  /** The original input (either TemplateNode[] or ExtendedTemplate) */
  input: TemplateNode[] | ExtendedTemplate;
  
  /** Normalized template nodes */
  nodes: TemplateNode[];
  
  /** Component metadata if available */
  component?: ExtendedTemplate['component'];
  
  /** Merged and validated options */
  options: TemplateOptions;
  
  /** Whether this is the root render call */
  isRoot: boolean;
  
  /** Ancestor nodes for context */
  ancestorNodesContext: TemplateNode[];
  
  /** Processed nodes after extension handling */
  processedNodes?: TemplateNode[];
  
  /** The final rendered template */
  template?: string;
  
  /** Style output if any */
  styleOutput?: string;
  
  /** Whether styles were handled by extensions */
  styleHandled?: boolean;
  
  /** Whether a renderer extension was used */
  usedRendererExtension?: boolean;

  /** The ExtensionManager instance to use for extension calls */
  extensionManager: ExtensionManager;
}

/**
 * Result of a pipeline step
 */
export interface PipelineStepResult {
  /** Whether the step was successful */
  success: boolean;
  
  /** Error message or error object if failed */
  error?: string | Error;
  
  /** Updated context */
  context: RenderContext;
}

/**
 * Interface for pipeline steps
 */
export interface PipelineStep {
  /** Name of the step for logging */
  name: string;
  
  /** Execute the step */
  execute(context: RenderContext): Promise<PipelineStepResult>;
  
  /** Whether this step should run for non-root renders */
  runForNonRoot?: boolean;
} 