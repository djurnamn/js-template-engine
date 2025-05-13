export interface TemplateNode {
  type?: 'element' | 'text' | 'slot';
  tagName?: string;
  attributes?: Record<string, string>;
  children?: TemplateNode[];
  content?: string;
  extensions?: Record<string, any>;
}

export interface NodeExtensions {
  [key: string]: any;
}

export interface Extension<T extends TemplateNode = TemplateNode> {
  key: string;
  nodeHandler?: (node: T, ancestorNodesContext?: TemplateNode[]) => TemplateNode;
  stylePlugin?: {
    onProcessNode?: (node: TemplateNode) => void;
    generateStyles?: (styles: Record<string, any>, options: RenderOptions, template: TemplateNode[]) => Record<string, any> | undefined;
  };
  onNodeVisit?: (node: T, ancestors?: TemplateNode[]) => void;
  beforeRender?: (template: TemplateNode[], options: RenderOptions) => void;
  afterRender?: (template: TemplateNode[], options: RenderOptions) => void;
  onOutputWrite?: (output: string, options: RenderOptions) => string;
}

export interface RenderOptions {
  name?: string;
  outputDir?: string;
  fileExtension?: '.html' | '.jsx' | '.tsx' | '.css';
  verbose?: boolean;
}

export interface BaseExtensionOptions {
  verbose?: boolean;
} 