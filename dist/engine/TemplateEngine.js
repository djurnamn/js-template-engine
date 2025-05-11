"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateEngine = void 0;
const path_1 = __importDefault(require("path"));
const prettier_1 = __importDefault(require("prettier"));
const FileHandler_1 = require("../handlers/FileHandler");
const createLogger_1 = __importDefault(require("../helpers/createLogger"));
const StyleProcessor_1 = require("./StyleProcessor");
const selfClosingTags = [
    'area',
    'base',
    'br',
    'col',
    'command',
    'embed',
    'hr',
    'img',
    'input',
    'keygen',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
];
class TemplateEngine {
    constructor() {
        this.styleProcessor = new StyleProcessor_1.StyleProcessor();
    }
    mergeOptions(options) {
        let defaultOptions = {
            attributeFormatter: (attribute, value) => ` ${attribute}="${value}"`,
            fileExtension: '.html',
            filename: options.name ?? 'untitled',
            outputDir: 'dist',
            preferSelfClosingTags: false,
            prettierParser: 'html',
            writeOutputFile: false,
            verbose: false,
            styles: {
                outputFormat: 'css'
            }
        };
        if (options.extensions) {
            options.extensions.forEach((extension) => {
                if (extension.optionsHandler) {
                    defaultOptions = extension.optionsHandler(defaultOptions, options);
                }
            });
        }
        return { ...defaultOptions, ...options };
    }
    applyExtensionOverrides(node, currentExtensionKey) {
        if (node.extensions && node.extensions[currentExtensionKey]) {
            const extensionOverrides = node.extensions[currentExtensionKey];
            Object.keys(extensionOverrides).forEach((key) => {
                if (key === 'ignore') {
                    // special handling for 'ignore' or other meta properties if necessary
                }
                else if (key in node) {
                    // Only override if the property exists on the node
                    node[key] = extensionOverrides[key];
                }
            });
        }
        return node;
    }
    processStyles(node) {
        this.styleProcessor.processNode(node);
        if (node.children) {
            node.children.forEach(child => this.processStyles(child));
        }
    }
    isAttributeValue(value) {
        return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
    }
    async render(nodes, options = {}, isRoot = true, ancestorNodesContext = []) {
        options = isRoot ? this.mergeOptions(options) : options;
        let template = '';
        const { verbose } = options;
        const logger = (0, createLogger_1.default)(verbose, 'render');
        const attributeFormatter = options.attributeFormatter ?? ((attr, val) => ` ${attr}="${val}"`);
        if (isRoot) {
            logger.info('Starting template rendering process...');
        }
        for (let node of nodes) {
            const currentNodeContext = [...ancestorNodesContext, node];
            let shouldIgnoreNode = false;
            if (options.extensions && node.extensions) {
                logger.info(`Processing extensions for node: ${node.tag || 'text'}`);
                for (const extension of options.extensions) {
                    const currentExtensionKey = extension.key;
                    if (node.extensions && node.extensions[currentExtensionKey]) {
                        logger.info(`Applying overrides from extension: ${currentExtensionKey}`);
                        node = this.applyExtensionOverrides(node, currentExtensionKey);
                    }
                    if (node.extensions && node.extensions[currentExtensionKey]?.ignore) {
                        logger.info(`Node ignored by extension: ${currentExtensionKey}`);
                        shouldIgnoreNode = true;
                        break;
                    }
                    if (!shouldIgnoreNode) {
                        logger.info(`Calling nodeHandler from extension: ${currentExtensionKey}`);
                        node = extension.nodeHandler(node, ancestorNodesContext);
                    }
                }
            }
            if (shouldIgnoreNode) {
                logger.info(`Node ignored: ${node.tag || 'text'}. Skipping rendering.`);
                continue;
            }
            logger.info(`Rendering node: ${node.tag || 'text'}`);
            if (node.tag) {
                const isSelfClosing = (node.selfClosing ||
                    options.preferSelfClosingTags ||
                    selfClosingTags.includes(node.tag)) &&
                    !node.children;
                if (isSelfClosing) {
                    template += `<${node.tag}`;
                    if (node.attributes || node.expressionAttributes) {
                        logger.info(`Processing attributes for node: ${node.tag}`);
                    }
                    if (node.attributes) {
                        for (const attribute in node.attributes) {
                            const value = node.attributes[attribute];
                            if (attribute === 'styles' && options.styles?.outputFormat === 'inline') {
                                const inlineStyles = this.styleProcessor.getInlineStyles(node);
                                if (inlineStyles) {
                                    template += attributeFormatter('style', inlineStyles, false);
                                }
                            }
                            else if (this.isAttributeValue(value)) {
                                template += attributeFormatter(attribute, value, false);
                            }
                        }
                    }
                    if (node.expressionAttributes) {
                        for (const attribute in node.expressionAttributes) {
                            template += attributeFormatter(attribute, node.expressionAttributes[attribute], true);
                        }
                    }
                    template += ' />';
                }
                else {
                    template += `<${node.tag}`;
                    if (node.attributes) {
                        for (const attribute in node.attributes) {
                            const value = node.attributes[attribute];
                            if (attribute === 'styles' && options.styles?.outputFormat === 'inline') {
                                const inlineStyles = this.styleProcessor.getInlineStyles(node);
                                if (inlineStyles) {
                                    template += attributeFormatter('style', inlineStyles, false);
                                }
                            }
                            else if (this.isAttributeValue(value)) {
                                template += attributeFormatter(attribute, value, false);
                            }
                        }
                    }
                    if (node.expressionAttributes) {
                        for (const attribute in node.expressionAttributes) {
                            template += attributeFormatter(attribute, node.expressionAttributes[attribute], true);
                        }
                    }
                    template += '>';
                    if (node.children) {
                        logger.info(`Rendering children for node: ${node.tag}`);
                        template += await this.render(node.children, options, false, currentNodeContext);
                    }
                    template += `</${node.tag}>`;
                }
            }
            else if (node.type === 'text') {
                logger.info(`Adding text content: "${node.content}"`);
                template += node.content;
            }
            else if (node.type === 'slot' &&
                node.name &&
                options.slots &&
                options.slots[node.name]) {
                logger.info(`Processing slot: ${node.name}`);
                template += await this.render(options.slots[node.name], options, false, currentNodeContext);
            }
        }
        if (isRoot) {
            // Process styles for the entire template
            nodes.forEach(node => this.processStyles(node));
            // Generate style output if there are any styles
            const hasStyles = this.styleProcessor.hasStyles();
            const styleOutput = hasStyles ? this.styleProcessor.generateOutput(options) : '';
            // Apply root handlers from extensions
            if (options.extensions) {
                for (const extension of options.extensions) {
                    if (extension.rootHandler) {
                        template = extension.rootHandler(template, options);
                    }
                }
            }
            // Write output files if requested
            if (options.writeOutputFile) {
                const outputDir = options.outputDir ?? 'dist';
                const filename = options.filename ?? 'untitled';
                const fileExtension = options.fileExtension ?? '.html';
                // Write template with styles if using inline format
                if (hasStyles && options.styles?.outputFormat === 'inline') {
                    template = `${template}\n${styleOutput}`;
                }
                // Format the output if prettier parser is specified
                if (options.prettierParser) {
                    template = await prettier_1.default.format(template, {
                        parser: options.prettierParser,
                    });
                }
                // Write template
                await (0, FileHandler_1.writeOutputFile)(template, path_1.default.join(outputDir, `${filename}${fileExtension}`), options.verbose);
                // Write styles if not using inline styles and styles exist
                if (hasStyles && options.styles?.outputFormat !== 'inline') {
                    const styleExtension = options.styles?.outputFormat === 'scss' ? '.scss' : '.css';
                    await (0, FileHandler_1.writeOutputFile)(styleOutput, path_1.default.join(outputDir, `${filename}${styleExtension}`), options.verbose);
                }
            }
        }
        return template;
    }
}
exports.TemplateEngine = TemplateEngine;
