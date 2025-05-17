import { ExtendedTemplate } from './ExtendedTemplate';
import { StyleProcessorPlugin } from './extensions';

export interface RootHandlerContext {
  component?: ExtendedTemplate['component'];
  framework: string;
  version?: string;
  styleProcessor?: StyleProcessorPlugin;
} 