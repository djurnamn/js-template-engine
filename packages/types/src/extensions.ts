import type { VueComponentOptions } from './context';
import type { ReactComponentOptions } from './ReactComponentOptions';

export type ExtensionKey = 'vue' | 'react' | 'bem';

export interface FrameworkExtensionMap {
  vue: VueComponentOptions;
  react: ReactComponentOptions;
  bem: Record<string, any>;
}

export interface Component {
  name?: string;
  props?: Record<string, string>;
  script?: string;
  extensions?: Partial<FrameworkExtensionMap>;
}

export interface StyleProcessorPlugin {
  process?: (styles: Map<string, any>, options: any) => string;
  generateStyles?: (styles: Map<string, any>, options: any) => string;
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
}; 