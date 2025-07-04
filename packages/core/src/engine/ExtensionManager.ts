/**
 * Manages extension lifecycle, ordering, and hook invocation for the template engine.
 */
import type { TemplateNode, Extension } from '@js-template-engine/types';
import type { TemplateOptions } from '../types';

export class ExtensionManager {
  private extensions: Extension[];

  /**
   * Creates a new ExtensionManager instance.
   * @param extensions - The list of extensions to manage.
   */
  constructor(extensions: Extension[]) {
    this.extensions = [...extensions];
  }

  /**
   * Gets the ordered list of extensions.
   * @returns The array of extensions.
   */
  getExtensions(): Extension[] {
    return this.extensions;
  }

  /**
   * Calls beforeRender on all extensions that implement it.
   * @param nodes - The template nodes to process.
   * @param options - The template options.
   */
  callBeforeRender(nodes: TemplateNode[], options: TemplateOptions): void {
    for (const extension of this.extensions) {
      if (extension.beforeRender) {
        extension.beforeRender(nodes, options);
      }
    }
  }

  /**
   * Calls afterRender on all extensions that implement it.
   * @param nodes - The template nodes to process.
   * @param options - The template options.
   */
  callAfterRender(nodes: TemplateNode[], options: TemplateOptions): void {
    for (const extension of this.extensions) {
      if (extension.afterRender) {
        extension.afterRender(nodes, options);
      }
    }
  }

  /**
   * Calls nodeHandler for a given node on all extensions that implement it, in order.
   * @param node - The template node to process.
   * @param ancestorNodesContext - The ancestor nodes context.
   * @returns The transformed node.
   */
  callNodeHandlers(
    node: TemplateNode,
    ancestorNodesContext: TemplateNode[] = []
  ): TemplateNode {
    let result = node;
    for (const extension of this.extensions) {
      if (extension.nodeHandler) {
        result = extension.nodeHandler(result, ancestorNodesContext);
      }
    }
    return result;
  }

  /**
   * Calls onNodeVisit for a given node on all extensions that implement it.
   * @param node - The template node to visit.
   * @param ancestors - The ancestor nodes.
   */
  callOnNodeVisit(node: TemplateNode, ancestors: TemplateNode[] = []): void {
    for (const extension of this.extensions) {
      if (extension.onNodeVisit) {
        extension.onNodeVisit(node, ancestors);
      }
    }
  }

  /**
   * Calls rootHandler for a given template on all extensions that implement it.
   * @param template - The template string to process.
   * @param options - The template options.
   * @param context - The rendering context.
   * @returns The final transformed template string.
   */
  callRootHandlers(
    template: string,
    options: TemplateOptions,
    context: any
  ): string {
    let result = template;
    for (const extension of this.extensions) {
      if (extension.rootHandler) {
        result = extension.rootHandler(result, options, context);
      }
    }
    return result;
  }

  /**
   * Calls onOutputWrite for a given output on all extensions that implement it.
   * @param output - The output string to process.
   * @param options - The template options.
   * @returns The final output string.
   */
  callOnOutputWrite(output: string, options: TemplateOptions): string {
    let result = output;
    for (const extension of this.extensions) {
      if (extension.onOutputWrite) {
        result = extension.onOutputWrite(result, options);
      }
    }
    return result;
  }

  /**
   * Calls optionsHandler for all extensions that implement it, to merge options.
   * @param defaultOptions - The default template options.
   * @param options - The user-provided template options.
   * @returns The merged options object.
   */
  callOptionsHandlers(
    defaultOptions: TemplateOptions,
    options: TemplateOptions
  ): TemplateOptions {
    let merged = { ...defaultOptions };
    for (const extension of this.extensions) {
      if (extension.optionsHandler) {
        merged = extension.optionsHandler(merged, options);
      }
    }
    return merged;
  }
}
