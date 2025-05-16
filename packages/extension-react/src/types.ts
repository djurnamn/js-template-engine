import type { RenderOptions } from '@js-template-engine/types';

export namespace ReactExtension {
  export interface Options extends RenderOptions {
    componentName?: string;
    importStatements?: string[];
    exportType?: 'default' | 'named';
    propsInterface?: string;
    props?: string;
  }

  export interface NodeExtensions {
    ignore?: boolean;
    tag?: string;
    attributes?: Record<string, string | number | boolean>;
    expressionAttributes?: Record<string, string>;
  }
} 