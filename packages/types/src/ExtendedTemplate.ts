import { TemplateNode } from './index';

// Base interface for all framework extensions
export interface BaseComponentOptions {
  scopedStyles?: boolean;
  exportType?: 'default' | 'named';
  [key: string]: any;
}

// Framework-specific extension options
export interface ReactComponentOptions extends BaseComponentOptions {
  ignore?: string[];
  jsx?: boolean;
}

export interface VueComponentOptions extends BaseComponentOptions {
  scoped?: boolean;
  composition?: boolean;
  useSetup?: boolean;
}

export interface SvelteComponentOptions extends BaseComponentOptions {
  ssr?: boolean;
}

export interface ExtendedTemplate {
  version?: string;
  component?: {
    name?: string;
    props?: Record<string, string>; // TypeScript-style type map
    imports?: string[];
    script?: string;
    typescript?: boolean;
    extensions?: {
      react?: ReactComponentOptions;
      vue?: VueComponentOptions;
      svelte?: SvelteComponentOptions;
      [key: string]: BaseComponentOptions | undefined;
    };
  };
  template: TemplateNode[];
} 