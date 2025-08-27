import { createLogger, getExtensionOptions } from '@js-template-engine/core';
import type {
  TemplateNode,
  Extension,
  DeepPartial,
  StyleProcessorPlugin,
  BaseExtensionOptions,
} from '@js-template-engine/types';
import type {
  StylingExtension,
  ExtensionMetadata,
  StylingConcept,
  ComponentConcept,
  RenderContext,
  StyleOutput
} from '@js-template-engine/core';
import type { BemExtension as BemTypes } from './types';

/**
 * Options for configuring the BEM extension.
 */
export interface BemExtensionOptions extends BaseExtensionOptions {
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
 * BEM Styling Extension
 * 
 * Generates BEM classes and SCSS output for component styling.
 */
export class BemStylingExtension
  implements Extension<BemExtensionOptions, BemNodeExtensions>, StylingExtension
{
  /** Extension metadata */
  public metadata: ExtensionMetadata & { type: 'styling' } = {
    type: 'styling',
    key: 'bem',
    name: 'BEM Extension',
    version: '1.0.0'
  };

  /** Styling approach */
  public styling = 'bem' as const;

  /** Extension key. */
  public readonly key = 'bem' as const;
  /** Logger instance. */
  private logger: ReturnType<typeof createLogger>;
  /** Whether this extension is a renderer. */
  isRenderer = false;
  /** Extension options. */
  options: BemExtensionOptions = {
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
    this.logger = createLogger(verbose, 'BemStylingExtension');
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
   * Process styling concepts through BEM methodology
   */
  processStyles(concepts: StylingConcept): StyleOutput {
    // Generate BEM classes per element from extension data
    const perElementClasses = this.generatePerElementBemClasses(concepts);
    
    // Generate SCSS from all BEM classes  
    const allBemClasses = Object.values(perElementClasses).flat();
    const scssOutput = this.generateScssFromClasses(allBemClasses);
    
    // Return updated styling with per-element BEM classes
    const updatedStyling: StylingConcept = {
      ...concepts,
      perElementClasses: {
        ...concepts.perElementClasses,
        ...perElementClasses
      }
    };
    
    return {
      styles: scssOutput,
      imports: [],
      updatedStyling
    };
  }

  /**
   * Generate BEM classes per element from extension data
   */
  private generatePerElementBemClasses(styling: StylingConcept): Record<string, string[]> {
    const perElementClasses: Record<string, string[]> = {};
    
    // Process BEM extension data if present
    if (styling.extensionData?.bem) {
      // Build block context map for element inheritance
      const blockContext = new Map<string, string>();
      
      // First pass: collect all blocks
      for (const bemNode of styling.extensionData.bem) {
        if (bemNode.data.block) {
          blockContext.set(bemNode.nodeId, bemNode.data.block);
        }
      }
      
      // Second pass: generate classes per element with proper inheritance
      for (const bemNode of styling.extensionData.bem) {
        const bemData = bemNode.data;
        const block = bemData.block || this.findBlockForElement(bemNode.nodeId, blockContext);
        
        if (block) {
          const classes: string[] = [];
          
          // Generate base class (block or block__element)
          let baseClass = block;
          if (bemData.element) {
            baseClass = `${block}__${bemData.element}`;
          }
          
          classes.push(baseClass);
          
          // Generate modifier classes from both singular and plural forms
          const modifiers: string[] = [];
          
          // Handle single modifier (string)
          if (bemData.modifier && typeof bemData.modifier === 'string') {
            modifiers.push(bemData.modifier);
          }
          
          // Handle multiple modifiers (array) 
          if (bemData.modifiers && Array.isArray(bemData.modifiers)) {
            modifiers.push(...bemData.modifiers.filter(Boolean));
          }
          
          // Generate modifier classes
          for (const modifier of modifiers) {
            classes.push(`${baseClass}--${modifier}`);
          }
          
          // Store classes for this specific node
          perElementClasses[bemNode.nodeId] = classes;
        }
      }
    }
    
    return perElementClasses;
  }

  /**
   * Find the appropriate block for an element by walking up the node hierarchy
   */
  private findBlockForElement(nodeId: string, blockContext: Map<string, string>): string | undefined {
    // Walk up the node ID path to find a parent block
    const parts = nodeId.split('.');
    for (let i = parts.length - 1; i >= 0; i--) {
      const ancestorPath = parts.slice(0, i + 1).join('.');
      if (blockContext.has(ancestorPath)) {
        return blockContext.get(ancestorPath);
      }
    }
    return undefined;
  }

  /**
   * Check if a class name follows BEM convention using configured separators
   */
  private isBemClass(className: string): boolean {
    const elementSep = this.options.separator?.element || '__';
    const modifierSep = this.options.separator?.modifier || '--';
    
    // Build regex dynamically based on user configuration
    const escapedElementSep = elementSep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedModifierSep = modifierSep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    const pattern = new RegExp(`^[a-zA-Z][a-zA-Z0-9-]*(${escapedElementSep}[a-zA-Z][a-zA-Z0-9-]*)?(${escapedModifierSep}[a-zA-Z][a-zA-Z0-9-]*)?$`);
    
    // Check basic pattern and avoid invalid structures
    if (!pattern.test(className)) return false;
    
    // Validate no triple separators or leading/trailing separators
    const tripleSep = elementSep + elementSep + elementSep;
    const tripleModSep = modifierSep + modifierSep + modifierSep;
    
    return !className.includes(tripleSep) &&
           !className.includes(tripleModSep) &&
           !className.endsWith(elementSep) &&
           !className.endsWith(modifierSep) &&
           !className.startsWith(elementSep) &&
           !className.startsWith(modifierSep);
  }

  /**
   * Generate SCSS from BEM classes
   */
  private generateScssFromClasses(classes: string[]): string {
    if (classes.length === 0) return '';
    
    const scssLines: string[] = [];
    const processedBlocks = new Set<string>();
    
    for (const className of classes) {
      const blockName = this.extractBlockName(className);
      if (blockName && !processedBlocks.has(blockName)) {
        processedBlocks.add(blockName);
        scssLines.push(`.${blockName} {`);
        
        // Add basic styling structure
        scssLines.push('  /* Add your styling here */');
        
        // Add element and modifier rules
        for (const relatedClass of classes) {
          if (relatedClass.startsWith(blockName)) {
            if (relatedClass.includes('__')) {
              const elementName = relatedClass.split('__')[1].split('--')[0];
              scssLines.push(`  &__${elementName} {`);
              scssLines.push('    /* Element styles */');
              scssLines.push('  }');
            }
            if (relatedClass.includes('--')) {
              const modifierName = relatedClass.split('--')[1];
              scssLines.push(`  &--${modifierName} {`);
              scssLines.push('    /* Modifier styles */');
              scssLines.push('  }');
            }
          }
        }
        
        scssLines.push('}');
        scssLines.push('');
      }
    }
    
    return scssLines.join('\n');
  }

  /**
   * Extract block name from BEM class
   */
  private extractBlockName(className: string): string | null {
    const match = className.match(/^([a-zA-Z][a-zA-Z0-9-]*)/);
    return match ? match[1] : null;
  }


  /**
   * Determines the appropriate file extension for BEM HTML output.
   */
  public getFileExtension(options: { language?: 'typescript' | 'javascript' }): string {
    return '.html';
  }
}

export default BemStylingExtension;
export { BemStylingExtension as BemExtension };
