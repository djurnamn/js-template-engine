import createLogger from '../helpers/createLogger';
import { TemplateNode } from '../types';
import { 
  BemExtension as BemTypes,
  Extension, 
  DeepPartial,
  StyleProcessorPlugin
} from '../types/extensions';

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
}

export class BemExtension implements Extension<BemTypes.Options, BemTypes.NodeExtensions> {
  public readonly key = 'bem' as const;
  private logger: ReturnType<typeof createLogger>;

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

    const bem = node.extensions?.bem;
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
      this.logger.info(`BEM style plugin processing node <${node.tag}> with class: ${node.attributes?.class}`);
    },
    generateStyles: (_styles, options, templateTree) => {
      this.logger.info('BEM plugin generateStyles triggered');
      if (options.styles?.outputFormat !== 'scss' || !templateTree) {
        this.logger.info('Skipping BEM plugin - output format is not SCSS or no template tree provided');
        return null;
      }

      this.logger.info('Generating BEM SCSS output from template tree');
      return this.generateBemScssFromTree(templateTree);
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

  public nodeHandler(node: BemNode, ancestorNodesContext: TemplateNode[] = []): TemplateNode {
    if (node.ignoreBem) {
      this.logger.info(
        `Node ignored due to ignoreBem flag: ${JSON.stringify(node)}`
      );
      return node;
    }

    this.logger.info(`Processing node: ${node.tag}`);

    if (node.tag) {
      const closestAncestorNode = ancestorNodesContext
        .slice()
        .reverse()
        .find((ancestorNode) => (ancestorNode as BemNode).extensions?.bem?.block || (ancestorNode as BemNode).block);

      const block = node.extensions?.bem?.block ?? node.block;
      const element = node.extensions?.bem?.element ?? node.element;
      const modifiers = [
        ...new Set([
          ...(node.extensions?.bem?.modifiers ?? node.modifiers ?? []),
          ...(node.extensions?.bem?.modifier ? [node.extensions?.bem?.modifier] : []),
        ]),
      ];
      const inheritedBlock = (closestAncestorNode as BemNode)?.extensions?.bem?.block ?? (closestAncestorNode as BemNode)?.block;

      if (inheritedBlock && !block) {
        this.logger.info(
          `Inheriting BEM block from ancestor: ${inheritedBlock}`
        );
      }

      const bemClasses = this.getBemClasses(
        block,
        element,
        modifiers,
        inheritedBlock
      );

      this.logger.info(
        `Generated BEM classes: ${bemClasses} for node: ${node.tag}`
      );

      if (node.attributes) {
        node.attributes.class = node.attributes.class
          ? `${bemClasses} ${node.attributes.class}`
          : bemClasses;
      } else {
        node.attributes = { class: bemClasses };
      }
    }

    return node;
  }

  private getBemClasses(
    block?: string,
    element?: string,
    modifiers: string[] = [],
    inheritedBlock?: string
  ): string {
    const bemClasses: string[] = [];
    const blockToUse = block ?? inheritedBlock ?? 'untitled-block';
    let root: string;

    if (element) {
      root = `${blockToUse}__${element}`;
    } else if (block) {
      root = blockToUse;
    } else {
      root = `${blockToUse}__untitled-element`;
    }

    bemClasses.push(root);

    modifiers.forEach((modifier) => {
      bemClasses.push(`${root}--${modifier}`);
    });

    return bemClasses.join(' ');
  }
} 