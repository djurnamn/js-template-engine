import type {
  Attributes,
  ComponentExtensionOverride,
  EventDefinition,
} from '@js-template-engine/types';

/**
 * Node-level overrides for the Svelte extension, carried under
 * `extensions.svelte` on element nodes.
 *
 * `attributes` merges into the node's attributes per key, the override
 * winning; `events` replaces the node's event list. Override attributes
 * render verbatim, which is how framework-specific bindings without a
 * generic concept — the `bind:` family — are authored.
 *
 * @example
 * const node: ElementNode = {
 *   type: 'element',
 *   tag: 'input',
 *   extensions: {
 *     svelte: { attributes: { 'bind:value': { $expression: 'name' } } },
 *   },
 * };
 */
export interface SvelteNodeOverrides {
  attributes?: Attributes;
  events?: EventDefinition[];
}

declare module '@js-template-engine/types' {
  interface ExtensionOverrides {
    svelte?: SvelteNodeOverrides;
  }
  interface ComponentExtensionOverrides {
    svelte?: ComponentExtensionOverride;
  }
}
