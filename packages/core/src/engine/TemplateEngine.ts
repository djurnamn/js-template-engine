import path from 'path';
import prettier from 'prettier';
import { writeOutputFile } from '../handlers/FileHandler';
import { createLogger } from '../helpers/createLogger';
import { TemplateNode, TemplateOptions, TemplateExtension, Logger } from '../types';
import { StyleProcessor } from './StyleProcessor';
import { StyleProcessorPlugin } from '../types/extensions';

const selfClosingTags = [
  'area',
  'base',
  'br',
  'col',
  'command',
  'embed',
  'hr',
  'img',
  'input',
  'keygen',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
];

export class TemplateEngine {
  private styleProcessor: StyleProcessor;
  private extensions: TemplateExtension[];
  private logger: Logger;

  constructor(extensions: TemplateExtension[] = [], verbose = false) {
    this.extensions = extensions;
    this.logger = createLogger(verbose, 'TemplateEngine');

    const stylePlugins = extensions
      .map(ext => 'stylePlugin' in ext ? (ext as any).stylePlugin : null)
      .filter(Boolean) as StyleProcessorPlugin[];

    this.styleProcessor = new StyleProcessor(verbose, stylePlugins);
  }

  private mergeOptions(options: TemplateOptions): TemplateOptions {
    let defaultOptions: Partial<TemplateOptions> = {
      attributeFormatter: (attribute: string, value: string | number | boolean) => ` ${attribute}="${value}"`,
      fileExtension: '.html',
      filename: options.name ?? 'untitled',
      outputDir: 'dist',
      preferSelfClosingTags: false,
      prettierParser: 'html',
      writeOutputFile: false,
      verbose: false,
      styles: {
        outputFormat: 'css'
      }
    };

    // Merge constructor extensions with options extensions
    const mergedExtensions = [...this.extensions];
    if (options.extensions) {
      // Add any new extensions from options that aren't already in constructor extensions
      options.extensions.forEach(ext => {
        if (!mergedExtensions.some(e => e.key === ext.key)) {
          mergedExtensions.push(ext);
        }
      });
    }

    // Apply extension options handlers
    mergedExtensions.forEach((extension: TemplateExtension) => {
      if (extension.optionsHandler) {
        defaultOptions = extension.optionsHandler(defaultOptions as TemplateOptions, options);
      }
    });

    return { 
      ...defaultOptions, 
      ...options,
      extensions: mergedExtensions // Use merged extensions
    } as TemplateOptions;
  }

  private applyExtensionOverrides(node: TemplateNode, currentExtensionKey: string): TemplateNode {
    if (node.extensions && node.extensions[currentExtensionKey]) {
      const extensionOverrides = node.extensions[currentExtensionKey];

      Object.entries(extensionOverrides).forEach(([key, value]) => {
        if (key !== 'ignore') {
          (node as any)[key] = value;
        }
      });
    }

    return node;
  }

  private processStyles(node: TemplateNode): void {
    this.styleProcessor.processNode(node);
    if (node.children) {
      node.children.forEach(child => this.processStyles(child));
    }
  }

  private isAttributeValue(value: unknown): value is string | number | boolean {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
  }

  private renderAttributes(
    node: TemplateNode,
    formatter: (attr: string, val: string | number | boolean, isExpression?: boolean) => string,
    options: TemplateOptions
  ): string {
    let attributes = '';

    if (node.attributes) {
      for (const [attribute, value] of Object.entries(node.attributes)) {
        if (attribute === 'styles' && options.styles?.outputFormat === 'inline') {
          const inlineStyles = this.styleProcessor.getInlineStyles(node);
          if (inlineStyles) {
            attributes += formatter('style', inlineStyles);
          }
        } else if (this.isAttributeValue(value)) {
          attributes += formatter(attribute, value);
        }
      }
    }

    if (node.expressionAttributes) {
      for (const [attribute, value] of Object.entries(node.expressionAttributes)) {
        attributes += formatter(attribute, value, true);
      }
    }

    return attributes;
  }

  private traverseTree(nodes: TemplateNode[], ancestors: TemplateNode[] = []): TemplateNode[] {
    return nodes.map(node => {
      // Call onNodeVisit hooks for each extension
      for (const ext of this.extensions) {
        if (ext.onNodeVisit) {
          ext.onNodeVisit(node, ancestors);
        }
      }

      const updatedNode = { ...node };
      if (updatedNode.children) {
        updatedNode.children = this.traverseTree(updatedNode.children, [...ancestors, updatedNode]);
      }

      return updatedNode;
    });
  }

