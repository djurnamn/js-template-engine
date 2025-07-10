import { createLogger, getExtensionOptions } from '@js-template-engine/core';
import type {
  TemplateNode,
  Extension,
  DeepPartial,
  StyleProcessorPlugin,
  BaseExtensionOptions,
  RootHandlerContext,
} from '@js-template-engine/types';
import type { BemExtension as BemTypes } from './types';

/**
 * Options for configuring the BEM extension.
 */
export interface BemExtensionOptions extends BaseExtensionOptions {
  /** File extension for output files. */
  fileExtension?: string;
  /** Separators for BEM element and modifier. */
  separator?: {
    /** Separator for elements (default: '__'). */
    element?: string;
    /** Separator for modifiers (default: '--'). */
    modifier?: string;
  };
}

/**
 * Node-level BEM extension options.
 */
export interface BemNodeExtensions {
  /** Block name for BEM. */
  block?: string;
  /** Element name for BEM. */
  element?: string;
  /** Modifiers for BEM. */
  modifiers?: string[];
}

/**
 * Internal node type for BEM processing.
 * Extends only element TemplateNode with BEM-specific properties.
 */
interface BemNode extends Extract<TemplateNode, { type?: 'element' }> {
  /** Block name for BEM. */
  block?: string;
  /** Element name for BEM. */
  element?: string;
  /** Modifiers for BEM. */
  modifiers?: string[];
  /** Single modifier for BEM. */
  modifier?: string;
  /** If true, disables BEM processing for this node. */
  ignoreBem?: boolean;
  /** Extension-specific options. */
  extensions?: {
    /** BEM node extensions. */
    bem?: BemTypes.NodeExtensions;
    [key: string]: any;
  };
  /** Tag name for the node. */
  tag: string;
  /** HTML attributes for the node. */
  attributes?: Record<string, any>;
  /** Child nodes of this element. */
  children?: TemplateNode[];
}

/**
 * Type guard to check if a node is an element node.
 * @param node - The node to check.
 * @returns True if the node is an element node.
 */
function isElementNode(
  node: TemplateNode
): node is Extract<TemplateNode, { type?: 'element' }> {
  return node.type === 'element' || node.type === undefined;
}

/**
 * BEM extension for the template engine.
 * Handles BEM class generation and SCSS output.
 * @implements Extension<BemExtensionOptions, BemNodeExtensions>
 */
