import type { Attributes } from './attributes';
import type { EventDefinition } from './events';
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
 * A fragment's override for one scripted target, carried under
 * `extensions.<key>` on a fragment node: the element or component the
 * fragment renders around its children in that target alone, for a wrapper
 * one target needs and the others do not. Without one, a fragment renders
 * its children alone, the HTML output included. A capitalized `tag` is a
 * component reference, brought into scope by the component-level `imports`
 * override. Any other key, an `attributes` key set to `null`, a `$spread`
 * and a `style` are validation errors: a fragment has no attributes of its
 * own to remove, and styling extensions give it no class, so a class goes in
 * `attributes`. A void `tag` takes no children.
 *
 * @example
 * // A compound root's context provider, in React alone.
 * const node: FragmentNode = {
 *   type: 'fragment',
 *   extensions: {
 *     react: { tag: 'FieldContext', attributes: { value: { $expression: 'id' } } },
 *   },
 *   children: [],
 * };
 */
export interface FragmentOverride {
  /**
   * The element or component rendered around the fragment's children in
   * this target. A capitalized name is a component reference.
   */
  tag: string;
  /** The wrapper's attributes, rendered verbatim in this target. */
  attributes?: Attributes;
  /** The wrapper's events. */
  events?: EventDefinition[];
}

/**
 * A fragment's overrides keyed by target extension name: each a
 * {@link FragmentOverride} naming the wrapper that target renders.
 */
export interface FragmentExtensionOverrides {
  [extensionKey: string]: FragmentOverride;
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
  /** Extension-specific verbatim module-scope lines: import statements and
   *  declarations, placed as the component-level `imports` are. */
  imports?: string[];
  importsStrategy?: OverrideStrategy;
  /** Extension-specific component-level CSS. */
  style?: string;
  styleStrategy?: OverrideStrategy;
  /** Extension-specific prop definitions. */
  props?: Record<string, PropDefinition>;
  propsStrategy?: OverrideStrategy;
}
