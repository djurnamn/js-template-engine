import createLogger from '../helpers/createLogger';
import { TemplateNode } from '../types';
import { 
  ReactExtension as ReactTypes,
  Extension, 
  DeepPartial,
  hasNodeExtensions 
} from '../types/extensions';

interface ReactNode extends TemplateNode {
  extensions?: {
    react?: ReactTypes.NodeExtensions;
    [key: string]: any;
  };
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

  public nodeHandler(node: ReactNode): TemplateNode {
    if (hasNodeExtensions<ReactTypes.NodeExtensions>(node, 'react')) {
      const reactConfig = node.extensions.react;

      this.logger.info(
        `Processing React extension for node: ${node.tag || 'text'}`
      );

      if (node.attributes) {
        if ('class' in node.attributes) {
          this.logger.info(
            `Transforming 'class' to 'className' for React compatibility.`
          );
          node.attributes.className = node.attributes.class;
          delete node.attributes.class;
        }

        // Handle event attributes
        if ('onclick' in node.attributes) {
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

  public rootHandler(htmlContent: string, options: ReactTypes.Options): string {
    const rawName = options.componentName ?? options.name ?? 'UntitledComponent';
    const componentName = this.sanitizeComponentName(rawName);
    this.logger.info(`Generating React component: ${componentName}`);

    const importStatements = options.importStatements?.join('\n') ?? "import React from 'react';";
    const propsInterface = options.propsInterface ? options.propsInterface.trim() : '';
    const props = options.props ?? 'props';
    const exportType = options.exportType ?? 'default';
    const isTypeScript = options.fileExtension === '.tsx';

    // Extract interface name from propsInterface if it exists
    let propsType = 'any';
    if (options.propsInterface) {
      const match = options.propsInterface.match(/interface\s+(\w+)/);
      if (match) {
        propsType = match[1];
      }
    }

    // Format the component content with proper indentation
    const formattedContent = htmlContent
      .split('\n')
      .map(line => `    ${line}`)
      .join('\n');

    // Use proper TypeScript syntax for the component declaration
    const componentDeclaration = isTypeScript
      ? `const ${componentName}: React.FC<${propsType}> = (${props ?? 'props'}) => {`
      : `function ${componentName}(${props ?? 'props'}) {`;

    // Build the final template with proper spacing
    const template = [
      importStatements,
      propsInterface,
      [
        componentDeclaration,
        // TODO: add an option with a good name for hooks, states and other pre-return statement content etc.
        '  return (',
        formattedContent,
        '  );',
        '}',
      ].join('\n'),
      exportType === 'default' ? `export default ${componentName};` : `export { ${componentName} };`
    ].filter(Boolean).join('\n\n');

    return template;
  }
} 