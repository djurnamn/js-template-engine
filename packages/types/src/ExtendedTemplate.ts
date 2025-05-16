import { TemplateNode } from './index';

export interface ExtendedTemplate {
  version?: string;
  component?: {
    name?: string;
    props?: Record<string, string>; // TypeScript-style type map
    imports?: string[];
    script?: string;
    extensions?: Record<string, any>; // Per-extension config
  };
  template: TemplateNode[];
} 