export class BemExtension
  implements Extension<BemExtensionOptions, BemNodeExtensions>
{
  /** Extension key. */
  public readonly key = 'bem' as const;
  /** Logger instance. */
  private logger: ReturnType<typeof createLogger>;
  /** Whether this extension is a renderer. */
  isRenderer = false;
  /** Extension options. */
  options: BemExtensionOptions = {
    fileExtension: '.html',
    separator: {
      element: '__',
      modifier: '--',
    },
  };

  /**
   * Creates a new BEM extension instance.
   * @param verbose - If true, enables verbose logging.
   */
  constructor(verbose = false) {
    this.logger = createLogger(verbose, 'BemExtension');
  }

  /**
   * Converts a camelCase string to kebab-case.
   * @param str - The string to convert.
   * @returns The kebab-case string.
   */
  private camelToKebab(str: string): string {
    return str.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
  }

  /**
   * Converts a style object to a SCSS string.
   * @param styles - The style object.
   * @param indent - Indentation level.
   * @returns The SCSS string.
   */
  private stringifyStyles(styles: Record<string, any>, indent = 2): string {
    const lines: string[] = [];

    for (const key in styles) {
      const value = styles[key];
      if (typeof value === 'object') {
        lines.push(`${' '.repeat(indent)}${key} {`);
        lines.push(this.stringifyStyles(value, indent + 2));
        lines.push(`${' '.repeat(indent)}}`);
      } else {
        lines.push(`${' '.repeat(indent)}${this.camelToKebab(key)}: ${value};`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Traverses the template tree to build a BEM selector tree.
   * @param node - The current template node.
   * @param block - The current block name.
   * @param selectorTree - The selector tree being built.
   * @returns The updated selector tree.
   */
  private traverse(
    node: TemplateNode,
    block?: string,
    selectorTree: any = {}
  ): any {
    if (!node || !isElementNode(node)) return selectorTree;

    const bem = getExtensionOptions<BemTypes.NodeExtensions>(node, 'bem');
    const styles = node.attributes?.styles;

    if (bem) {
      const blockName = bem.block || block!;
      const modifier = bem.modifier;
      if (!selectorTree[blockName]) selectorTree[blockName] = {};

      if (bem.element) {
        const elementKey = `&__${bem.element}`;
        selectorTree[blockName][elementKey] ||= {};
        if (modifier) {
          selectorTree[blockName][elementKey][`&--${modifier}`] = styles || {};
        } else if (styles) {
          Object.assign(selectorTree[blockName][elementKey], styles);
        }
      } else {
        if (modifier) {
          selectorTree[blockName][`&--${modifier}`] = styles || {};
        } else if (styles) {
          Object.assign(selectorTree[blockName], styles);
        }
      }

      block = blockName;
    }

    if (node.children) {
      for (const child of node.children) {
        this.traverse(child, block, selectorTree);
      }
    }

    return selectorTree;
  }

  /**
   * Formats a BEM selector tree as SCSS.
   * @param block - The block name.
   * @param tree - The selector tree.
   * @param indent - Indentation level.
   * @returns The SCSS string.
   */
  private formatSCSS(block: string, tree: any, indent = 0): string {
    const indentStr = ' '.repeat(indent);
    const lines: string[] = [`${indentStr}.${block} {`];

    for (const [key, value] of Object.entries(tree)) {
      if (key.startsWith('&')) {
        lines.push(`${' '.repeat(indent + 2)}${key} {`);
        if (value && typeof value === 'object') {
          for (const [childKey, childVal] of Object.entries(value)) {
            if (childKey.startsWith('&')) {
              lines.push(`${' '.repeat(indent + 4)}${childKey} {`);
              lines.push(
                this.stringifyStyles(
                  childVal as Record<string, any>,
                  indent + 6
                )
              );
              lines.push(`${' '.repeat(indent + 4)}}`);
            } else {
              lines.push(
                this.stringifyStyles({ [childKey]: childVal }, indent + 4)
              );
            }
          }
        }
        lines.push(`${' '.repeat(indent + 2)}}`);
      } else {
        lines.push(this.stringifyStyles({ [key]: value }, indent + 2));
      }
    }

    lines.push(`${indentStr}}`);
    return lines.join('\n');
  }

  /**
   * Generates BEM SCSS from a template tree.
   * @param templateTree - The template tree.
   * @returns The generated SCSS string.
   */
  private generateBemScssFromTree(templateTree: TemplateNode[]): string {
    const tree = this.traverse({ children: templateTree } as TemplateNode);
    return Object.entries(tree)
      .map(([block, node]) => this.formatSCSS(block, node))
      .join('\n\n');
  }

  /**
   * Style processor plugin for BEM.
   */
  public readonly stylePlugin: StyleProcessorPlugin = {
    /**
     * Called when processing a node for styles.
     * @param node - The template node.
     * @returns Always undefined.
     */
    onProcessNode: (node) => {
      this.logger.info(`Processing styles for <${node.tag}>`);
      return undefined;
    },
    /**
     * Generates SCSS from processed styles or template tree.
     * @param processedStyles - The processed styles map.
     * @param options - Style processor options.
     * @param templateTree - The template tree.
     * @returns The generated SCSS string.
     */
    generateStyles: (processedStyles, options, templateTree) => {
      this.logger.info('Generating SCSS from template tree');
      if (templateTree) {
        return this.generateBemScssFromTree(templateTree);
      }
      if (processedStyles && processedStyles.size > 0) {
        let scss = '';
        processedStyles.forEach((styleDef, selector) => {
          scss += `.${selector} {\n`;
          Object.entries(styleDef).forEach(([key, value]) => {
            scss += `  ${key}: ${value};\n`;
          });
          scss += `}\n`;
        });
        return scss;
      }
      return '';
    },
  };

  /**
   * Sets BEM node extension options as a shortcut.
   * @param options - BEM node extension options.
   * @returns An object with the extensions property set.
   */
  public setNodeExtensionOptionsShortcut(options: {
    block?: string;
    element?: string;
    modifiers?: string[];
    modifier?: string;
  }): { extensions?: { bem: BemTypes.NodeExtensions } } {
    const { block, element, modifiers, modifier } = options;
    return block || element || modifiers || modifier
      ? {
          extensions: {
            bem: {
              ...(block ? { block } : {}),
              ...(element ? { element } : {}),
              ...(modifiers ? { modifiers } : {}),
              ...(modifier ? { modifier } : {}),
            },
          },
        }
      : {};
  }

  /**
   * Merges default and user-provided BEM extension options.
   * @param defaultOptions - The default options.
   * @param options - The user-provided options.
   * @returns The merged options.
   */
  public optionsHandler(
    defaultOptions: BemExtensionOptions,
    options: DeepPartial<BemExtensionOptions>
  ): BemExtensionOptions {
    return {
      ...defaultOptions,
      ...options,
      separator: {
        element: options.separator?.element ?? '__',
        modifier: options.separator?.modifier ?? '--',
      },
    };
  }

  /**
   * Finds the nearest ancestor node with a BEM block.
   * @param ancestors - The ancestor nodes.
   * @returns The nearest ancestor with a block, or undefined.
   */
  private findNearestBlockNode(ancestors: TemplateNode[]): BemNode | undefined {
    return [...ancestors]
      .reverse()
      .find(
        (ancestor) =>
          getExtensionOptions<BemTypes.NodeExtensions>(ancestor, 'bem')
            ?.block || (ancestor as BemNode)?.block
      ) as BemNode | undefined;
  }

  /**
   * Visits a node and applies BEM classes.
   * @param node - The node to visit.
   * @param ancestors - Ancestor nodes.
   */
  public onNodeVisit(node: TemplateNode, ancestors: TemplateNode[] = []): void {
    if (!isElementNode(node)) return;
    const bem = getExtensionOptions<BemTypes.NodeExtensions>(node, 'bem');
    // Use helper to find the closest ancestor with a block
    const closestBlockNode = this.findNearestBlockNode(ancestors);
    const closestBlockBem =
      closestBlockNode &&
      getExtensionOptions<BemTypes.NodeExtensions>(closestBlockNode, 'bem');
    // Get block from current node or ancestor
    const block =
      bem?.block ??
      (node as BemNode).block ??
      closestBlockBem?.block ??
      (closestBlockNode as BemNode)?.block;
    if (!block) return; // No block found, don't generate classes
    // Get element and modifiers from current node
    const element = bem?.element ?? (node as BemNode).element;
    const modifiers = [
      ...(bem?.modifiers ?? []),
      ...(bem?.modifier ? [bem.modifier] : []),
      ...((node as BemNode).modifiers ?? []),
      ...((node as BemNode).modifier ? [(node as BemNode).modifier] : []),
    ].filter((modifier): modifier is string => typeof modifier === 'string');
    // Generate BEM classes as array
    const bemClasses = this.getBemClasses(block, element, modifiers);
    if (!bemClasses.length) return;
    // Get existing classes and deduplicate
    const existingClass = (node as BemNode).attributes?.class || '';
    const existingClassList = existingClass.split(/\s+/).filter(Boolean);
    const uniqueClasses = Array.from(
      new Set([...existingClassList, ...bemClasses])
    );
    // Update node attributes with deduplicated classes
    (node as BemNode).attributes = {
      ...(node as BemNode).attributes,
      class: uniqueClasses.join(' '),
    };
    this.logger.info(
      `Applied BEM classes to <${(node as BemNode).tag}>: ${uniqueClasses.join(' ')}`
    );
  }

  /**
   * Generates BEM class names for a node.
   * @param block - The block name.
   * @param element - The element name.
   * @param modifiers - The modifiers.
   * @returns An array of BEM class names.
   */
  private getBemClasses(
    block: string,
    element?: string,
    modifiers: string[] = []
  ): string[] {
    if (!block) return [];
    const base = element ? `${block}__${element}` : block;
    return [base, ...modifiers.map((mod) => `${base}--${mod}`)];
  }

  /**
   * Handles a node during traversal.
   * @param node - The node to handle.
   * @param ancestorNodesContext - Ancestor nodes.
   * @returns The updated node.
   */
  public nodeHandler(
    node: TemplateNode,
    ancestorNodesContext: TemplateNode[] = []
  ): TemplateNode {
    this.onNodeVisit(node, ancestorNodesContext);
    return node;
  }
}
