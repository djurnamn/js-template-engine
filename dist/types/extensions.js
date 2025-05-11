"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isExtensionOptions = isExtensionOptions;
exports.hasNodeExtensions = hasNodeExtensions;
// Type guard for extension options
function isExtensionOptions(value) {
    return typeof value === 'object' && value !== null && 'options' in value;
}
// Type guard for node extensions
function hasNodeExtensions(node, key) {
    return node.extensions !== undefined && key in node.extensions;
}
