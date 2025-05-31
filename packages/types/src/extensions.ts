import type { ImportDefinition } from './Component';

export type ExtensionKey = string;

export interface Component {
  name?: string;
  props?: Record<string, string>;
  script?: string;
  typescript?: boolean;
  imports?: ImportDefinition[];
  extensions?: Record<string, Record<string, any> | undefined>;
}

export interface StyleProcessorPlugin {
  process?: (styles: Map<string, any>, options: any) => string;
  generateStyles?: (styles: Map<string, any>, options: any, template?: any) => string;
  onProcessNode?: (node: any) => string | undefined;
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
}; 