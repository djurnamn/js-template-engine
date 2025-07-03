/**
 * ExtensionManager
 * Manages extension lifecycle, ordering, and hook invocation for the template engine.
 */
import type { TemplateNode, Extension } from '@js-template-engine/types';
import type { TemplateOptions } from '../types';

export class ExtensionManager {
  private extensions: Extension[];

  constructor(extensions: Extension[]) {
    this.extensions = [...extensions];
  }

  /**
   * Get the ordered list of extensions.
   */
  getExtensions(): Extension[] {
    return this.extensions;
  }

  /**
   * Call beforeRender on all extensions that implement it.
   */
  callBeforeRender(nodes: TemplateNode[], options: TemplateOptions): void {
    for (const ext of this.extensions) {
      if (ext.beforeRender) {
        ext.beforeRender(nodes, options);
      }
    }
  }

  /**
   * Call afterRender on all extensions that implement it.
   */
  callAfterRender(nodes: TemplateNode[], options: TemplateOptions): void {
    for (const ext of this.extensions) {
      if (ext.afterRender) {
        ext.afterRender(nodes, options);
      }
    }
  }

  /**
   * Call nodeHandler for a given node on all extensions that implement it, in order.
   * Returns the transformed node.
   */
  callNodeHandlers(node: TemplateNode, ancestorNodesContext: TemplateNode[] = []): TemplateNode {
    let result = node;
    for (const ext of this.extensions) {
      if (ext.nodeHandler) {
        result = ext.nodeHandler(result, ancestorNodesContext);
      }
    }
    return result;
  }

  /**
   * Call onNodeVisit for a given node on all extensions that implement it.
   */
  callOnNodeVisit(node: TemplateNode, ancestors: TemplateNode[] = []): void {
    for (const ext of this.extensions) {
      if (ext.onNodeVisit) {
        ext.onNodeVisit(node, ancestors);
      }
    }
  }

  /**
   * Call rootHandler for a given template on all extensions that implement it.
   * Returns the final transformed template string.
   */
  callRootHandlers(template: string, options: TemplateOptions, context: any): string {
    let result = template;
    for (const ext of this.extensions) {
      if (ext.rootHandler) {
        result = ext.rootHandler(result, options, context);
      }
    }
    return result;
  }

  /**
   * Call onOutputWrite for a given output on all extensions that implement it.
   * Returns the final output string.
   */
  callOnOutputWrite(output: string, options: TemplateOptions): string {
    let result = output;
    for (const ext of this.extensions) {
      if (ext.onOutputWrite) {
        result = ext.onOutputWrite(result, options);
      }
    }
    return result;
  }

  /**
   * Call optionsHandler for all extensions that implement it, to merge options.
   * Returns the merged options object.
   */
  callOptionsHandlers(defaultOptions: TemplateOptions, options: TemplateOptions): TemplateOptions {
    let merged = { ...defaultOptions };
    for (const ext of this.extensions) {
      if (ext.optionsHandler) {
        merged = ext.optionsHandler(merged, options);
      }
    }
    return merged;
  }
} 