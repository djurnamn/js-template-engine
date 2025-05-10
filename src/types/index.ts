export interface TemplateNode {
  tag?: string;
  type?: 'text' | 'slot';
  content?: string;
  name?: string;
  attributes?: Record<string, string | number | boolean>;
  expressionAttributes?: Record<string, string>;
  children?: TemplateNode[];
  selfClosing?: boolean;
  extensions?: Record<string, any>;
}

export interface TemplateOptions {
  attributeFormatter?: (attribute: string, value: string | number | boolean, isExpression: boolean) => string;
  fileExtension?: string;
  filename?: string;
  name?: string;
  componentName?: string;
  outputDir?: string;
  preferSelfClosingTags?: boolean;
  prettierParser?: string;
  writeOutputFile?: boolean;
  verbose?: boolean;
  extensions?: TemplateExtension[];
  slots?: Record<string, TemplateNode[]>;
}

export interface TemplateExtension {
  key: string;
  optionsHandler?: (defaultOptions: TemplateOptions, options: TemplateOptions) => TemplateOptions;
  nodeHandler: (node: TemplateNode, ancestorNodesContext: TemplateNode[]) => TemplateNode;
  rootHandler?: (template: string, options: TemplateOptions) => string;
}

export interface Logger {
  info: (message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
} 