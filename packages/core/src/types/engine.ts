import { TemplateNode, Extension } from '@js-template-engine/types';
import { TemplateOptions } from './index';
import { ExtendedTemplate } from '@js-template-engine/types';

export interface TemplateEngine {
  render(
    input: TemplateNode[] | ExtendedTemplate,
    options?: TemplateOptions,
    isRoot?: boolean,
    ancestorNodesContext?: TemplateNode[]
  ): Promise<string>;
}

export interface TemplateEngineConstructor {
  new (extensions?: Extension[], verbose?: boolean): TemplateEngine;
}

export type { Extension } from '@js-template-engine/types'; 