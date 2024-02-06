const mergeNodeExtensionOptions = (...extensionOptions) => ({
  extensions: Object.assign(
    {},
    ...extensionOptions.map((option) => option.extensions)
  ),
});

module.exports = mergeNodeExtensionOptions;
