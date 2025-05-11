"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BemExtension = void 0;
const createLogger_1 = __importDefault(require("../helpers/createLogger"));
class BemExtension {
    constructor(verbose = false) {
        this.key = 'bem';
        this.logger = (0, createLogger_1.default)(verbose, 'BemExtension');
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
