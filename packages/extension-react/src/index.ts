import { createLogger } from '@js-template-engine/core';
import type {
  TemplateNode,
  Extension,
  RootHandlerContext,
  BaseExtensionOptions,
  RenderOptions,
  ExtendedTemplate,
  Component,
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

// Add type guard for object-based imports
function isImportObject(imp: unknown): imp is { from: string; default?: string; named?: string[] } {
  return typeof imp === 'object' && imp !== null && 'from' in imp;
}

// Helper to extract named imports from a string
function extractNamedImports(str: string): string[] {
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

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

/**
 * Merges all React imports (string and object) into a single line, deduplicating named imports.
 */
function mergeReactImports(imports: ImportDefinition[]): string[] {
  let hasDefaultReact = false;
  const namedReactSet = new Set<string>();
  const otherImports: string[] = [];

  for (const imp of imports) {
    if (typeof imp === 'string') {
      // Parse string imports for React (with or without semicolon, any whitespace)
      const match = imp.match(/import\s+(?:([^,{;]+?)(?:,\s*{([^}]+)})?|{([^}]+)})\s+from\s+['"]react['"];?/);
      if (match) {
        // match[1]: default import, match[2]: named with default, match[3]: named only
        if (match[1] && match[1].trim() === 'React') {
          hasDefaultReact = true;
        }
        const named = (match[2] || match[3] || '').split(',').map(s => s.trim()).filter(Boolean);
        named.forEach(name => namedReactSet.add(name));
        continue; // skip adding this import to otherImports
      }
      // Not a React import, keep as is
      otherImports.push(imp);
    } else if (isImportObject(imp) && imp.from === 'react') {
      if (imp.default === 'React') {
        hasDefaultReact = true;
      }
      if (Array.isArray(imp.named)) {
        imp.named.forEach(name => namedReactSet.add(name));
      }
      // skip adding this import to otherImports
    } else if (isImportObject(imp)) {
      // Non-React object import
      const { from, default: defaultImport, named } = imp;
      if (defaultImport && named?.length) {
        otherImports.push(`import ${defaultImport}, { ${named.join(', ')} } from "${from}"`);
      } else if (defaultImport) {
        otherImports.push(`import ${defaultImport} from "${from}"`);
      } else if (named?.length) {
        otherImports.push(`import { ${named.join(', ')} } from "${from}"`);
      }
    }
  }

  // Compose merged React import
  let mergedReact = null;
  if (hasDefaultReact && namedReactSet.size > 0) {
    mergedReact = `import React, { ${Array.from(namedReactSet).join(', ')} } from "react"`;
  } else if (hasDefaultReact) {
    mergedReact = `import React from "react"`;
  } else if (namedReactSet.size > 0) {
    mergedReact = `import { ${Array.from(namedReactSet).join(', ')} } from "react"`;
  }

  return [
    ...(mergedReact ? [mergedReact] : []),
    ...otherImports
  ];
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
    const formattedImports = mergeReactImports(imports);

    // Add style import if present
    const styleImport = context.styleOutput || component.extensions?.react?.styleOutput
      ? `import './${componentName}.scss'`
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
    const importSection = formattedImports.join('\n');
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
