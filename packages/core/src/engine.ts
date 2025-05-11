import { Extension, TemplateNode, RenderOptions } from '@js-template-engine/types';
import { createLogger } from './utils/logger';

export class TemplateEngine {
  private extensions: Extension[];
  private logger: ReturnType<typeof createLogger>;

  constructor(extensions: Extension[] = [], verbose = false) {
    this.extensions = extensions.filter(ext => ext.nodeHandler !== undefined);
    this.logger = createLogger(verbose, 'TemplateEngine');
  }

  async render(template: TemplateNode[], options: RenderOptions): Promise<void> {
    this.logger.info('Rendering template with options:', options);

    let output = template;

    // Process each extension in sequence
    for (const extension of this.extensions) {
      if (extension.nodeHandler) {
        output = this.processNodes(output, extension);
      }
    }

    // Generate styles if any extension has a style plugin
    const stylePlugins = this.extensions
      .filter(ext => ext.stylePlugin)
      .map(ext => ext.stylePlugin);

    if (stylePlugins.length > 0) {
      await this.generateStyles(output, stylePlugins as NonNullable<Extension['stylePlugin']>[], options);
    }

    this.logger.info('Template rendering complete');
  }

  private processNodes(nodes: TemplateNode[], extension: Extension): TemplateNode[] {
    return nodes.map(node => {
      let processedNode = node;

      if (extension.nodeHandler) {
        processedNode = extension.nodeHandler(node, nodes);
      }

      if (processedNode.children) {
        processedNode.children = this.processNodes(processedNode.children, extension);
      }

      return processedNode;
    });
  }

  private async generateStyles(
    template: TemplateNode[],
    stylePlugins: NonNullable<Extension['stylePlugin']>[],
    options: RenderOptions
  ): Promise<void> {
    for (const plugin of stylePlugins) {
      if (plugin.onProcessNode) {
        // Create a temporary extension that wraps the style plugin's onProcessNode
        const tempExtension: Extension = {
          key: 'style-plugin',
          nodeHandler: (node) => {
            plugin.onProcessNode?.(node);
            return node; // Return the node unchanged
          }
        };
        this.processNodes(template, tempExtension);
      }

      if (plugin.generateStyles) {
        const styles = plugin.generateStyles({}, options, template);
        if (styles) {
          // Handle style output
          this.logger.info('Generated styles:', styles);
        }
      }
    }
  }
} 