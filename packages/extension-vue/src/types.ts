import type { RenderOptions } from '@js-template-engine/types';

export interface VueComponentOptions {
  directives?: Record<string, string>;
  composition?: boolean;
  useSetup?: boolean;
  scoped?: boolean;
  tag?: string;
  attributes?: Record<string, any>;
  expressionAttributes?: Record<string, string>;
  [key: string]: any;
}

export namespace VueExtension {
  export interface Options extends RenderOptions {
    _styleOutput?: string;
  }
}

// Re-export Options type for convenience
export type Options = VueExtension.Options; 