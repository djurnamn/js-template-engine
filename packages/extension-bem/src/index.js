"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BemExtension = void 0;
const core_1 = require("@js-template-engine/core");
class BemExtension {
    constructor(verbose = false) {
        this.key = 'bem';
        this.stylePlugin = {
            onProcessNode: (node) => {
                this.logger.info(`BEM style plugin processing node <${node.tag}> with class: ${node.attributes?.class}`);
            },
            generateStyles: (_styles, options, templateTree) => {
                this.logger.info('BEM plugin generateStyles triggered');
                if (options.styles?.outputFormat !== 'scss' || !templateTree) {
                    this.logger.info('Skipping BEM plugin - output format is not SCSS or no template tree provided');
                    return null;
                }
                this.logger.info('Generating BEM SCSS output from template tree');
                return this.generateBemScssFromTree(templateTree);
            }
        };
        this.logger = (0, core_1.createLogger)(verbose, 'BemExtension');
    }
    camelToKebab(str) {
        return str.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    }
    stringifyStyles(styles, indent = 2) {
        const lines = [];
        for (const key in styles) {
            const value = styles[key];
            if (typeof value === 'object') {
                lines.push(`${' '.repeat(indent)}${key} {`);
                lines.push(this.stringifyStyles(value, indent + 2));
                lines.push(`${' '.repeat(indent)}}`);
            }
            else {
                lines.push(`${' '.repeat(indent)}${this.camelToKebab(key)}: ${value};`);
            }
        }
        return lines.join('\n');
    }
    traverse(node, block, selectorTree = {}) {
        var _a;
        if (!node)
            return selectorTree;
        const bem = node.extensions?.bem;
        const styles = node.attributes?.styles;
        if (bem) {
            const blockName = bem.block || block;
            const modifier = bem.modifier;
            if (!selectorTree[blockName])
                selectorTree[blockName] = {};
            if (bem.element) {
                const elementKey = `&__${bem.element}`;
                (_a = selectorTree[blockName])[elementKey] || (_a[elementKey] = {});
                if (modifier) {
                    selectorTree[blockName][elementKey][`&--${modifier}`] = styles || {};
                }
                else if (styles) {
                    Object.assign(selectorTree[blockName][elementKey], styles);
                }
            }
            else {
                if (modifier) {
                    selectorTree[blockName][`&--${modifier}`] = styles || {};
                }
                else if (styles) {
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
    formatSCSS(block, tree, indent = 0) {
        const indentStr = ' '.repeat(indent);
        const lines = [`${indentStr}.${block} {`];
        for (const [key, value] of Object.entries(tree)) {
            if (key.startsWith('&')) {
                lines.push(`${' '.repeat(indent + 2)}${key} {`);
                if (value && typeof value === 'object') {
                    for (const [childKey, childVal] of Object.entries(value)) {
                        if (childKey.startsWith('&')) {
                            lines.push(`${' '.repeat(indent + 4)}${childKey} {`);
                            lines.push(this.stringifyStyles(childVal, indent + 6));
                            lines.push(`${' '.repeat(indent + 4)}}`);
                        }
                        else {
                            lines.push(this.stringifyStyles({ [childKey]: childVal }, indent + 4));
                        }
                    }
                }
                lines.push(`${' '.repeat(indent + 2)}}`);
            }
            else {
                lines.push(this.stringifyStyles({ [key]: value }, indent + 2));
            }
        }
        lines.push(`${indentStr}}`);
        return lines.join('\n');
    }
    generateBemScssFromTree(templateTree) {
        const tree = this.traverse({ children: templateTree });
        return Object.entries(tree)
            .map(([block, node]) => this.formatSCSS(block, node))
            .join('\n\n');
    }
    setNodeExtensionOptionsShortcut(options) {
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
    optionsHandler(defaultOptions, options) {
        return {
            ...defaultOptions,
            ...options,
            separator: {
                element: options.separator?.element ?? '__',
                modifier: options.separator?.modifier ?? '--',
            },
        };
    }
    nodeHandler(node, ancestorNodesContext = []) {
        if (node.ignoreBem) {
            this.logger.info(`Node ignored due to ignoreBem flag: ${JSON.stringify(node)}`);
            return node;
        }
        this.logger.info(`Processing node: ${node.tag}`);
        if (node.tag) {
            const closestAncestorNode = ancestorNodesContext
                .slice()
                .reverse()
                .find((ancestorNode) => ancestorNode.extensions?.bem?.block || ancestorNode.block);
            const block = node.extensions?.bem?.block ?? node.block;
            const element = node.extensions?.bem?.element ?? node.element;
            const modifiers = [
                ...new Set([
                    ...(node.extensions?.bem?.modifiers ?? node.modifiers ?? []),
                    ...(node.extensions?.bem?.modifier ? [node.extensions?.bem?.modifier] : []),
                ]),
            ];
            const inheritedBlock = closestAncestorNode?.extensions?.bem?.block ?? closestAncestorNode?.block;
            if (inheritedBlock && !block) {
                this.logger.info(`Inheriting BEM block from ancestor: ${inheritedBlock}`);
            }
            const bemClasses = this.getBemClasses(block, element, modifiers, inheritedBlock);
            this.logger.info(`Generated BEM classes: ${bemClasses} for node: ${node.tag}`);
            if (node.attributes) {
                node.attributes.class = node.attributes.class
                    ? `${bemClasses} ${node.attributes.class}`
                    : bemClasses;
            }
            else {
                node.attributes = { class: bemClasses };
            }
        }
        return node;
    }
    getBemClasses(block, element, modifiers = [], inheritedBlock) {
        const bemClasses = [];
        const blockToUse = block ?? inheritedBlock ?? 'untitled-block';
        let root;
        if (element) {
            root = `${blockToUse}__${element}`;
        }
        else if (block) {
            root = blockToUse;
        }
        else {
            root = `${blockToUse}__untitled-element`;
        }
        bemClasses.push(root);
        modifiers.forEach((modifier) => {
            bemClasses.push(`${root}--${modifier}`);
        });
        return bemClasses.join(' ');
    }
}
exports.BemExtension = BemExtension;
