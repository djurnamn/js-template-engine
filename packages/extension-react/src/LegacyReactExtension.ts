import { createLogger } from '@js-template-engine/core';
import type {
  TemplateNode,
  Extension,
  RootHandlerContext,
  BaseExtensionOptions,
  ImportDefinition,
} from '@js-template-engine/types';

import type { ReactExtensionOptions, ReactNodeExtensions } from './types';

import {
  resolveComponentName,
  resolveComponentProps,
  resolveComponentImports,
} from '@js-template-engine/types';

const logger = createLogger(false, 'react-extension');

/**
 * Converts a slot name to a valid camelCase JavaScript identifier
 */
function normalizeSlotName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
    .replace(/^[^a-zA-Z_$]/, '_')
    .replace(/[^a-zA-Z0-9_$]/g, '');
}

/**
 * Determines if React import should be injected based on component configuration
 */
function shouldInjectReact(
  imports: ImportDefinition[],
  component: any
): boolean {
  // Check if we need React for hooks or JSX
  const hasHooks = imports.some(
    (imp) =>
      typeof imp === 'string' && imp.includes('use') && imp.includes('react')
  );
  const hasNamedImports = imports.some(
    (imp) =>
      typeof imp === 'string' && imp.includes('{') && imp.includes('react')
  );
  const hasProps = component.props && Object.keys(component.props).length > 0;

  return Boolean(hasHooks || hasNamedImports || hasProps);
}

/**
 * Injects React import if needed and merges with existing imports
 */
function injectReactImport(imports: ImportDefinition[]): ImportDefinition[] {
  const reactImport = { from: 'react', default: 'React' };
  return [reactImport, ...imports];
}

export class ReactExtension implements Extension<ReactExtensionOptions> {
  public key = 'react';
  public isRenderer = true;
  private logger: ReturnType<typeof createLogger>;
  private slotNames: Set<string> = new Set();

  constructor(verbose = false) {
    this.logger = createLogger(verbose, 'react-extension');
  }

  /**
   * Helper method to convert a TemplateNode to JSX string representation.
   * Used for generating inline JSX in conditionals and iterations.
   */
  private nodeToJSX(node: TemplateNode): string {
    // Handle new node types that need JSX transformation
    if (node.type === 'comment') {
      return `{/* ${node.content} */}`;
    }
    
    if (node.type === 'text') {
      return node.content;
    }
    
    if (node.type === 'element' || node.type === undefined) {
      const attrs = node.attributes ? 
        Object.entries(node.attributes)
          .map(([key, value]) => {
            // Transform HTML attributes to React attributes
            const reactKey = key === 'class' ? 'className' : key === 'for' ? 'htmlFor' : key;
            return ` ${reactKey}="${value}"`;
          })
          .join('') : '';
      const children = node.children ? 
        node.children.map(child => this.nodeToJSX(child)).join('') : '';
      return `<${node.tag}${attrs}>${children}</${node.tag}>`;
    }
    
    // For complex node types like if/for, they should have been processed already
    // but if we encounter them here, we need to handle them
    if (node.type === 'if') {
      const thenContent = node.then.length === 1 ? 
        this.nodeToJSX(node.then[0]) : 
        node.then.map(n => this.nodeToJSX(n)).join('');
        
      const elseContent = node.else && node.else.length > 0 ? 
        (node.else.length === 1 ? 
          this.nodeToJSX(node.else[0]) : 
          node.else.map(n => this.nodeToJSX(n)).join('')) :
        '';
      
      return node.else ? 
        `{${node.condition} ? (${thenContent}) : (${elseContent})}` :
        `{${node.condition} && (${thenContent})}`;
    }
    
    if (node.type === 'for') {
      const childrenContent = node.children.map(n => this.nodeToJSX(n)).join('');
      const keyExpression = node.key || 'index';
      return `{${node.items}.map((${node.item}, index) => (${childrenContent}))}`;
    }
    
    if (node.type === 'fragment') {
      const children = node.children ? 
        node.children.map(child => this.nodeToJSX(child)).join('') : '';
      return `<React.Fragment>${children}</React.Fragment>`;
    }
    
    // For other node types, return empty string
    return '';
  }

