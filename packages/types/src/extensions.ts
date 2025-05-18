export type ExtensionKey = string;

export interface Component {
  name?: string;
  props?: Record<string, string>;
  script?: string;
  typescript?: boolean;
  imports?: string[];
  extensions?: Record<string, Record<string, any>>;
}

export interface StyleProcessorPlugin {
  process?: (styles: Map<string, any>, options: any) => string;
  generateStyles?: (styles: Map<string, any>, options: any, template?: any) => string;
  onProcessNode?: (node: any) => string | undefined;
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
}; 