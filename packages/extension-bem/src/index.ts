import { createLogger, getExtensionOptions } from '@js-template-engine/core';
import type { TemplateNode, Extension, DeepPartial, StyleProcessorPlugin, BaseExtensionOptions, RootHandlerContext } from '@js-template-engine/types';
import type { BemExtension as BemTypes } from './types';

export interface BemExtensionOptions extends BaseExtensionOptions {
  fileExtension?: string;
}

export interface BemNodeExtensions {
  block?: string;
  element?: string;
  modifiers?: string[];
}

interface BemNode extends TemplateNode {
  block?: string;
  element?: string;
  modifiers?: string[];
  modifier?: string;
  ignoreBem?: boolean;
  extensions?: {
    bem?: BemTypes.NodeExtensions;
    [key: string]: any;
  };
  tag?: string;
  attributes?: Record<string, any>;
}

export class BemExtension implements Extension<BemExtensionOptions, BemNodeExtensions> {
  public readonly key = 'bem' as const;
  private logger: ReturnType<typeof createLogger>;
  isRenderer = false;
  options: BemExtensionOptions = {
    fileExtension: '.html'
  };

  constructor(verbose = false) {
    this.logger = createLogger(verbose, 'BemExtension');
  }

  private camelToKebab(str: string): string {
    return str.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
  }

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

  private traverse(
    node: TemplateNode,
    block?: string,
    selectorTree: any = {}
  ): any {
    if (!node) return selectorTree;

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
              lines.push(this.stringifyStyles(childVal as Record<string, any>, indent + 6));
              lines.push(`${' '.repeat(indent + 4)}}`);
            } else {
              lines.push(this.stringifyStyles({ [childKey]: childVal }, indent + 4));
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

  private generateBemScssFromTree(templateTree: TemplateNode[]): string {
    const tree = this.traverse({ children: templateTree } as TemplateNode);
    return Object.entries(tree)
      .map(([block, node]) => this.formatSCSS(block, node))
      .join('\n\n');
  }

  public readonly stylePlugin: StyleProcessorPlugin = {
    onProcessNode: (node) => {
      this.logger.info(`Processing styles for <${node.tag}>`);
      return undefined;
    },
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
    }
  };

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

  public optionsHandler(defaultOptions: BemTypes.Options, options: DeepPartial<BemTypes.Options>): BemTypes.Options {
    return {
      ...defaultOptions,
      ...options,
      separator: {
        element: options.separator?.element ?? '__',
        modifier: options.separator?.modifier ?? '--',
      },
    };
  }

  // Helper to find the nearest ancestor with a block
  private findNearestBlockNode(ancestors: TemplateNode[]): BemNode | undefined {
    return [...ancestors].reverse().find((ancestor) =>
      getExtensionOptions<BemTypes.NodeExtensions>(ancestor, 'bem')?.block || (ancestor as BemNode)?.block
    ) as BemNode | undefined;
  }

  public onNodeVisit(node: BemNode, ancestors: TemplateNode[] = []): void {
    if (node.ignoreBem || !node.tag) return;

    const bem = getExtensionOptions<BemTypes.NodeExtensions>(node, 'bem');
    
    // Use helper to find the closest ancestor with a block
    const closestBlockNode = this.findNearestBlockNode(ancestors);
    const closestBlockBem = closestBlockNode && getExtensionOptions<BemTypes.NodeExtensions>(closestBlockNode, 'bem');

    // Get block from current node or ancestor
    const block = bem?.block ?? node.block ?? closestBlockBem?.block ?? closestBlockNode?.block;
    if (!block) return; // No block found, don't generate classes

    // Get element and modifiers from current node
    const element = bem?.element ?? node.element;
    const modifiers = [
      ...(bem?.modifiers ?? []),
      ...(bem?.modifier ? [bem.modifier] : []),
      ...(node.modifiers ?? []),
      ...(node.modifier ? [node.modifier] : []),
    ];

    // Generate BEM classes as array
    const bemClasses = this.getBemClasses(block, element, modifiers);
    if (!bemClasses.length) return;

    // Get existing classes and deduplicate
    const existingClass = node.attributes?.class || '';
    const existingClassList = existingClass.split(/\s+/).filter(Boolean);
    const uniqueClasses = Array.from(new Set([...existingClassList, ...bemClasses]));

    // Update node attributes with deduplicated classes
    node.attributes = {
      ...node.attributes,
      class: uniqueClasses.join(' '),
    };

    this.logger.info(`Applied BEM classes to <${node.tag}>: ${uniqueClasses.join(' ')}`);
  }

  private getBemClasses(
    block: string,
    element?: string,
    modifiers: string[] = []
  ): string[] {
    if (!block) return [];
    const base = element ? `${block}__${element}` : block;
    return [base, ...modifiers.map(mod => `${base}--${mod}`)];
  }

  public nodeHandler(node: BemNode, ancestorNodesContext: TemplateNode[] = []): TemplateNode {
    // Delegate to onNodeVisit for BEM class generation
    this.onNodeVisit(node, ancestorNodesContext);
    return node;
  }
} 