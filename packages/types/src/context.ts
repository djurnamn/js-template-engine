import { ExtendedTemplate } from './ExtendedTemplate';
import { StyleProcessorPlugin } from './extensions';

export interface RootHandlerContext {
  component?: ExtendedTemplate['component'];
  framework: string;
  version?: string;
  styleProcessor?: StyleProcessorPlugin;
  styleOutput?: string; // The generated style output from StyleProcessor
  styleLang?: string; // The language of the style block (e.g., 'scss', 'less')
} 