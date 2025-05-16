import type { 
  TemplateNode,
  Extension,
  RenderOptions,
  ExtendedTemplate,
  Logger,
  StyleOutputFormat
} from '@js-template-engine/types';

// Re-export base types
export type {
  TemplateNode,
  Extension,
  RenderOptions,
  ExtendedTemplate,
  Logger,
  StyleOutputFormat
};

// Extend base types with core-specific additions
export interface TemplateOptions extends RenderOptions {
  attributeFormatter?: (attribute: string, value: string | number | boolean, isExpression?: boolean) => string;
  filename?: string;
  componentName?: string;
  preferSelfClosingTags?: boolean;
  prettierParser?: string;
  writeOutputFile?: boolean;
  slots?: Record<string, TemplateNode[]>;
  styles?: {
    outputFormat: StyleOutputFormat;
    generateSourceMap?: boolean;
    minify?: boolean;
  };
} 