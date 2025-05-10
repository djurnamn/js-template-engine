import createLogger from '../helpers/createLogger';
import { TemplateNode } from '../types';
import { 
  BemExtension as BemTypes,
  Extension, 
  DeepPartial
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