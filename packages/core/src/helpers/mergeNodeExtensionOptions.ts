import { TemplateOptions } from '../types';

const mergeNodeExtensionOptions = (...extensionOptions: Partial<TemplateOptions>[]): Partial<TemplateOptions> => ({
  extensions: Object.assign(
    {},
    ...extensionOptions.map((option) => option.extensions ?? {})
  ),
});

export default mergeNodeExtensionOptions; 