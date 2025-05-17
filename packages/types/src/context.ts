import { ExtendedTemplate } from './ExtendedTemplate';

export interface RootHandlerContext {
  component?: ExtendedTemplate['component'];
  framework: string;
  version?: string;
} 