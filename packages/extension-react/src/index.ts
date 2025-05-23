import { createLogger } from '@js-template-engine/core';
import type {
  TemplateNode,
  Extension,
  RootHandlerContext,
  BaseExtensionOptions,
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

export class ReactExtension implements Extension<ReactExtensionOptions, ReactNodeExtensions> {
  key = 'react';
  isRenderer = true;
  options: ReactExtensionOptions = {
    fileExtension: '.tsx'
  };

  transformNode(node: TemplateNode): TemplateNode {
    if (node.extensions?.react) {
      const ext = node.extensions.react;

      if (ext.attributes) {
        node.attributes = {
          ...node.attributes,
          ...ext.attributes,
        };
      }

      if (node.attributes?.class && !node.attributes.className) {
        node.attributes.className = node.attributes.class;
        delete node.attributes.class;
      }

      if (node.attributes?.for && !node.attributes.htmlFor) {
        node.attributes.htmlFor = node.attributes.for;
        delete node.attributes.for;
      }

      if (ext.expressionAttributes) {
        node.expressionAttributes = {
          ...(node.expressionAttributes || {}),
          ...ext.expressionAttributes,
        };
        if (ext.expressionAttributes.onClick) {
          delete node.attributes?.onclick;
        }
      }

      if (ext.tag) {
        node.tag = ext.tag;
      }
    }

    return node;
  }

  rootHandler(template: string, options: ReactExtensionOptions, context: RootHandlerContext): string {
    const name = resolveComponentName(context, options);
    const props = resolveComponentProps(context.component);
    const imports = resolveComponentImports(context.component, ['import React from "react";']);

    const isTS = options.fileExtension === '.tsx';
    const exportType = options.exportType ?? 'default';
    const propsParam = options.props ?? 'props';

    const declaration = isTS
      ? `const ${name}: React.FC<${name}Props> = (${propsParam}) => {`
      : `function ${name}(${propsParam}) {`;

    const styleBlock = context.styleOutput
      ? `\n\n/* styles */\n${context.styleOutput}`
      : '';

    const importLines = imports.map((imp) =>
      typeof imp === 'string' ? imp : `import { ${imp.imports.join(', ')} } from '${imp.from}';`
    );

    return `
${importLines.join('\n')}

${props}

${declaration}
  return (
    ${template.trim()}
  );
};

export ${exportType} ${name};${styleBlock}`.trim();
  }
}

// Do not re-export types locally if they're already exported via @types entry point 