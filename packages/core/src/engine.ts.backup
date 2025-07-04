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
import { StyleManager } from './engine/StyleManager';
import { AttributeRenderer } from './utils/AttributeRenderer';
import { NodeTraverser } from './utils/NodeTraverser';
import { ExtensionManager } from './utils/ExtensionManager';
import { FileOutputManager } from './utils/FileOutputManager';

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
  private styleManager: StyleManager;
  private extensions: Extension[];
  private logger: Logger;
  private nodeTraverser: NodeTraverser;
  private extensionManager: ExtensionManager;
  private fileOutputManager: FileOutputManager;

  constructor(extensions: Extension[] = [], verbose = false) {
    this.extensions = extensions;
    this.logger = createLogger(verbose, 'TemplateEngine');

    // Enforce only one renderer extension (framework) at a time
    const rendererExtensions = extensions.filter(ext => (ext as any).isRenderer);
    if (rendererExtensions.length > 1) {
      const names = rendererExtensions.map(ext => ext.key || 'unknown').join(', ');
      throw new Error(`Multiple renderer extensions detected: ${names}. Only one renderer extension can be used at a time.`);
    }

    const stylePlugins = extensions
      .map(ext => 'stylePlugin' in ext ? (ext as any).stylePlugin : null)
      .filter(Boolean) as StyleProcessorPlugin[];

    this.styleManager = new StyleManager(verbose, stylePlugins);
    this.nodeTraverser = new NodeTraverser({ extensions });
    this.extensionManager = new ExtensionManager(extensions);
    this.fileOutputManager = new FileOutputManager(verbose);
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
      options.extensions.forEach(ext => {
        if (!mergedExtensions.some(e => e.key === ext.key)) {
          mergedExtensions.push(ext);
        }
      });
    }

    // Use ExtensionManager to merge options
    const extensionManager = new ExtensionManager(mergedExtensions);
    const merged = extensionManager.callOptionsHandlers(defaultOptions as TemplateOptions, options);

    return {
      ...merged,
      ...options,
      extensions: mergedExtensions
    } as TemplateOptions;
  }



  private processStyles(node: TemplateNode): void {
    this.styleManager.processNode(node);
    if (node.children) {
      node.children.forEach(child => this.processStyles(child));
    }
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
      this.extensionManager.callBeforeRender(nodes, options);
    }

    // 🔹 2. Process node handlers
    let processedNodes = nodes;
    if (options.extensions) {
      for (const extension of options.extensions) {
        processedNodes = processedNodes.map(node =>
          this.extensionManager.callNodeHandlers(node, [])
        );
      }
    }

    // 🔹 3. Apply onNodeVisit hooks
    processedNodes = this.nodeTraverser.traverseTree(processedNodes, ancestorNodesContext);

    // 🔹 4. Process styles if enabled
    if (options.styles?.outputFormat === 'inline') {
      processedNodes.forEach(node => this.processStyles(node));
    }



    // Render the processed nodes
    for (const node of processedNodes) {
      const currentNodeContext = [...ancestorNodesContext, node];

      if (node.tag) {
        const isSelfClosing = (node.selfClosing || options.preferSelfClosingTags || selfClosingTags.includes(node.tag)) && !node.children;

        if (isSelfClosing) {
          template += `<${node.tag}${AttributeRenderer.renderAttributes(node, attributeFormatter, options, (n) => {
            const result = this.styleManager.getInlineStyles(n);
            return result === null ? undefined : result;
          })} />`;
        } else {
          template += `<${node.tag}${AttributeRenderer.renderAttributes(node, attributeFormatter, options, (n) => {
            const result = this.styleManager.getInlineStyles(n);
            return result === null ? undefined : result;
          })}>`;

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
      processedNodes.forEach(node => this.styleManager.processNode(node));
      const hasStyles = this.styleManager.hasStyles();
      const styleOutput = hasStyles ? this.styleManager.generateOutput(options, processedNodes) : '';

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
            const result = this.extensionManager.callRootHandlers(template, options, context);
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
          template += `\n<script>\n${scriptContent.join('\n')}\n<\/script>`;
        }
      }

      // 🔹 7. Call afterRender hooks
      this.extensionManager.callAfterRender(processedNodes, options);

      // Write output files if requested
      await this.fileOutputManager.writeAllOutputs({
        template,
        styleOutput,
        hasStyles,
        styleHandled,
        options,
        processedNodes,
        extensionManager: this.extensionManager
      });
    }

    return template;
  }


} 