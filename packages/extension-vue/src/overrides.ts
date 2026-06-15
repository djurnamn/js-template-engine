import type {
  Attributes,
  ComponentExtensionOverride,
  EventDefinition,
} from '@js-template-engine/types';

/**
 * Node-level overrides for the Vue extension, carried under
 * `extensions.vue` on element nodes.
 *
 * `attributes` merges into the node's attributes per key, the override
 * winning; `events` replaces the node's event list. Override attributes
 * render verbatim, which is how framework-specific directives without a
 * generic concept — `v-model`, raw `:` bindings — are authored.
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
  attributes?: Attributes;
  events?: EventDefinition[];
}

/**
 * Component-level overrides for the Vue extension. Extends the shared
 * component override with `scoped`, which renders the generated SFC's
 * `<style>` block as `<style scoped>`.
 */
export interface VueComponentOverride extends ComponentExtensionOverride {
  /** Render the SFC `<style>` block as `<style scoped>`. Defaults to `false`. */
  scoped?: boolean;
}

declare module '@js-template-engine/types' {
  interface ExtensionOverrides {
    vue?: VueNodeOverrides;
  }
  interface ComponentExtensionOverrides {
    vue?: VueComponentOverride;
  }
}
