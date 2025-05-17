import type { RenderOptions } from '@js-template-engine/types';

export namespace VueExtension {
  export interface Options extends RenderOptions {
    _styleOutput?: string;
  }
}

// Re-export Options type for convenience
export type Options = VueExtension.Options; 