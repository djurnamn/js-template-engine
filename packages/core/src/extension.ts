import type {
  Extension,
  ProcessResult,
  StyleLayer,
  StylesheetLink,
  StylesheetPlacement,
} from '@js-template-engine/types';

import type { NormalizedComponent } from './normalize';

/** Styling options with defaults applied. */
export interface ResolvedStylingOptions {
  language: 'css' | 'scss';
  /** Where the stylesheet is placed; `'in-file'` when none was configured. */
  placement: StylesheetPlacement;
  /**
   * @deprecated Use `placement` instead, which holds the same value.
   * `outputStrategy` is kept as an alias until the next major version.
   */
  outputStrategy: StylesheetPlacement;
  /**
   * Whether the component links the stylesheet the `separate-file` placement
   * emits; `'component'` when none was configured.
   */
  stylesheetLink: StylesheetLink;
  /** Sass load-path directories; empty when none were configured. */
  loadPaths: string[];
  /** Sass importers tried on every compile; empty when none were given. */
  sassImporters: readonly unknown[];
  /**
   * The cascade layer emitted stylesheet rules are wrapped in; `undefined`
   * when none was configured (rules emit unlayered).
   */
  layer: StyleLayer | undefined;
}

/**
 * Scripting options with defaults applied.
 *
 * @deprecated No target reads them: the html target emits no script and the
 * scripted targets write their own. Removed in 3.0.0.
 */
export interface ResolvedScriptingOptions {
  language: 'javascript' | 'typescript';
  outputStrategy: StylesheetPlacement;
}

/** Processing options with all defaults applied. */
export interface ResolvedProcessingOptions {
  componentName: string;
  extensions: Extension[];
  styling: ResolvedStylingOptions;
  /**
   * @deprecated No target reads it; kept so extensions that read it still
   * compile. Removed in 3.0.0.
   */
  scripting: ResolvedScriptingOptions;
}

/**
 * A target extension: takes over rendering from the built-in HTML
 * renderer and produces the target's component files (React, Vue, Svelte).
 *
 * At most one target extension may be passed per `process()` call.
 */
export interface TargetExtension extends Extension {
  /**
   * `'target'`. `'framework'` is accepted as well and kept until the next
   * major version, so an extension that declares it keeps working.
   */
  readonly kind: 'target' | 'framework';
  /**
   * Stylesheet placements this target cannot produce. Requesting one is a
   * processing error, never a silent fallback.
   */
  readonly unsupportedPlacements?: StylesheetPlacement[];
  /**
   * @deprecated Use `unsupportedPlacements` instead; its `styling` list is
   * read when `unsupportedPlacements` is absent. `unsupportedStrategies` is
   * kept as an alias until the next major version.
   */
  readonly unsupportedStrategies?: {
    styling?: StylesheetPlacement[];
    /**
     * @deprecated Ignored: the `scripting` option has no effect. Removed in
     * 3.0.0.
     */
    scripting?: StylesheetPlacement[];
  };
  /**
   * Whether the target's in-document style blocks pass through a build
   * step that compiles SCSS (e.g. a Vue/Svelte SFC `<style lang="scss">`).
   * When `false` or absent, the `'scss'` styling language is supported only
   * with the `separate-file` placement - an in-document `<style>` block (or
   * the html target's preview) cannot parse SCSS, so `in-file`/`inline` under
   * `'scss'` are a processing error.
   */
  readonly compilesInDocumentStyles?: boolean;
  /**
   * The capitalized tags the target renders without an import (Vue's
   * `Transition` or `Teleport`). Processing warns about any other component
   * reference that no import, prop or binding of the component names.
   */
  readonly builtInComponents?: readonly string[];
  /**
   * Whether the target resolves a component registered globally (Vue's
   * `app.component`), so a component reference nothing imports may still
   * resolve; the processing warning about it says so.
   */
  readonly globalComponentRegistration?: boolean;
  /**
   * How a node spreading `rest` keeps the consumer's class and style, which
   * `rest` carries unmerged. `'merged'`: the target merges them with the
   * node's own (Vue). Otherwise the key of `rest` holding the consumer's class
   * (React's `className`, Svelte's `class`): a node whose class override reads
   * it, and whose style override reads `rest.style`, keeps them. Omitted, every
   * node spreading `rest` with a class or style of its own is warned about.
   * `styleString` marks a target whose `rest.style` is the consumer's
   * style string (Svelte), which an object spread or `Object.assign` would
   * break into characters: a style override doing so is warned about.
   * `styleDirectives` marks a target that writes expression-valued style
   * properties as directives beside the spread's `style` attribute (Svelte's
   * `style:`), which keep the consumer's style: only a whole-object
   * expression or a static inline style replaces it there. A node whose
   * style leaves nothing inline - all of it in the stylesheet - replaces
   * nothing and is never warned about.
   */
  readonly restClassAndStyle?:
    | 'merged'
    | {
        readonly classKey: string;
        readonly styleString?: boolean;
        readonly styleDirectives?: boolean;
      };
  /**
   * Applies the extension's component-level overrides as its render does,
   * for the checks that read the component a target sees (the component
   * references in scope). Omitted, the shared `extensions.<key>` override is
   * applied through `resolveComponentOverrides`; an extension with override
   * blocks of its own - the Svelte extension's per-mode blocks - applies
   * those too.
   */
  readonly resolveComponentOverrides?: (
    component: NormalizedComponent
  ) => NormalizedComponent;
  render(
    component: NormalizedComponent,
    options: ResolvedProcessingOptions
  ): ProcessResult;
}

/** @deprecated Use `TargetExtension`; removed in 3.0.0. */
export type FrameworkExtension = TargetExtension;

/**
 * Returns true when an extension is a target extension: one whose `kind` is
 * `'target'` (or `'framework'`) and that renders.
 *
 * @param extension - The extension to check.
 * @returns Whether the extension is a target extension.
 */
export function isTargetExtension(
  extension: Extension
): extension is TargetExtension {
  const kind = (extension as TargetExtension).kind;
  return (
    (kind === 'target' || kind === 'framework') &&
    typeof (extension as TargetExtension).render === 'function'
  );
}

/**
 * @deprecated Use `isTargetExtension` instead. `isFrameworkExtension` is kept
 * as an alias until the next major version.
 */
export function isFrameworkExtension(
  extension: Extension
): extension is TargetExtension {
  return isTargetExtension(extension);
}
