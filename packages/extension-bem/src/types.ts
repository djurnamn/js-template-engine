import type { RenderOptions } from '@js-template-engine/types';

export namespace BemExtension {
  export interface Options extends RenderOptions {
    prefix?: string;
    separator?: {
      element?: string;
      modifier?: string;
    };
  }

  export interface NodeExtensions {
    ignore?: boolean;
    block?: string;
    element?: string;
    modifier?: string;
    modifiers?: string[];
  }
} 