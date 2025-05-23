import type { RenderOptions, BaseExtensionOptions } from '@js-template-engine/types';

export interface VueComponentOptions {
  directives?: Record<string, string>;
  composition?: boolean;
  useSetup?: boolean;
  scoped?: boolean;
  tag?: string;
  attributes?: Record<string, string>;
  expressionAttributes?: string[] | Record<string, string>;
  customScript?: string;
  customStyle?: string;
  [key: string]: any;
}

export namespace VueExtension {
  export interface Options extends RenderOptions {
    componentName?: string;
    _styleOutput?: string;
  }
}

// Re-export Options type for convenience
export type Options = VueExtension.Options;

export interface VueExtensionOptions extends BaseExtensionOptions {
  fileExtension?: '.vue';
  scriptLang?: 'js' | 'ts';
  styleLang?: 'css' | 'scss' | 'less' | 'stylus';
  scoped?: boolean;
  scriptContent?: string;
}

export interface VueNodeExtensions {
  tag?: string;
  attributes?: Record<string, string | number | boolean>;
  expressionAttributes?: Record<string, string>;
}
