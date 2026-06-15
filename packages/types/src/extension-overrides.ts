import type { PropDefinition } from './props';

/**
 * Per-extension node overrides.
 *
 * Any node may carry overrides under `extensions.<key>`, where `key` is the
 * extension's declared name (`'react'`, `'vue'`, `'bem'`, `'tailwind'`, ...).
 * The override shape is defined by each extension and typed via module
 * augmentation of this interface, so `defineTemplate` autocompletes installed
 * extensions' options.
 *
 * Resolution priority: extension-specific override → generic concept →
 * nothing. Overrides for extensions not present in
 * `ProcessingOptions.extensions` are inert, not errors.
 *
 * @example
 * declare module '@js-template-engine/types' {
 *   interface ExtensionOverrides {
 *     bem?: { block?: string; element?: string; modifiers?: string[] };
 *   }
 * }
 */
export interface ExtensionOverrides {
  [extensionKey: string]: unknown;
}

/**
 * How a component-level extension override combines with the base value.
 *
 * `merge` semantics: imports = concat + dedupe; script/style = base then
 * override appended; props = object spread (override wins per key).
 */
export type OverrideStrategy = 'replace' | 'merge';

/**
 * Component-level overrides keyed by extension name.
 *
 * Each value is at least a `ComponentExtensionOverride`; an extension may
 * widen its own key through module augmentation to carry additional
 * component-level settings (the Vue extension's `scoped` flag, for
 * example), exactly as node-level overrides extend `ExtensionOverrides`.
 *
 * @example
 * declare module '@js-template-engine/types' {
 *   interface ComponentExtensionOverrides {
 *     vue?: ComponentExtensionOverride & { scoped?: boolean };
 *   }
 * }
 */
export interface ComponentExtensionOverrides {
  [extensionKey: string]: unknown;
}

/**
 * Component-level overrides for one extension.
 * All strategies default to `'merge'`.
 */
export interface ComponentExtensionOverride {
  /** Extension-specific script content. */
  script?: string;
  scriptStrategy?: OverrideStrategy;
  /** Extension-specific verbatim import statements. */
  imports?: string[];
  importsStrategy?: OverrideStrategy;
  /** Extension-specific component-level CSS. */
  style?: string;
  styleStrategy?: OverrideStrategy;
  /** Extension-specific prop definitions. */
  props?: Record<string, PropDefinition>;
  propsStrategy?: OverrideStrategy;
}
