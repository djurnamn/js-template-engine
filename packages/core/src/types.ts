import { Extension, TemplateNode, RenderOptions } from '@js-template-engine/types';

export type TemplateExtension = Extension<TemplateNode> & {
  optionsHandler?: (defaultOptions: any, options: any) => any;
  rootHandler?: (html: string, options: any) => string;
  onNodeVisit?: (node: TemplateNode, ancestors?: TemplateNode[]) => void;
  beforeRender?: (template: TemplateNode[], options: RenderOptions) => void;
  afterRender?: (template: TemplateNode[], options: RenderOptions) => void;
  onOutputWrite?: (output: string, options: RenderOptions) => string;
  nodeHandler?: (node: TemplateNode, ancestors?: TemplateNode[]) => TemplateNode;
};

export type Logger = {
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
  debug: (message: string, ...args: any[]) => void;
};

export type TemplateOptions = RenderOptions & {
  attributeFormatter?: (attribute: string, value: string | number | boolean, isExpression?: boolean) => string;
  filename?: string;
  importStatements?: string[];
  outputDir?: string;
  preferSelfClosingTags?: boolean;
  prettierParser?: string;
  props?: string;
  propsInterface?: string;
  slots?: Record<string, TemplateNode[]>;
  styles?: {
    outputFormat?: 'css' | 'scss' | 'inline';
  };
  writeOutputFile?: boolean;
  verbose?: boolean;
}; 