  /**
   * Handle HTML-to-React attribute transformation after all other extensions have processed the node.
   * This ensures attributes added by other extensions (like BEM classes) get properly transformed.
   */
  public onNodeVisit(node: TemplateNode): void {
    if (node.type === 'element' || node.type === undefined) {
      // Transform HTML attributes to React attributes
      if (node.attributes) {
        const transformedAttributes: Record<string, string> = {};
        for (const [attributeKey, attributeValue] of Object.entries(node.attributes)) {
          if (attributeKey === 'class') {
            transformedAttributes['className'] = String(attributeValue);
            // Don't copy the original 'class' attribute
          } else if (attributeKey === 'for') {
            transformedAttributes['htmlFor'] = String(attributeValue);
            // Don't copy the original 'for' attribute
          } else {
            transformedAttributes[attributeKey] = String(attributeValue);
          }
        }
        node.attributes = transformedAttributes;
      }
    }
  }

  /**
   * Recursively transforms HTML attributes to React attributes and handles special nodes.
   * Converts slot nodes to JSX expressions, handles fragments, conditionals, and iterations.
   * @param node - The template node to process.
   * @returns The processed template node.
   */
  public nodeHandler(node: TemplateNode): TemplateNode {
    // Handle slot nodes - transform to JSX expression
    if (node.type === 'slot') {
      const normalizedName = normalizeSlotName(node.name);
      this.slotNames.add(normalizedName);
      this.logger.info(`Transforming slot '${node.name}' to React prop '${normalizedName}'`);
      
      // Create a text node with JSX expression
      const transformedNode: TemplateNode = {
        type: 'text',
        content: `{props.${normalizedName}}`,
        extensions: node.extensions
      };
      
      return transformedNode;
    }
    
    // Handle fragment nodes - transform to React fragment
    if (node.type === 'fragment') {
      this.logger.info('Transforming fragment to React fragment');
      
      return {
        type: 'element',
        tag: 'React.Fragment',
        children: node.children,
        extensions: node.extensions
      };
    }
    
    // Handle comment nodes - transform to JSX comment
    if (node.type === 'comment') {
      this.logger.info(`Transforming comment: ${node.content}`);
      
      return {
        type: 'text',
        content: `{/* ${node.content} */}`,
        extensions: node.extensions
      };
    }
    
    // Handle conditional nodes - transform to JSX conditional
    if (node.type === 'if') {
      this.logger.info(`Transforming conditional: ${node.condition}`);
      
      // Use raw children - they will be processed by NodeTraverser later
      const thenContent = node.then.length === 1 ? 
        `(${this.nodeToJSX(node.then[0])})` : 
        `(<>${node.then.map(n => this.nodeToJSX(n)).join('')}</>)`;
        
      let elseContent = 'null';
      if (node.else && node.else.length > 0) {
        elseContent = node.else.length === 1 ? 
          `(${this.nodeToJSX(node.else[0])})` : 
          `(<>${node.else.map(n => this.nodeToJSX(n)).join('')}</>)`;
      }
      
      const conditionalExpression = node.else ? 
        `{props.${node.condition} ? ${thenContent} : ${elseContent}}` :
        `{props.${node.condition} && ${thenContent}}`;
      
      return {
        type: 'text',
        content: conditionalExpression,
        extensions: node.extensions
      };
    }
    
    // Handle for nodes - transform to JSX map
    if (node.type === 'for') {
      this.logger.info(`Transforming iteration: ${node.items}`);
      
      const keyExpression = node.key || (node.index || 'index');
      const itemVar = node.item;
      const indexVar = node.index || 'index';
      
      // Use raw children - they will be processed by NodeTraverser later
      const childrenContent = node.children.length === 1 ? 
        this.nodeToJSX(node.children[0]) : 
        `<>${node.children.map(n => this.nodeToJSX(n)).join('')}</>`;
      
      const mapExpression = `{props.${node.items}.map((${itemVar}, ${indexVar}) => (
        <React.Fragment key={${keyExpression}}>${childrenContent}</React.Fragment>
      ))}`;
      
      return {
        type: 'text',
        content: mapExpression,
        extensions: node.extensions
      };
    }
    
    if (node.type !== 'element' && node.type !== undefined) return node;

    // Handle expression attributes
    if (node.extensions?.react?.expressionAttributes) {
      if (!node.expressionAttributes) node.expressionAttributes = {};
      Object.assign(
        node.expressionAttributes,
        node.extensions.react.expressionAttributes
      );
      // Remove the original attributes that have expression versions
      Object.keys(node.extensions.react.expressionAttributes).forEach((key) => {
        const lowerKey = key.toLowerCase();
        if (node.attributes?.[lowerKey]) {
          delete node.attributes[lowerKey];
        }
        if (node.attributes?.[key]) {
          delete node.attributes[key];
        }
      });
    }

    // Children will be processed by NodeTraverser recursively
    return node;
  }

