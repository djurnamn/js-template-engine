import path from 'path';
import prettier from 'prettier';
import { writeOutputFile } from './handlers/FileHandler';
import { createLogger } from './utils/logger';
import type { 
  TemplateNode, 
  Extension,
  ExtendedTemplate,
  Logger,
  StyleProcessorPlugin,
  RootHandlerContext
} from '@js-template-engine/types';
import type { TemplateOptions } from './types';
import { StyleProcessor } from './engine/StyleProcessor';
import fs from 'fs';

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

function isExtendedTemplate(input: unknown): input is ExtendedTemplate {
  return (
    typeof input === 'object' &&
    input !== null &&
    !Array.isArray(input) &&
    'template' in input
  );
}

export class TemplateEngine {
  private styleProcessor: StyleProcessor;
  private extensions: Extension[];
  private logger: Logger;

  constructor(extensions: Extension[] = [], verbose = false) {
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
        outputFormat: 'css',
        generateSourceMap: false,
        minify: false,
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
    mergedExtensions.forEach((extension: Extension) => {
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

    // Collect all expression attribute keys for quick lookup
    const expressionKeys = node.expressionAttributes ? new Set(Object.keys(node.expressionAttributes)) : new Set();

    if (node.attributes) {
      for (const [attribute, value] of Object.entries(node.attributes)) {
        // Skip if this attribute is also present in expressionAttributes
        if (expressionKeys.has(attribute)) continue;
        if (attribute === 'style' && options.styles?.outputFormat === 'inline') {
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

  private getOutputPath(options: TemplateOptions, extension: Extension): string {
    const baseOutputDir = options.outputDir ?? 'dist';
    const filename = options.filename ?? 'untitled';
    const fileExtension = options.fileExtension ?? '.html';

    // Only use a subfolder if the extension has a rootHandler (i.e., is a rendering extension)
    const isRenderingExtension = typeof extension.rootHandler === 'function';
    const outputDir = isRenderingExtension
      ? path.join(baseOutputDir, extension.key)
      : baseOutputDir;

    return path.join(outputDir, `${filename}${fileExtension}`);
  }

  async render(
    input: TemplateNode[] | ExtendedTemplate,
    options: TemplateOptions = {},
    isRoot = true,
    ancestorNodesContext: TemplateNode[] = []
  ): Promise<string> {
    // Normalize input
    const { template: nodes, component } = isExtendedTemplate(input)
      ? { template: input.template ?? [], component: input.component }
      : { template: input ?? [], component: undefined };

    if (!Array.isArray(nodes)) {
      throw new Error('Template nodes must be an array');
    }

    options = isRoot ? this.mergeOptions(options) : options;
    let template = '';

    const { verbose } = options;
    const logger = createLogger(Boolean(verbose), 'render');

    // Find the first extension that provides an attributeFormatter
    const extensionFormatter = options.extensions?.find(
      (ext): ext is Extension & { attributeFormatter: typeof options.attributeFormatter } => 
        typeof (ext as any).attributeFormatter === 'function'
    )?.attributeFormatter;

    // Use extension's formatter if available, otherwise use the default from options
    // If neither is available, use a basic HTML formatter as fallback
    const attributeFormatter = extensionFormatter ?? options.attributeFormatter ?? 
      ((attr: string, val: string | number | boolean, isExpression?: boolean) =>
        isExpression ? ` ${attr}={${val}}` : ` ${attr}="${val}"`);

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

    // 🔹 4. Process styles if enabled
    if (options.styles?.outputFormat === 'inline') {
      processedNodes.forEach(node => this.processStyles(node));
    }

    // Debug output to log processedNodes
    console.log('Processed Nodes:', JSON.stringify(processedNodes, null, 2));

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
      // 🔹 5. Process styles
      processedNodes.forEach(node => this.styleProcessor.processNode(node));
      const hasStyles = this.styleProcessor.hasStyles();
      const styleOutput = hasStyles ? this.styleProcessor.generateOutput(options, processedNodes) : '';

      // 🔹 6. Apply root handlers
      let styleHandled = false;
      let usedRendererExtension = false;
      if (options.extensions) {
        for (const extension of options.extensions) {
          if (extension.rootHandler) {
            const context: RootHandlerContext = {
              component,
              framework: extension.key,
              version: isExtendedTemplate(input) ? input.version : undefined,
              styleOutput // Pass the generated styles to the rootHandler
            };
            const result = extension.rootHandler(template, options, context);
            // If the extension included the styles in its output, mark as handled
            if (result.includes(styleOutput)) {
              styleHandled = true;
            }
            template = result;
            if ((extension as any).isRenderer) usedRendererExtension = true;
          }
        }
      }

      // Handle vanilla script imports and content ONLY if no renderer extension was used
      if (!usedRendererExtension && (component?.imports || component?.script)) {
        let scriptContent: string[] = [];

        // Add imports first
        if (component.imports) {
          scriptContent.push(...component.imports
            .filter(line => typeof line === 'string' && line.trim().length > 0)
            .map(line => (typeof line === 'string' ? line.trim() : '')));
        }

        // Add script content with proper indentation
        if (component.script && typeof component.script === 'string' && component.script.trim().length > 0) {
          // Split script into lines and preserve indentation
          const lines = component.script.split('\n');
          // Find the minimum indentation level
          const minIndent = Math.min(...lines
            .filter(line => line.trim().length > 0)
            .map(line => line.search(/\S|$/)));
          
          // Add script content with normalized indentation
          scriptContent.push(...lines
            .map(line => line.replace(/\s+$/g, '')) // Trim trailing whitespace
            .map(line => {
              // If the line is empty, keep it empty
              if (line.trim().length === 0) return '';
              // Otherwise, add 10 spaces of indentation
              return '          ' + line.slice(minIndent);
            }));
        }

        // Remove empty lines at start and end
        while (scriptContent.length > 0 && scriptContent[0].trim() === '') {
          scriptContent.shift();
        }
        while (scriptContent.length > 0 && scriptContent[scriptContent.length - 1].trim() === '') {
          scriptContent.pop();
        }

        if (scriptContent.length > 0) {
          template += `\n<script>\n${scriptContent.join('\n')}\n</script>`;
        }
      }

      // 🔹 7. Call afterRender hooks
      for (const ext of options.extensions || []) {
        if (ext.afterRender) {
          ext.afterRender(processedNodes, options);
        }
      }

      // Write output files if requested
      if (options.writeOutputFile && options.extensions) {
        for (const extension of options.extensions) {
          const outputPath = this.getOutputPath(options, extension);
          const outputDir = path.dirname(outputPath);
          
          // Ensure the output directory exists
          await fs.promises.mkdir(outputDir, { recursive: true });

          // Format the output if prettier parser is specified
          let finalOutput = template;
          if (options.prettierParser) {
            finalOutput = await prettier.format(template, {
              parser: options.prettierParser,
            });
          }

          // Call onOutputWrite hooks
          for (const ext of options.extensions || []) {
            if (ext.onOutputWrite) {
              finalOutput = ext.onOutputWrite(finalOutput, options);
            }
          }

          // Write template
          await writeOutputFile(
            finalOutput,
            outputPath,
            options.verbose
          );

          // Write styles if not handled by any extension and not using inline styles
          if (!styleHandled && hasStyles && options.styles?.outputFormat !== 'inline') {
            const styleExtension = options.styles?.outputFormat === 'scss' ? '.scss' : '.css';
            const stylePath = path.join(
              outputDir,
              `${options.filename ?? 'untitled'}${styleExtension}`
            );
            await writeOutputFile(
              styleOutput,
              stylePath,
              options.verbose
            );
          }
        }
      }
    }

    return template;
  }

  private processNodes(nodes: TemplateNode[], ext: Extension): TemplateNode[] {
    return nodes.map(node => {
      const newNode = ext.nodeHandler ? ext.nodeHandler(node, []) : node;
      if (newNode.children) {
        newNode.children = this.processNodes(newNode.children, ext);
      }
      return newNode;
    });
  }
} 