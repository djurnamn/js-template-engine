import type { RenderOptions } from '@js-template-engine/types';

export interface Options extends RenderOptions {
  _styleOutput?: string;
}

export namespace VueExtension {
  export interface Options extends RenderOptions {
    _styleOutput?: string;
  }
} 