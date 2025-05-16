import { Extension, TemplateNode, RenderOptions, ExtendedTemplate } from '@js-template-engine/types';
import { createLogger } from './utils/logger';

function isExtendedTemplate(input: unknown): input is ExtendedTemplate {
  return (
    typeof input === 'object' &&
    input !== null &&
    !Array.isArray(input) &&
    'template' in input
  );
}

type NormalizedTemplateInput = {
  template: TemplateNode[];
  component?: ExtendedTemplate['component'];
};

function normalizeTemplateInput(input: TemplateNode[] | ExtendedTemplate): NormalizedTemplateInput {
  return isExtendedTemplate(input)
    ? { template: input.template, component: input.component }
    : { template: input, component: undefined };
}

export class TemplateEngine {
  private extensions: Extension[];
  private logger: ReturnType<typeof createLogger>;

  constructor(extensions: Extension[] = [], verbose = false) {
    this.extensions = extensions.filter(ext => ext.nodeHandler !== undefined);
    this.logger = createLogger(verbose, 'TemplateEngine');
  }

  async render(
    input: TemplateNode[] | ExtendedTemplate,
    options: RenderOptions = {},
    isRoot = true,
    ancestorNodesContext: TemplateNode[] = []
  ): Promise<string> {
    const { template: nodes, component } = isExtendedTemplate(input)
      ? { template: input.template, component: input.component }
      : { template: input, component: undefined };
    this.logger.info('Rendering template with options:', options);

    let output = nodes;

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

    // Apply root handlers with component metadata
    let template = '';
    for (const extension of options?.extensions || []) {
      if (extension.rootHandler) {
        template = extension.rootHandler(template, options, component);
      }
    }

    this.logger.info('Template rendering complete');
    return template;
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
        const styles = plugin.generateStyles(new Map(), options, template);
        if (styles) {
          // Handle style output
          this.logger.info('Generated styles:', styles);
        }
      }
    }
  }
} 