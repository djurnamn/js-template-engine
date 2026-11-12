import type {
  AttributeOverrides,
  ComponentExtensionOverride,
  EventDefinition,
} from '@js-template-engine/types';

/**
 * Node-level overrides for the Vue extension, carried under
 * `extensions.vue` on element nodes.
 *
 * `tag` replaces the node's element for the Vue render; `attributes` merges
 * into the node's attributes per key, the override winning, and a
 * `null` value removing the node's attribute of that name; `events` replaces
 * the node's event list. Override attributes render verbatim, which is how
 * framework-specific directives without a generic concept - `v-model`, raw
 * `:` bindings - are authored.
 *
 * @example
 * const node: ElementNode = {
 *   type: 'element',
 *   tag: 'input',
 *   extensions: {
 *     vue: { attributes: { 'v-model': 'value' } },
 *   },
 * };
 */
export interface VueNodeOverrides {
  /**
   * Replaces the node's resolved tag for the Vue render. A capitalized value
   * is emitted as a component reference (`'Teleport'` → `<Teleport>`); built-in
   * elements like `Teleport`/`Transition` need no import.
   */
  tag?: string;
  /**
   * Merges into the node's attributes per key, the override winning. A key
   * set to `null` removes the node's attribute of that name in this target
   * alone.
   */
  attributes?: AttributeOverrides;
  events?: EventDefinition[];
}

/**
 * Component-level overrides for the Vue extension. Extends the shared
 * component override with `scoped`, which renders the generated SFC's
 * `<style>` block as `<style scoped>`, and `model`, which names the two-way
 * prop a bare `v-model` binds.
 */
export interface VueComponentOverride extends ComponentExtensionOverride {
  /** Render the SFC `<style>` block as `<style scoped>`. Defaults to `false`. */
  scoped?: boolean;
  /**
   * The prop a consumer binds with a bare `v-model`: one declared with a
   * `bindable` object. The component also takes `modelValue`, which stands in
   * for the prop, and emits `update:modelValue` beside `update:<prop>`, so
   * `v-model="value"` and `v-model:<prop>="value"` both bind it.
   *
   * @example
   * extensions: { vue: { model: 'pressed' } }
   */
  model?: string;
}

declare module '@js-template-engine/types' {
  interface ExtensionOverrides {
    vue?: VueNodeOverrides;
  }
  interface ComponentExtensionOverrides {
    vue?: VueComponentOverride;
  }
}
