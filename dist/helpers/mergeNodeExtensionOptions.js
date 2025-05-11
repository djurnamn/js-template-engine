"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mergeNodeExtensionOptions = (...extensionOptions) => ({
    extensions: Object.assign({}, ...extensionOptions.map((option) => option.extensions ?? {})),
});
exports.default = mergeNodeExtensionOptions;
