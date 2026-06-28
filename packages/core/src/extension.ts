import type {
  Extension,
  OutputStrategy,
  ProcessResult,
} from '@js-template-engine/types';

import type { NormalizedComponent } from './normalize';

/** Styling options with defaults applied. */
export interface ResolvedStylingOptions {
  language: 'css' | 'scss';
  outputStrategy: OutputStrategy;
  /** Sass load-path directories; empty when none were configured. */
  loadPaths: string[];
}

/** Scripting options with defaults applied. */
export interface ResolvedScriptingOptions {
  language: 'javascript' | 'typescript';
  outputStrategy: OutputStrategy;
}

/** Processing options with all defaults applied. */
export interface ResolvedProcessingOptions {
  componentName: string;
  extensions: Extension[];
  styling: ResolvedStylingOptions;
  scripting: ResolvedScriptingOptions;
}

/**
 * A framework extension: takes over rendering from the built-in HTML
 * renderer and produces the target framework's component files.
 *
 * At most one framework extension may be passed per `process()` call.
 */
export interface FrameworkExtension extends Extension {
  readonly kind: 'framework';
  /**
   * Output strategies this framework cannot produce. Requesting one is a
   * processing error, never a silent fallback.
   */
  readonly unsupportedStrategies?: {
    styling?: OutputStrategy[];
    scripting?: OutputStrategy[];
  };
  /**
   * Whether the framework's in-document style blocks pass through a build
   * step that compiles SCSS (e.g. a Vue/Svelte SFC `<style lang="scss">`).
   * When `false` or absent, the `'scss'` styling language is supported only
   * with the `separate-file` strategy - an in-document `<style>` block (or
   * HTML mode's preview) cannot parse SCSS, so `in-file`/`inline` under
   * `'scss'` are a processing error.
   */
  readonly compilesInDocumentStyles?: boolean;
  render(
    component: NormalizedComponent,
    options: ResolvedProcessingOptions
  ): ProcessResult;
}

/** Returns true when an extension is a framework extension. */
export function isFrameworkExtension(
  extension: Extension
): extension is FrameworkExtension {
  return (
    (extension as FrameworkExtension).kind === 'framework' &&
    typeof (extension as FrameworkExtension).render === 'function'
  );
}
