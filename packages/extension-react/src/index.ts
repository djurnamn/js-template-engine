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
   * Recursively transforms HTML attributes to React attributes and handles slot nodes.
   * Converts slot nodes to JSX expressions and collects slot names for prop generation.
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
    
    if (node.type !== 'element') return node;

    // Handle expression attributes first
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

    // Transform HTML attributes to React attributes
    const transformedAttributes: Record<string, string> = {};
    for (const [attributeKey, attributeValue] of Object.entries(
      node.attributes || {}
    )) {
      if (attributeKey === 'class') {
        transformedAttributes['className'] = String(attributeValue);
      } else if (attributeKey === 'for') {
        transformedAttributes['htmlFor'] = String(attributeValue);
      } else {
        transformedAttributes[attributeKey] = String(attributeValue);
      }
    }
    node.attributes = transformedAttributes;

    // Recursively transform children
    if (node.children) {
      node.children = node.children.map((child) => this.nodeHandler(child));
    }

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

    // Use component.typescript flag to determine TypeScript usage
    const useTypeScript = component.typescript ?? false;

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
}
