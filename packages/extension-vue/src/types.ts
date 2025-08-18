import type {
  RenderOptions,
  BaseExtensionOptions,
} from '@js-template-engine/types';
import type { ComponentOptions } from '@js-template-engine/types/src/Component';

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
  styleLanguage?: 'css' | 'scss' | 'less' | 'stylus';
  scoped?: boolean;
  script?: string;
  composition?: boolean;
  setup?: boolean;
  styles?: {
    outputFormat?: 'css' | 'scss' | 'less' | 'stylus' | 'inline';
  };
}

export interface VueNodeExtensions {
  tag?: string;
  attributes?: Record<string, string | number | boolean>;
  expressionAttributes?: Record<string, string>;
}