  public attributeFormatter(
    attr: string,
    val: string | number | boolean,
    isExpression?: boolean
  ): string {
    return isExpression ? ` ${attr}={${val}}` : ` ${attr}="${val}"`;
  }

  public rootHandler(
    template: string,
    options: ReactExtensionOptions,
    context: RootHandlerContext
  ): string {
    const { component } = context;
    if (!component) return template;

    // Resolve component name
    const componentName = resolveComponentName(context, options);

    // Process imports
    let imports = component.imports || [];
    if (shouldInjectReact(imports, component)) {
      imports = injectReactImport(imports);
    }
    const importStatements = resolveComponentImports(component, imports);

    // Add style import if present
    const styleImport =
      context.styleOutput || component.extensions?.react?.styleOutput
        ? `import './${componentName}.scss';`
        : null;

    // Use language option to determine TypeScript usage
    const useTypeScript = (options.language ?? 'javascript') === 'typescript';

    // Combine component props with slot props
    const allProps = { ...(component.props || {}) };
    
    // Add slot props as ReactNode type
    for (const slotName of this.slotNames) {
      allProps[slotName] = 'React.ReactNode';
    }

    // Generate props interface only if TypeScript is enabled
    const propsInterface =
      useTypeScript && Object.keys(allProps).length > 0
        ? `\ninterface ${componentName}Props {\n${Object.entries(allProps)
            .map(([key, type]) => `  ${key}?: ${type}`)
            .join('\n')}\n}\n`
        : '';

    // Format component signature based on TypeScript flag
    const hasProps = Object.keys(allProps).length > 0;
    const componentSignature = useTypeScript
      ? hasProps
        ? `const ${componentName}: React.FC<${componentName}Props> = (props) => {`
        : `const ${componentName}: React.FC = () => {`
      : hasProps
        ? `const ${componentName} = (props) => {`
        : `const ${componentName} = () => {`;

    // Return formatted component with proper indentation
    const importSection = importStatements.join('\n');
    const interfaceSection = propsInterface ? propsInterface.trim() : '';
    const styleSection = styleImport ? styleImport : '';
    const componentSection = [
      componentSignature,
      '  return (',
      '    ' + template,
      '  );',
      '};',
    ].join('\n');
    const exportSection = `export default ${componentName};`;

    // Compose sections with blank lines between them
    const result = [
      importSection,
      styleSection,
      interfaceSection,
      componentSection,
      exportSection,
    ]
      .filter((section, idx, arr) => {
        // Remove empty styleSection if not present
        if (section === '' && idx === 1) return false;
        // Remove empty interfaceSection if not present
        if (section === '' && idx === 2) return false;
        return true;
      })
      .join('\n\n');

    // Clear slot names for next render
    this.slotNames.clear();

    return result;
  }

  /**
   * Determines the appropriate file extension for React components based on language preference.
   */
  public getFileExtension(options: { language?: 'typescript' | 'javascript' }): string {
    const language = options.language ?? 'javascript';
    return language === 'typescript' ? '.tsx' : '.jsx';
  }

  /**
   * Determines the appropriate Prettier parser for React components based on language preference.
   */
  public getPrettierParser(options: { language?: 'typescript' | 'javascript' }): string {
    const language = options.language ?? 'javascript';
    return language === 'typescript' ? 'typescript' : 'babel';
  }
}
