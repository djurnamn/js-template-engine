import { createLogger } from '@js-template-engine/core';
import type {
  TemplateNode,
  Extension,
  RootHandlerContext,
  BaseExtensionOptions,
  ImportDefinition
} from '@js-template-engine/types';

import type {
  ReactExtensionOptions,
  ReactNodeExtensions
} from './types';

import {
  resolveComponentName,
  resolveComponentProps,
  resolveComponentImports
} from '@js-template-engine/types';

const logger = createLogger(false, 'react-extension');

/**
 * Determines if React import should be injected based on component configuration
 */
function shouldInjectReact(imports: ImportDefinition[], component: any): boolean {
  // Check if we need React for hooks or JSX
  const hasHooks = imports.some(imp => 
    typeof imp === 'string' && imp.includes('use') && imp.includes('react')
  );
  const hasNamedImports = imports.some(imp => 
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

  public nodeHandler(node: TemplateNode): TemplateNode {
    if (node.type !== 'element') return node;

    // Handle expression attributes first
    if (node.extensions?.react?.expressionAttributes) {
      if (!node.expressionAttributes) node.expressionAttributes = {};
      Object.assign(node.expressionAttributes, node.extensions.react.expressionAttributes);
      // Remove the original attributes that have expression versions
      Object.keys(node.extensions.react.expressionAttributes).forEach(key => {
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
    const transformedAttrs: Record<string, string> = {};
    for (const [key, value] of Object.entries(node.attributes || {})) {
      if (key === 'class') {
        transformedAttrs['className'] = String(value);
      } else if (key === 'for') {
        transformedAttrs['htmlFor'] = String(value);
      } else {
        transformedAttrs[key] = String(value);
      }
    }
    node.attributes = transformedAttrs;

    return node;
  }

  public attributeFormatter(attr: string, val: string | number | boolean, isExpression?: boolean): string {
    return isExpression ? ` ${attr}={${val}}` : ` ${attr}="${val}"`;
  }

  public rootHandler(template: string, options: ReactExtensionOptions, context: RootHandlerContext): string {
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
    const styleImport = context.styleOutput || component.extensions?.react?.styleOutput
      ? `import './${componentName}.scss';`
      : null;

    // Use component.typescript flag to determine TypeScript usage
    const useTypeScript = component.typescript ?? false;

    // Generate props interface only if TypeScript is enabled
    const propsInterface = useTypeScript && component.props && Object.keys(component.props).length > 0
      ? `\ninterface ${componentName}Props {\n${Object.entries(component.props)
          .map(([key, type]) => `  ${key}: ${type}`)
          .join('\n')}\n}\n`
      : '';

    // Format component signature based on TypeScript flag
    const componentSignature = useTypeScript
      ? component.props && Object.keys(component.props).length > 0
        ? `const ${componentName}: React.FC<${componentName}Props> = (props) => {`
        : `const ${componentName}: React.FC = () => {`
      : component.props && Object.keys(component.props).length > 0
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
      '};'
    ].join('\n');
    const exportSection = `export default ${componentName};`;

    // Compose sections with blank lines between them
    return [
      importSection,
      styleSection,
      interfaceSection,
      componentSection,
      exportSection
    ]
      .filter((section, idx, arr) => {
        // Remove empty styleSection if not present
        if (section === '' && (idx === 1)) return false;
        // Remove empty interfaceSection if not present
        if (section === '' && (idx === 2)) return false;
        return true;
      })
      .join('\n\n');
  }
}
