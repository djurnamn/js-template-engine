"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StyleProcessor = void 0;
const createLogger_1 = require("../helpers/createLogger");
class StyleProcessor {
    constructor(verbose = false, plugins = []) {
        this.processedStyles = new Map();
        this.plugins = [];
        this.logger = (0, createLogger_1.createLogger)(verbose, 'StyleProcessor');
        this.plugins = plugins;
    }
    processNode(node) {
        if (!node.attributes?.styles) {
            return;
        }
        let selector = this.getSelector(node);
        if (!selector) {
            this.logger.warn('Node has styles but no selector found');
            return;
        }
        // Allow plugins to transform the selector
        this.plugins.forEach(plugin => {
            if (selector) { // Type guard to ensure selector is string
                const newSelector = plugin.onProcessNode?.(node, selector);
                if (typeof newSelector === 'string') {
                    this.logger.info(`Selector transformed by plugin: ${selector} -> ${newSelector}`);
                    selector = newSelector;
                }
            }
        });
        // Merge with existing styles if any
        const existing = this.processedStyles.get(selector) || {};
        const newStyles = node.attributes.styles;
        // Deep merge styles, handling media queries and pseudo-selectors
        const mergedStyles = this.mergeStyleDefinitions(existing, newStyles);
        this.processedStyles.set(selector, mergedStyles);
        this.logger.info(`Processed styles for selector: ${selector}`);
    }
    mergeStyleDefinitions(existing, newStyles) {
        const merged = { ...existing };
        Object.entries(newStyles).forEach(([key, value]) => {
            if (key.startsWith('@media')) {
                // Merge media query styles
                const existingMedia = existing[key] || {};
                merged[key] = { ...existingMedia, ...value };
            }
            else if (key.startsWith(':')) {
                // Merge pseudo-selector styles
                const existingPseudo = existing[key] || {};
                merged[key] = { ...existingPseudo, ...value };
            }
            else {
                // Merge base styles
                merged[key] = value;
            }
        });
        return merged;
    }
    hasStyles() {
        return this.processedStyles.size > 0;
    }
    getSelector(node) {
        if (node.attributes?.class) {
            // Use the first class name as the primary selector
            const classValue = node.attributes.class;
            if (typeof classValue === 'string') {
                const classes = classValue.split(/\s+/);
                return `.${classes[0]}`;
            }
        }
        if (node.tag) {
            return node.tag;
        }
        return null;
    }
    generateOutput(options, originalTemplateTree) {
        if (!options.styles) {
            return '';
        }
        for (const plugin of this.plugins) {
            this.logger.info('Checking plugin for style generation...');
            const pluginOutput = plugin.generateStyles?.(this.processedStyles, options, originalTemplateTree);
            if (pluginOutput) {
                this.logger.info('Using style output from plugin');
                return pluginOutput;
            }
        }
        this.logger.info('No plugin generated output, using default formatter');
        switch (options.styles.outputFormat) {
            case 'inline':
                return this.generateInlineStyles();
            case 'css':
                return this.generateCss();
            case 'scss':
                return this.generateScss();
            default:
                throw new Error(`Unsupported output format: ${options.styles.outputFormat}`);
        }
    }
    generateInlineStyles() {
        const styleTagRules = [];
        this.processedStyles.forEach((styleDef, selector) => {
            // Process pseudo selectors and media queries for style tag
            Object.entries(styleDef).forEach(([key, value]) => {
                if (key.startsWith('@media')) {
                    const query = key.replace('@media', '').trim();
                    const mediaStyles = Object.entries(value)
                        .map(([k, v]) => `${this.camelToKebab(k)}: ${v};`)
                        .join('\n');
                    styleTagRules.push(`@media (${query}) {\n  ${selector} {\n${mediaStyles}\n  }\n}`);
                }
                else if (key.startsWith(':')) {
                    const pseudoStyles = Object.entries(value)
                        .map(([k, v]) => `${this.camelToKebab(k)}: ${v};`)
                        .join('\n');
                    styleTagRules.push(`${selector}${key} {\n${pseudoStyles}\n}`);
                }
            });
        });
        // Only return the style tag if there are rules
        return styleTagRules.length > 0
            ? `\n<style>\n${styleTagRules.join('\n\n')}\n</style>`
            : '';
    }
    generateCss() {
        const styles = [];
        const mediaQueries = new Map();
        const pseudoSelectors = [];
        this.processedStyles.forEach((styleDef, selector) => {
            const baseStyles = [];
            // Process all style rules
            Object.entries(styleDef).forEach(([key, value]) => {
                if (key.startsWith('@media')) {
                    // Handle media queries
                    const query = key.replace('@media', '').trim();
                    if (!mediaQueries.has(query)) {
                        mediaQueries.set(query, []);
                    }
                    const mediaStyles = Object.entries(value)
                        .map(([k, v]) => `    ${this.camelToKebab(k)}: ${v};`)
                        .join('\n');
                    mediaQueries.get(query)?.push(`  ${selector} {\n${mediaStyles}\n  }`);
                }
                else if (key.startsWith(':')) {
                    // Handle pseudo selectors
                    const pseudoStyles = Object.entries(value)
                        .map(([k, v]) => `  ${this.camelToKebab(k)}: ${v};`)
                        .join('\n');
                    pseudoSelectors.push(`${selector}${key} {\n${pseudoStyles}\n}`);
                }
                else {
                    // Handle base styles
                    baseStyles.push(`  ${this.camelToKebab(key)}: ${value};`);
                }
            });
            if (baseStyles.length > 0) {
                styles.push(`${selector} {\n${baseStyles.join('\n')}\n}`);
            }
        });
        // Add pseudo selectors
        styles.push(...pseudoSelectors);
        // Add media queries at the root level
        mediaQueries.forEach((rules, query) => {
            styles.push(`@media (${query}) {\n${rules.join('\n')}\n}`);
        });
        return styles.join('\n\n');
    }
    generateScss() {
        const styles = [];
        this.processedStyles.forEach((styleDef, selector) => {
            const rules = [];
            // Process all style rules
            Object.entries(styleDef).forEach(([key, value]) => {
                if (key.startsWith('@media')) {
                    // Handle media queries with proper nesting
                    const query = key.replace('@media', '').trim();
                    const mediaStyles = Object.entries(value)
                        .map(([k, v]) => `      ${this.camelToKebab(k)}: ${v};`)
                        .join('\n');
                    rules.push(`  @media (${query}) {\n    & {\n${mediaStyles}\n    }\n  }`);
                }
                else if (key.startsWith(':')) {
                    // Handle pseudo selectors
                    const pseudoStyles = Object.entries(value)
                        .map(([k, v]) => `    ${this.camelToKebab(k)}: ${v};`)
                        .join('\n');
                    rules.push(`  &${key} {\n${pseudoStyles}\n  }`);
                }
                else {
                    // Handle base styles
                    rules.push(`  ${this.camelToKebab(key)}: ${value};`);
                }
            });
            if (rules.length > 0) {
                styles.push(`${selector} {\n${rules.join('\n')}\n}`);
            }
        });
        return styles.join('\n\n');
    }
    camelToKebab(str) {
        return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    }
    // Add a new method to get inline styles for a specific node
    getInlineStyles(node) {
        if (!node.attributes?.styles) {
            return null;
        }
        const selector = this.getSelector(node);
        if (!selector) {
            return null;
        }
        const styleDef = this.processedStyles.get(selector);
        if (!styleDef) {
            return null;
        }
        // Convert base styles to inline format
        return Object.entries(styleDef)
            .filter(([key]) => !key.startsWith('@media') && !key.startsWith(':'))
            .map(([key, value]) => `${this.camelToKebab(key)}: ${value}`)
            .join('; ');
    }
}
exports.StyleProcessor = StyleProcessor;
