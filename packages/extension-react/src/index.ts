import { createLogger } from '@js-template-engine/core';
import type { TemplateNode, Extension, DeepPartial, RootHandlerContext } from '@js-template-engine/types';
import { hasNodeExtensions } from '@js-template-engine/types';
import type { ReactExtension as ReactTypes } from './types';

interface ReactNode extends TemplateNode {
  extensions?: {
    react?: ReactTypes.NodeExtensions;
    [key: string]: any;
  };
  tag?: string;
  attributes?: Record<string, any>;
  expressionAttributes?: Record<string, any>;
}

export class ReactExtension implements Extension<ReactTypes.Options, ReactTypes.NodeExtensions> {
  public readonly key = 'react' as const;
  private logger: ReturnType<typeof createLogger>;

  constructor(verbose = false) {
    this.logger = createLogger(verbose, 'ReactExtension');
  }

  private sanitizeComponentName(componentName: string): string {
    return componentName
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join('');
  }

  public optionsHandler(defaultOptions: ReactTypes.Options, options: DeepPartial<ReactTypes.Options>): ReactTypes.Options {
    const fileExtension = options.fileExtension ?? '.jsx';
    const isTypeScript = fileExtension === '.tsx';

    return {
      ...defaultOptions,
      ...options,
      attributeFormatter: (attribute: string, value: string | number | boolean, isExpression = false) => {
        if (!isExpression) {
          return ` ${attribute}="${value}"`;
        } else {
          return ` ${attribute}={${value}}`;
        }
      },
      componentName: options.componentName ?? options.name ?? 'UntitledComponent',
      fileExtension,
      outputDir: 'dist/react',
      preferSelfClosingTags: true,
      prettierParser: isTypeScript ? 'typescript' : 'babel',
    };
  }

  public onNodeVisit(node: ReactNode): void {
    // Transform class to className
    if (node.attributes?.class && !node.attributes.className) {
      this.logger.info(`Converting 'class' to 'className' for <${node.tag}>`);
      node.attributes.className = node.attributes.class;
      delete node.attributes.class;
    }

    // Handle event attributes
    if (node.attributes?.onclick) {
      const reactConfig = node.extensions?.react;
      // If we have a React onClick expression attribute, remove the native onclick
      if (reactConfig?.expressionAttributes?.onClick) {
        delete node.attributes.onclick;
      } else {
        // Otherwise convert to React onClick
        node.attributes.onClick = node.attributes.onclick;
        delete node.attributes.onclick;
      }
    }
  }

  public nodeHandler(node: ReactNode): TemplateNode {
    if (hasNodeExtensions<ReactTypes.NodeExtensions>(node, 'react')) {
      const reactConfig = node.extensions.react;

      this.logger.info(
        `Processing React extension for node: ${node.tag || 'text'}`
      );

      if (reactConfig.attributes) {
        node.attributes = { ...node.attributes, ...reactConfig.attributes };
      }

      if (reactConfig.expressionAttributes) {
        node.expressionAttributes = reactConfig.expressionAttributes;
      }

      if (reactConfig.tag) {
        this.logger.info(
          `Overriding node tag with React component: ${reactConfig.tag}`
        );
        node.tag = reactConfig.tag;
      }
    }

    return node;
  }

  public rootHandler(
    htmlContent: string,
    options: ReactTypes.Options,
    context: RootHandlerContext
  ): string {
    const rawName = context.component?.name ?? options.componentName ?? options.name ?? 'UntitledComponent';
    const componentName = this.sanitizeComponentName(rawName);
    this.logger.info(`Generating React component: ${componentName}`);

    const importStatements = ([
      ...(context.component?.imports ?? []),
      ...(options.importStatements ?? ['import React from \'react\';'])
    ]).join('\n');

    const propsInterface = context.component?.props
      ? `interface ${componentName}Props {\n` +
        Object.entries(context.component.props)
          .map(([key, val]) => `  ${key}: ${val};`)
          .join('\n') + `\n}`
      : options.propsInterface?.trim() ?? '';

    const props = options.props ?? 'props';
    const exportType = context.component?.extensions?.react?.exportType ?? options.exportType ?? 'default';
    const isTypeScript = options.fileExtension === '.tsx';

    const formattedContent = htmlContent
      .split('\n')
      .map(line => `    ${line}`)
      .join('\n');

    const componentDeclaration = isTypeScript
      ? `const ${componentName}: React.FC<${componentName}Props> = (${props}) => {`
      : `function ${componentName}(${props}) {`;

    const preRenderLogic = context.component?.script?.trim() ?? '';

    const template = [
      importStatements,
      propsInterface,
      componentDeclaration,
      preRenderLogic && `  ${preRenderLogic.trim().replace(/\n/g, '\n  ')}`,
      '  return (',
      formattedContent,
      '  );',
      '}',
      exportType === 'default'
        ? `export default ${componentName};`
        : `export { ${componentName} };`
    ].filter(Boolean).join('\n\n');

    return template;
  }
} 