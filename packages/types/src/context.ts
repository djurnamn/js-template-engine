import { ExtendedTemplate } from './ExtendedTemplate';
import { StyleProcessorPlugin } from './extensions';

export interface RootHandlerContext {
  component?: ExtendedTemplate['component'];
  framework: string;
  version?: string;
  styleProcessor?: StyleProcessorPlugin;
}

export interface VueComponentOptions {
  directives?: Record<string, string>;
  composition?: boolean;
  useSetup?: boolean;
  scoped?: boolean;
  tag?: string;
  attributes?: Record<string, any>;
  expressionAttributes?: Record<string, string>;
  [key: string]: any;
} 