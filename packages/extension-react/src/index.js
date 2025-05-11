"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReactExtension = void 0;
const core_1 = require("@js-template-engine/core");
const core_2 = require("@js-template-engine/core");
class ReactExtension {
    constructor(verbose = false) {
        this.key = 'react';
        this.logger = (0, core_1.createLogger)(verbose, 'ReactExtension');
    }
    sanitizeComponentName(componentName) {
        return componentName
            .split('-')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
            .join('');
    }
    optionsHandler(defaultOptions, options) {
        const fileExtension = options.fileExtension ?? '.jsx';
        const isTypeScript = fileExtension === '.tsx';
        return {
            ...defaultOptions,
            ...options,
            attributeFormatter: (attribute, value, isExpression = false) => {
                if (!isExpression) {
                    return ` ${attribute}="${value}"`;
                }
                else {
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
    nodeHandler(node) {
        if ((0, core_2.hasNodeExtensions)(node, 'react')) {
            const reactConfig = node.extensions.react;
            this.logger.info(`Processing React extension for node: ${node.tag || 'text'}`);
            if (node.attributes) {
                if ('class' in node.attributes) {
                    this.logger.info(`Transforming 'class' to 'className' for React compatibility.`);
                    node.attributes.className = node.attributes.class;
                    delete node.attributes.class;
                }
                // Handle event attributes
                if ('onclick' in node.attributes) {
                    // If we have a React onClick expression attribute, remove the native onclick
                    if (reactConfig?.expressionAttributes?.onClick) {
                        delete node.attributes.onclick;
                    }
                    else {
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
                this.logger.info(`Overriding node tag with React component: ${reactConfig.tag}`);
                node.tag = reactConfig.tag;
            }
        }
        return node;
    }
    rootHandler(htmlContent, options) {
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
exports.ReactExtension = ReactExtension;
