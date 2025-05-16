import type { TemplateNode, RenderOptions } from './index';

export type ExtensionKey = 'react' | 'bem' | string;

export interface StyleProcessorPlugin {
  onProcessNode?: (node: TemplateNode) => void;
  generateStyles?: (
    processedStyles: Map<string, any>,
    options: RenderOptions,
    templateTree?: TemplateNode[]
  ) => string | undefined;
} 