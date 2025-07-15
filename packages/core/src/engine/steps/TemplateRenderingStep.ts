import type {
  RenderContext,
  PipelineStep,
  PipelineStepResult,
} from '../../types/renderContext';
import { AttributeRenderer } from '../AttributeRenderer';
import { StyleManager } from '../StyleManager';
import { createLogger } from '../../utils/logger';

/**
 * List of HTML tags that are self-closing.
 */
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

/**
 * Renders template nodes to HTML/JSX string.
 * Handles element rendering, text nodes, slots, and style processing.
 */
export class TemplateRenderingStep implements PipelineStep {
  name = 'TemplateRendering';
  private styleManager: StyleManager;
  private logger: ReturnType<typeof createLogger>;

  /**
   * Creates a new TemplateRenderingStep instance.
   * @param styleManager - The style manager for processing inline styles.
   * @param verbose - Whether to enable verbose logging.
   */
  constructor(styleManager: StyleManager, verbose = false) {
    this.styleManager = styleManager;
    this.logger = createLogger(verbose, 'TemplateRendering');
  }

  /**
   * Executes the template rendering step.
   * Renders processed nodes to HTML/JSX string with proper attribute formatting.
   *
   * @param context - The rendering context containing nodes and options.
   * @returns A promise that resolves to the pipeline step result.
   */
  async execute(context: RenderContext): Promise<PipelineStepResult> {
    try {
      const { processedNodes, options, isRoot, ancestorNodesContext } = context;

      // Handle case where no processed nodes are available
      if (!processedNodes || processedNodes.length === 0) {
        // Return empty template for empty nodes
        const updatedContext: RenderContext = {
          ...context,
          template: '',
        };

        return {
          success: true,
          context: updatedContext,
        };
      }

      // Find the first extension that provides an attributeFormatter
      const extensionFormatter = options.extensions?.find(
        (extension): extension is any =>
          typeof (extension as any).attributeFormatter === 'function'
      )?.attributeFormatter;

      // Use extension's formatter if available, otherwise use the default from options
      // If neither is available, use a basic HTML formatter as fallback
      const attributeFormatter =
        extensionFormatter ??
        options.attributeFormatter ??
        ((
          attr: string,
          val: string | number | boolean,
          isExpression?: boolean
        ) => (isExpression ? ` ${attr}={${val}}` : ` ${attr}="${val}"`));

      // Process styles if enabled for inline styles
      if (options.styles?.outputFormat === 'inline') {
        processedNodes.forEach((node) => this.processStyles(node));
      }

      // Render the processed nodes
      let template = '';
      for (const node of processedNodes) {
        const currentNodeContext = [...ancestorNodesContext, node];
        template += await this.renderNode(
          node,
          options,
          attributeFormatter,
          currentNodeContext
        );
      }

      // Update context with rendered template
      const updatedContext: RenderContext = {
        ...context,
        template,
      };

      return {
        success: true,
        context: updatedContext,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        context,
      };
    }
  }

  /**
   * Whether this step should run for non-root renders.
   */
  runForNonRoot = true;

  /**
   * Processes styles for a node and its children recursively.
   * @param node - The template node to process styles for.
   */
  private processStyles(node: any): void {
    this.styleManager.processNode(node);
    if (node.children) {
      node.children.forEach((child: any) => this.processStyles(child));
    }
  }

  /**
   * Renders a single template node to HTML/JSX string.
   * @param node - The template node to render.
   * @param options - The template options.
   * @param attributeFormatter - The function to format attributes.
   * @param ancestorNodesContext - The context of ancestor nodes.
   * @returns A promise that resolves to the rendered node string.
   */
  private async renderNode(
    node: any,
    options: any,
    attributeFormatter: any,
    ancestorNodesContext: any[]
  ): Promise<string> {
    if (node.tag) {
      const isSelfClosing =
        (node.selfClosing ||
          options.preferSelfClosingTags ||
          selfClosingTags.includes(node.tag)) &&
        !node.children;

      if (isSelfClosing) {
        return `<${node.tag}${AttributeRenderer.renderAttributes(
          node,
          attributeFormatter,
          options,
          (n: any) => {
            const result = this.styleManager.getInlineStyles(n);
            return result === null ? undefined : result;
          }
        )} />`;
      } else {
        const attributes = AttributeRenderer.renderAttributes(
          node,
          attributeFormatter,
          options,
          (n: any) => {
            const result = this.styleManager.getInlineStyles(n);
            return result === null ? undefined : result;
          }
        );
        let result = `<${node.tag}${attributes}>`;

        if (node.children) {
          // Recursively render children
          for (const child of node.children) {
            result += await this.renderNode(
              child,
              options,
              attributeFormatter,
              ancestorNodesContext
            );
          }
        }

        result += `</${node.tag}>`;
        return result;
      }
    } else if (node.type === 'text') {
      return node.content;
    } else if (node.type === 'slot' && node.name) {
      
      // Check if slot content is provided in options
      if (options.slots?.[node.name]) {
        // Recursively render provided slot content
        let slotResult = '';
        for (const slotNode of options.slots[node.name]) {
          slotResult += await this.renderNode(
            slotNode,
            options,
            attributeFormatter,
            ancestorNodesContext
          );
        }
        return slotResult;
      } else if (node.fallback) {
        // Render fallback content if no slot content is provided
        let fallbackResult = '';
        for (const fallbackNode of node.fallback) {
          fallbackResult += await this.renderNode(
            fallbackNode,
            options,
            attributeFormatter,
            ancestorNodesContext
          );
        }
        return fallbackResult;
      }
      
      // Return empty string if no content or fallback
      return '';
    } else if (node.type === 'fragment') {
      // Render all children without a wrapper
      let fragmentResult = '';
      for (const child of node.children) {
        fragmentResult += await this.renderNode(
          child,
          options,
          attributeFormatter,
          ancestorNodesContext
        );
      }
      return fragmentResult;
    } else if (node.type === 'comment') {
      // Check if comments should be included (default to true for plain HTML)
      const includeComments = options.includeComments ?? true;
      if (includeComments) {
        return `<!-- ${node.content} -->`;
      }
      return '';
    } else if (node.type === 'if') {
      // For plain HTML, use defaultCondition or default to true (then branch)
      const shouldRenderThen = node.defaultCondition ?? true;
      const nodesToRender = shouldRenderThen ? node.then : (node.else || []);
      
      let ifResult = '';
      for (const childNode of nodesToRender) {
        ifResult += await this.renderNode(
          childNode,
          options,
          attributeFormatter,
          ancestorNodesContext
        );
      }
      return ifResult;
    } else if (node.type === 'for') {
      // For plain HTML, use default items or empty array
      const items = node.default || [];
      
      let forResult = '';
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        // For plain HTML, we can't do variable substitution, so just render the children
        // Extensions will handle proper variable substitution
        for (const childNode of node.children) {
          forResult += await this.renderNode(
            childNode,
            options,
            attributeFormatter,
            [...ancestorNodesContext, { ...node, currentItem: item, currentIndex: i }]
          );
        }
      }
      return forResult;
    }

    return '';
  }
}
