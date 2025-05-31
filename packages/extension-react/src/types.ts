import type { BaseExtensionOptions } from '@js-template-engine/types';

export interface ReactExtensionOptions extends BaseExtensionOptions {
  fileExtension?: '.jsx' | '.tsx';
  name?: string;
  componentName?: string;
  rendererKey?: string;
  exportType?: 'default' | 'named';
  props?: string;
  propsInterface?: string;
  importStatements?: string[];
}

export interface ReactNodeExtensions {
  tag?: string;
  attributes?: Record<string, any>;
  expressionAttributes?: Record<string, any>;
}
