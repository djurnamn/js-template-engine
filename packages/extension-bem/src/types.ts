import type { RenderOptions, BaseExtensionOptions } from '@js-template-engine/types';

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

export interface BemExtensionOptions extends BaseExtensionOptions {
  fileExtension?: '.html' | '.jsx' | '.tsx' | '.css' | '.ts' | '.vue';
}

export interface BemNodeExtensions {
  block?: string;
  element?: string;
  modifiers?: string[];
} 