  async render(
    nodes: TemplateNode[],
    options: TemplateOptions = {},
    isRoot = true,
    ancestorNodesContext: TemplateNode[] = []
  ): Promise<string> {
    options = isRoot ? this.mergeOptions(options) : options;
    let template = '';

    const { verbose } = options;
    const logger = createLogger(verbose, 'render');
    const attributeFormatter = options.attributeFormatter ?? ((attr: string, val: string | number | boolean, isExpression?: boolean) => ` ${attr}="${val}"`);

    if (isRoot) {
      logger.info('Starting template rendering process...');
      
      // 🔹 1. Call beforeRender hooks
      for (const ext of options.extensions || []) {
        if (ext.beforeRender) {
          ext.beforeRender(nodes, options);
        }
      }
    }

    // 🔹 2. Process node handlers
    let processedNodes = nodes;
    if (options.extensions) {
      for (const extension of options.extensions) {
        processedNodes = this.processNodes(processedNodes, extension);
      }
    }

    // 🔹 3. Apply onNodeVisit hooks
    processedNodes = this.traverseTree(processedNodes, ancestorNodesContext);

    // Render the processed nodes
    for (const node of processedNodes) {
      const currentNodeContext = [...ancestorNodesContext, node];

      if (node.tag) {
        const isSelfClosing = (node.selfClosing || options.preferSelfClosingTags || selfClosingTags.includes(node.tag)) && !node.children;

        if (isSelfClosing) {
          template += `<${node.tag}${this.renderAttributes(node, attributeFormatter, options)} />`;
        } else {
          template += `<${node.tag}${this.renderAttributes(node, attributeFormatter, options)}>`;

          if (node.children) {
            logger.info(`Rendering children for node: ${node.tag}`);
            template += await this.render(node.children, options, false, currentNodeContext);
          }

          template += `</${node.tag}>`;
        }
      } else if (node.type === 'text') {
        logger.info(`Adding text content: "${node.content}"`);
        template += node.content;
      } else if (node.type === 'slot' && node.name && options.slots?.[node.name]) {
        logger.info(`Processing slot: ${node.name}`);
        template += await this.render(options.slots[node.name], options, false, currentNodeContext);
      }
    }

    if (isRoot) {
      // 🔹 4. Process styles
      processedNodes.forEach(node => this.styleProcessor.processNode(node));
      const hasStyles = this.styleProcessor.hasStyles();
      const styleOutput = hasStyles ? this.styleProcessor.generateOutput(options, processedNodes) : '';

      // 🔹 5. Apply root handlers
      if (options.extensions) {
        for (const extension of options.extensions) {
          if (extension.rootHandler) {
            template = extension.rootHandler(template, options);
          }
        }
      }

      // 🔹 6. Call afterRender hooks
      for (const ext of options.extensions || []) {
        if (ext.afterRender) {
          ext.afterRender(processedNodes, options);
        }
      }

      // Write output files if requested
      if (options.writeOutputFile) {
        const outputDir = options.outputDir ?? 'dist';
        const filename = options.filename ?? 'untitled';
        const fileExtension = options.fileExtension ?? '.html';

        // Write template with styles if using inline format
        if (hasStyles && options.styles?.outputFormat === 'inline') {
          template = `${template}\n${styleOutput}`;
        }

        // Format the output if prettier parser is specified
        if (options.prettierParser) {
          template = await prettier.format(template, {
            parser: options.prettierParser,
          });
        }

        // Call onOutputWrite hooks
        for (const ext of options.extensions || []) {
          if (ext.onOutputWrite) {
            template = ext.onOutputWrite(template, options);
          }
        }

        // Write template
        await writeOutputFile(
          template,
          path.join(outputDir, `${filename}${fileExtension}`),
          options.verbose
        );

        // Write styles if not using inline styles and styles exist
        if (hasStyles && options.styles?.outputFormat !== 'inline') {
          const styleExtension = options.styles?.outputFormat === 'scss' ? '.scss' : '.css';
          await writeOutputFile(
            styleOutput,
            path.join(outputDir, `${filename}${styleExtension}`),
            options.verbose
          );
        }
      }
    }

    return template;
  }

  private processNodes(nodes: TemplateNode[], ext: TemplateExtension): TemplateNode[] {
    return nodes.map(node => {
      const newNode = ext.nodeHandler ? ext.nodeHandler(node, []) : node;
      if (newNode.children) {
        newNode.children = this.processNodes(newNode.children, ext);
      }
      return newNode;
    });
  }
} 