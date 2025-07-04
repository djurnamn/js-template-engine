import { ExtendedTemplate } from './ExtendedTemplate';
import { StyleProcessorPlugin } from './extensions';

/**
 * Interface for root handler context.
 * Provides context information for root-level template processing.
 */
export interface RootHandlerContext {
  /** The component metadata if available. */
  component?: ExtendedTemplate['component'];
  /** The framework being used (e.g., 'react', 'vue', 'svelte'). */
  framework: string;
  /** The version of the framework or template. */
  version?: string;
  /** Optional style processor plugin for custom style handling. */
  styleProcessor?: StyleProcessorPlugin;
  /** The generated style output from StyleProcessor. */
  styleOutput?: string;
  /** The language of the style block (e.g., 'scss', 'less', 'css'). */
  styleLang?: string;
}
