import { TemplateNode, Extension } from '@js-template-engine/types';
import { TemplateOptions } from './index';
import { ExtendedTemplate } from '@js-template-engine/types';

/**
 * Interface for the main template engine.
 * Defines the core rendering functionality.
 */
export interface LegacyTemplateEngine {
  /**
   * Renders template nodes or extended template to output string.
   * @param input - The template nodes or extended template to render.
   * @param options - Optional rendering options.
   * @param isRoot - Whether this is a root-level render call.
   * @param ancestorNodesContext - Context of ancestor nodes for nested rendering.
   * @returns A promise that resolves to the rendered output string.
   */
  render(
    input: TemplateNode[] | ExtendedTemplate,
    options?: TemplateOptions,
    isRoot?: boolean,
    ancestorNodesContext?: TemplateNode[]
  ): Promise<string>;
}

/**
 * Constructor interface for creating template engine instances.
 * Defines the signature for template engine constructors.
 */
export interface LegacyTemplateEngineConstructor {
  /**
   * Creates a new template engine instance.
   * @param extensions - Optional array of extensions to use.
   * @param verbose - Whether to enable verbose logging.
   * @returns A new template engine instance.
   */
  new (extensions?: Extension[], verbose?: boolean): LegacyTemplateEngine;
}

export type { Extension } from '@js-template-engine/types';
